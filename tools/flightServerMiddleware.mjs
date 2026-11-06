import fs from "fs";
import path from "path";

const HELI_TYPES = new Set([
  'R22','R44','R66','B06','B06T','B204','B205','B206','B212','B222','B230',
  'B407','B412','B427','B429','B430','B505','B525',
  'AS32','AS35','AS50','AS55','AS65',
  'EC20','EC25','EC30','EC35','EC45','EC55','EC75',
  'H125','H130','H135','H145','H155','H160','H175','H215','H225',
  'S55','S58','S61','S64','S70','S76','S92',
  'A109','A119','A139','A169','A189','AW09',
  'MD52','MD60','MDHI','MD90','NOTR',
  'B47G','HUEY','GAMA','CABR','EXE',
]);

const PRIVATE_JET_TYPES = new Set([
  'G150','G200','G280','GLEX','G500','G550','G600','G650','G700',
  'GLF2','GLF3','GLF4','GLF5','GLF6','GL5T','GL7T','GV','GIV',
  'CL30','CL35','CL60','BD70','BD10',
  'C25A','C25B','C25C','C500','C510','C525','C550','C560','C56X','C680','C700','C750',
  'E35L','E50P','E55P','E545','E550',
  'FA50','FA7X','FA8X','F900','F2TH',
  'LJ35','LJ40','LJ45','LJ60','LJ70','LJ75',
  'PC12','PC24','TBM7','TBM8','TBM9',
  'PRM1','SF50','EA50','VLJ',
]);

const MILITARY_INDICATORS = new Set([
  'C17','C5M','C130','C30J','KC10','KC46','KC35','E3CF','E3TF','E8A',
  'B1B','B2','B52','F16','F15','F18','F22','F35','A10','F117',
  'RC135','E6B','P8A','P3','MQ9','RQ4','U2','EP3','RC12',
  'V22','CH47','UH60','AH64','AH1Z','MV22',
  'EUFI','RFAL','TORD','TYP','GR4',
]);

const AIRLINER_TYPES = new Set([
  'A319','A320','A321','A332','A333','A339','A343','A359','A388',
  'B737','B738','B739','B38M','B39M','B752','B753','B763','B764',
  'B772','B77L','B77W','B788','B789','B78X',
  'E170','E175','E190','E195','CRJ7','CRJ9','AT43','AT72','DH8D',
]);

const BIZJET_OPERATORS = new Set([
  'EJA','EJM','NJE','LXJ','FJO','VJT','XOJ','JTL','WUP','GAJ','DPJ','CLY','TWY',
]);

const AIRLINE_CODE_RE = /^([A-Z]{3})\d/;
const CALLSIGN_RE = /^[A-Z0-9]{3,8}$/;

function classifyFlight(f) {
  const modelUpper = (f.t || '').toUpperCase();
  const flightStr = (f.flight || '').trim().toUpperCase();
  const dbFlags = f.dbFlags || 0;

  if (modelUpper === 'TWR') return null;

  const lat = f.lat;
  const lon = f.lon;
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

  const callsign = flightStr || f.hex || 'UNKNOWN';
  const altRaw = f.alt_baro;
  const altMeters = typeof altRaw === 'number' ? Math.round(altRaw * 0.3048) : 0;
  const speedKnots = typeof f.gs === 'number' ? Math.round(f.gs * 10) / 10 : 0;
  const heading = typeof f.track === 'number' ? Math.round(f.track) : 0;
  const isHeli = HELI_TYPES.has(modelUpper) || f.category_os === 8;
  const isGrounded = f.grounded || (typeof altRaw === 'number' && altRaw < 100);

  const isOsMilitary = f.category_os === 14;
  const isOsHighPerf = f.category_os === 7;
  const isOsLight = f.category_os === 2;
  const isOsHeavy = f.category_os === 4 || f.category_os === 5 || f.category_os === 6;

  const airlineMatch = AIRLINE_CODE_RE.exec(callsign);
  const airlineCode = airlineMatch ? airlineMatch[1] : '';

  const isGaCallsign = !airlineCode && CALLSIGN_RE.test(flightStr);
  const cruisesLikeAJet = altMeters > 8500 && speedKnots > 300;

  let category = 'commercial';
  if (
    isOsMilitary ||
    dbFlags & 1 ||
    MILITARY_INDICATORS.has(modelUpper) ||
    /^(RCH|KING|DUKE|EVAC|JAKE|REACH|CONVOY)\d/i.test(flightStr)
  ) {
    category = 'military';
  } else if (AIRLINER_TYPES.has(modelUpper) || isOsHeavy) {
    category = 'commercial';
  } else if (
    BIZJET_OPERATORS.has(airlineCode) ||
    PRIVATE_JET_TYPES.has(modelUpper) ||
    isOsHighPerf ||
    (isGaCallsign && cruisesLikeAJet)
  ) {
    category = 'jet';
  } else if (isGaCallsign || isOsLight) {
    category = 'private';
  }

  return {
    callsign,
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lon * 10000) / 10000,
    alt: altMeters,
    heading,
    speed_knots: speedKnots,
    model: f.t || (isHeli ? 'HELI' : 'Unknown'),
    icao24: (f.hex || '').toLowerCase(),
    registration: f.r || '',
    squawk: f.squawk || '',
    airline_code: airlineCode,
    aircraft_category: isHeli ? 'heli' : 'plane',
    category,
    country: f.country || '',
    grounded: isGrounded,
    type: 'flight',
  };
}

let cachedFlights = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 60秒主缓存

// OpenSky 独立快照缓存 (保留最近一次抓取成功的民航快照，即便 OpenSky 临时限流 429 也不至于让民航数字归零)
let cachedOpenSkyRaw = null;
let lastOpenSkyTime = 0;
const OPENSKY_INTERVAL = 180000; // 3分钟请求间隔，彻底防止触发 OpenSky 匿名请求频率限制

function loadLocalSnapshotRaw() {
  try {
    const p = path.resolve('public/data/flightsSnapshot.json');
    if (fs.existsSync(p)) {
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      const combined = [
        ...(json.commercial_flights || []),
        ...(json.private_flights || []),
        ...(json.private_jets || []),
      ];
      return combined.map((f) => ({
        hex: f.icao24,
        flight: f.callsign,
        country: f.country,
        lon: f.lng,
        lat: f.lat,
        alt_baro: f.alt ? f.alt * 3.28084 : null,
        grounded: f.grounded,
        gs: f.speed_knots,
        track: f.heading,
        squawk: f.squawk,
        t: f.model,
      }));
    }
  } catch (e) {
    console.warn('[FlightServer] Failed to read fallback snapshot:', e.message);
  }
  return [];
}

async function fetchLiveFlights() {
  const now = Date.now();
  const needOpenSky = !cachedOpenSkyRaw || (now - lastOpenSkyTime >= OPENSKY_INTERVAL);

  const promises = [
    fetch('https://opendata.adsb.fi/api/v2/mil', {
      headers: { 'User-Agent': 'Mozilla/5.0 OSIRIS-TravelMap' },
      signal: AbortSignal.timeout(12000),
    }),
  ];

  if (needOpenSky) {
    promises.push(
      fetch('https://opensky-network.org/api/states/all?extended=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 OSIRIS-TravelMap' },
        signal: AbortSignal.timeout(16000),
      })
    );
  }

  const results = await Promise.allSettled(promises);
  const milRes = results[0];
  const osRes = needOpenSky ? results[1] : null;

  const seenHex = new Set();
  const allRaw = [];

  // 1. 军用航空 (adsb.fi 实时数据)
  if (milRes.status === 'fulfilled' && milRes.value.ok) {
    try {
      const data = await milRes.value.json();
      if (Array.isArray(data.ac)) {
        for (const item of data.ac) {
          const hex = (item.hex || '').toLowerCase().trim();
          if (hex && !seenHex.has(hex)) {
            seenHex.add(hex);
            allRaw.push(item);
          }
        }
      }
    } catch (e) {}
  }

  // 2. 全球民航与通用航空 (OpenSky 实时数据)
  if (osRes) {
    if (osRes.status === 'fulfilled' && osRes.value.ok) {
      try {
        const data = await osRes.value.json();
        if (Array.isArray(data.states) && data.states.length > 500) {
          const osList = [];
          for (const s of data.states) {
            const hex = (s[0] || '').toLowerCase().trim();
            if (hex && s[5] != null && s[6] != null) {
              osList.push({
                hex,
                flight: s[1]?.trim() || '',
                country: s[2] || '',
                lon: s[5],
                lat: s[6],
                alt_baro: typeof s[7] === 'number' ? s[7] * 3.28084 : null,
                grounded: s[8] || false,
                gs: typeof s[9] === 'number' ? s[9] * 1.94384 : null,
                track: s[10] || 0,
                squawk: s[14] || '',
                category_os: s[17],
              });
            }
          }
          if (osList.length > 500) {
            cachedOpenSkyRaw = osList;
            lastOpenSkyTime = now;
          }
        }
      } catch (e) {
        console.warn('[FlightServer] OpenSky parse error:', e.message);
      }
    } else {
      console.warn('[FlightServer] OpenSky upstream returned 429/timeout, retaining previous snapshot.');
    }
  }

  // 如果 OpenSky 当前为空，尝试从静态快照加载初始民航数据
  if (!cachedOpenSkyRaw || cachedOpenSkyRaw.length === 0) {
    cachedOpenSkyRaw = loadLocalSnapshotRaw();
    lastOpenSkyTime = now;
  }

  // 合并 OpenSky 数据（避免重复 hex）
  if (Array.isArray(cachedOpenSkyRaw)) {
    for (const item of cachedOpenSkyRaw) {
      const hex = (item.hex || '').toLowerCase().trim();
      if (hex && !seenHex.has(hex)) {
        seenHex.add(hex);
        allRaw.push(item);
      }
    }
  }

  if (allRaw.length < 50) {
    throw new Error('Upstream flight providers returned insufficient data');
  }

  const commercial = [];
  const privateFl = [];
  const jets = [];
  const military = [];

  for (const raw of allRaw) {
    const f = classifyFlight(raw);
    if (!f) continue;
    switch (f.category) {
      case 'military': military.push(f); break;
      case 'jet': jets.push(f); break;
      case 'private': privateFl.push(f); break;
      default: commercial.push(f);
    }
  }

  // 防御性校验：如果民航数量异常为0，坚决不覆写旧缓存
  if (commercial.length === 0 && cachedFlights && cachedFlights.counts.commercial > 0) {
    return cachedFlights;
  }

  return {
    commercial_flights: commercial,
    private_flights: privateFl,
    private_jets: jets,
    military_flights: military,
    total: allRaw.length,
    timestamp: new Date().toISOString(),
    source: 'live-adsb',
    counts: {
      total: allRaw.length,
      commercial: commercial.length,
      private: privateFl.length,
      jets: jets.length,
      military: military.length,
    },
  };
}

export async function handleFlightApi(req, res) {
  const url = req.url || '';

  // 1. /api/flights: 全球实时航班集合
  if (url.startsWith('/api/flights')) {
    const now = Date.now();
    if (cachedFlights && (now - lastFetchTime < CACHE_TTL)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(cachedFlights));
      return true;
    }

    try {
      const fresh = await fetchLiveFlights();
      cachedFlights = fresh;
      lastFetchTime = Date.now();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(fresh));
      return true;
    } catch (err) {
      console.warn('[FlightServer] Live fetch failed, serving snapshot fallback:', err.message);
      if (cachedFlights) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(cachedFlights));
        return true;
      }
      // 读取本地快照
      const snapshotPath = path.resolve('public/data/flightsSnapshot.json');
      if (fs.existsSync(snapshotPath)) {
        const fileData = fs.readFileSync(snapshotPath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(fileData);
        return true;
      }
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'Flight data unavailable' }));
      return true;
    }
  }

  // 2. /api/aircraft?icao24=...: 机型与注册号
  if (url.startsWith('/api/aircraft')) {
    try {
      const u = new URL(url, 'http://127.0.0.1');
      const icao = u.searchParams.get('icao24') || '';
      if (!icao) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing icao24 parameter' }));
        return true;
      }
      const target = `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(icao)}`;
      const upstream = await fetch(target, { signal: AbortSignal.timeout(4000) });
      const json = await upstream.json();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(json));
      return true;
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to resolve aircraft' }));
      return true;
    }
  }

  // 3. /api/flight-route?callsign=...: 预定航线
  if (url.startsWith('/api/flight-route')) {
    try {
      const u = new URL(url, 'http://127.0.0.1');
      const cs = u.searchParams.get('callsign') || '';
      if (!cs) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing callsign parameter' }));
        return true;
      }
      const target = `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`;
      const upstream = await fetch(target, { signal: AbortSignal.timeout(4000) });
      const json = await upstream.json();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(json));
      return true;
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to resolve route' }));
      return true;
    }
  }

  return false;
}
