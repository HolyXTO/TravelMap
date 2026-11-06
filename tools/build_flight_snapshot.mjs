import https from 'https';
import fs from 'fs';
import path from 'path';

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

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

(async () => {
  try {
    console.log('Fetching live military and OpenSky aircraft...');
    const [milRes, osRes] = await Promise.allSettled([
      fetchJson('https://opendata.adsb.fi/api/v2/mil'),
      fetchJson('https://opensky-network.org/api/states/all?extended=1'),
    ]);

    const seenHex = new Set();
    const allRaw = [];

    if (milRes.status === 'fulfilled' && milRes.value?.ac) {
      for (const item of milRes.value.ac) {
        const hex = (item.hex || '').toLowerCase().trim();
        if (hex && !seenHex.has(hex)) {
          seenHex.add(hex);
          allRaw.push(item);
        }
      }
      console.log(`Ingested ${allRaw.length} military aircraft`);
    }

    if (osRes.status === 'fulfilled' && osRes.value?.states) {
      let osCount = 0;
      for (const s of osRes.value.states) {
        const hex = (s[0] || '').toLowerCase().trim();
        if (hex && !seenHex.has(hex) && s[5] != null && s[6] != null) {
          seenHex.add(hex);
          allRaw.push({
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
          osCount++;
        }
      }
      console.log(`Ingested ${osCount} OpenSky aircraft`);
    }

    const commercial = [];
    const privateFl = [];
    const jets = [];
    const military = [];

    for (const raw of allRaw) {
      const f = classifyFlight(raw);
      if (!f) continue;
      switch (f.category) {
        case 'military':
          military.push(f);
          break;
        case 'jet':
          jets.push(f);
          break;
        case 'private':
          privateFl.push(f);
          break;
        default:
          commercial.push(f);
      }
    }

    const payload = {
      commercial_flights: commercial,
      private_flights: privateFl,
      private_jets: jets,
      military_flights: military,
      total: allRaw.length,
      timestamp: new Date().toISOString(),
      source: 'live-adsb',
      counts: {
        commercial: commercial.length,
        private: privateFl.length,
        jets: jets.length,
        military: military.length,
      },
    };

    const outDir = path.resolve('public/data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'flightsSnapshot.json');
    fs.writeFileSync(outPath, JSON.stringify(payload));
    console.log(`Successfully generated ${outPath} with ${allRaw.length} aircraft!`);
    console.log(`Counts: Commercial: ${commercial.length}, Private: ${privateFl.length}, Jets: ${jets.length}, Military: ${military.length}`);
  } catch (err) {
    console.error('Snapshot build error:', err);
  }
})();
