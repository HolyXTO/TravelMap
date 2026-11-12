/**
 * OSIRIS 同款全球实时航班数据服务 (Flight Service)
 * 支持 OpenSky 全球航空网络 + adsb.fi 军用航空网络多源聚合，
 * 附带 ADSBDB 航空器注册与起降航线反查。
 */

import { lookupAirport, greatCirclePoints, haversineKm, getCountryDisplayName } from "../utils/airports";

// 缓存航班详情和航线，避免频繁网络请求
const routeCache = new Map();
const aircraftCache = new Map();
let lastValidFlightsPayload = null;

/**
 * 获取全球实时航班数据 (优先请求后台聚合接口，失败时自动平滑降级到本地全量快照或前序缓存)
 */
export async function fetchFlightsData() {
  const base = import.meta.env.BASE_URL || "/";
  const snapshotUrl = `${base}data/flightsSnapshot.json`.replace(/\/{2,}/g, "/");

  // 1. 优先尝试本地/后台实时 API
  try {
    const res = await fetch("/api/flights", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.total > 0 || (data.commercial_flights && data.commercial_flights.length > 0))) {
        const payload = normalizeFlightsPayload(data, "live");
        if (payload.total > 0) {
          lastValidFlightsPayload = payload;
          return payload;
        }
      }
    }
  } catch (err) {
    // 忽略并降级
  }

  // 2. 降级读取静态快照
  try {
    const res = await fetch(snapshotUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = await res.json();
      const payload = normalizeFlightsPayload(data, "snapshot");
      if (payload.total > 0) {
        lastValidFlightsPayload = payload;
        return payload;
      }
    }
  } catch (err) {
    console.warn("[FlightService] Failed to load snapshot:", err);
  }

  // 3. 如果前后端都遭遇瞬时波动，返回最近一次合法快照，坚决不让数字归零闪烁
  if (lastValidFlightsPayload) {
    return lastValidFlightsPayload;
  }

  return {
    all: [],
    commercial: [],
    privateFlights: [],
    jets: [],
    military: [],
    total: 0,
    source: "offline",
    timestamp: new Date().toISOString(),
  };
}

/**
 * 标准化航班载荷
 */
function normalizeFlightsPayload(data, sourceMode) {
  const comm = Array.isArray(data.commercial_flights) ? data.commercial_flights : [];
  const priv = Array.isArray(data.private_flights) ? data.private_flights : [];
  const jet = Array.isArray(data.private_jets) ? data.private_jets : [];
  const mil = Array.isArray(data.military_flights) ? data.military_flights : [];

  const all = [...comm, ...priv, ...jet, ...mil];

  return {
    all,
    commercial: comm,
    privateFlights: priv,
    jets: jet,
    military: mil,
    total: all.length,
    source: data.source || (sourceMode === "live" ? "Live ADS-B" : "ADS-B Snapshot"),
    timestamp: data.timestamp || new Date().toISOString(),
    counts: {
      total: all.length,
      commercial: comm.length,
      private: priv.length,
      jets: jet.length,
      military: mil.length,
    },
  };
}

/**
 * 查询指定航空器真实注册与型号资料 (ADSBDB)
 */
export async function fetchAircraftDetail(icao24) {
  if (!icao24) return null;
  const hex = icao24.toLowerCase().trim();
  if (aircraftCache.has(hex)) return aircraftCache.get(hex);

  // 尝试查询机身档案 (优先直接 API，超时则降级本地代理)
  const queryEndpoints = [
    `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(hex)}`,
    `/api/aircraft?icao24=${encodeURIComponent(hex)}`,
  ];

  for (const url of queryEndpoints) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const json = await res.json();
        const ac = json?.response?.aircraft;
        if (ac) {
          const detail = {
            icao24: hex,
            registration: ac.registration || null,
            typeCode: ac.type || ac.icao_type_code || null,
            model: ac.type_desc || ac.model || ac.manufacturer || null,
            operator: ac.registered_owner || ac.operator || null,
            manufacturer: ac.manufacturer || null,
          };
          aircraftCache.set(hex, detail);
          return detail;
        }
      }
    } catch (err) {
      // 尝试下一个端点
    }
  }

  const fallback = { icao24: hex, registration: null, typeCode: null, model: null, operator: null };
  aircraftCache.set(hex, fallback);
  return fallback;
}

/**
 * 查询指定航班的预定航线 (起飞与降落机场)
 */
export async function fetchFlightRoute(callsign, icao24, currentLat, currentLng) {
  if (!callsign || callsign === "UNKNOWN") return null;
  const cs = callsign.trim().toUpperCase();
  if (routeCache.has(cs)) return routeCache.get(cs);

  const queryEndpoints = [
    `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`,
    `/api/flight-route?callsign=${encodeURIComponent(cs)}`,
  ];

  for (const url of queryEndpoints) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const json = await res.json();
        const fr = json?.response?.flightroute;
        if (fr) {
          let origin = null;
          if (fr.origin?.icao_code) origin = lookupAirport(fr.origin.icao_code);
          if (!origin && fr.origin?.iata_code) origin = lookupAirport(fr.origin.iata_code);

          let dest = null;
          if (fr.destination?.icao_code) dest = lookupAirport(fr.destination.icao_code);
          if (!dest && fr.destination?.iata_code) dest = lookupAirport(fr.destination.iata_code);

          // 如果本地库未收录，采用 ADSBDB 附带的经纬度与名称
          if (!origin && fr.origin) {
            const oLat = parseFloat(fr.origin.latitude);
            const oLng = parseFloat(fr.origin.longitude);
            if (Number.isFinite(oLat) && Number.isFinite(oLng)) {
              origin = {
                iata: fr.origin.iata_code || '',
                icao: fr.origin.icao_code || '',
                name: fr.origin.name || 'Origin',
                city: fr.origin.municipality || fr.origin.name || '',
                country: fr.origin.country_name || '',
                lat: oLat,
                lng: oLng,
              };
            }
          }
          if (!dest && fr.destination) {
            const dLat = parseFloat(fr.destination.latitude);
            const dLng = parseFloat(fr.destination.longitude);
            if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
              dest = {
                iata: fr.destination.iata_code || '',
                icao: fr.destination.icao_code || '',
                name: fr.destination.name || 'Destination',
                city: fr.destination.municipality || fr.destination.name || '',
                country: fr.destination.country_name || '',
                lat: dLat,
                lng: dLng,
              };
            }
          }

          if (origin && dest && Number.isFinite(origin.lat) && Number.isFinite(dest.lat)) {
            const totalDistKm = Math.round(haversineKm(origin.lat, origin.lng, dest.lat, dest.lng));
            let progress = 0.5;
            let isMismatched = false;
            let mismatchReason = "";

            if (Number.isFinite(currentLat) && Number.isFinite(currentLng)) {
              const flownKm = haversineKm(origin.lat, origin.lng, currentLat, currentLng);
              const distToDest = haversineKm(currentLat, currentLng, dest.lat, dest.lng);

              // 智能航线合理度校验：
              // 1. 飞机已严重飞跃目的地 (如重庆飞菏泽，但飞机实际已飞到菏泽东北方400公里外的山东北部，说明前序航段已结束，正在执行下一航段如菏泽->长春)
              if (flownKm > totalDistKm + 180 && distToDest > 180) {
                isMismatched = true;
                mismatchReason = "previous_leg_finished";
              }
              // 2. 飞机位置与航线走廊彻底脱节 (如公务包机/私人机重复使用代号，静态库映射的是美欧跨大西洋航线，实际机身在英国境内)
              else if (totalDistKm > 0 && (flownKm + distToDest) / totalDistKm > 1.45 && Math.min(flownKm, distToDest) > 300) {
                isMismatched = true;
                mismatchReason = "charter_reused_callsign";
              }

              progress = Math.min(Math.max(flownKm / (totalDistKm || 1), 0.05), 0.98);
            }

            // 若航线明显与机身地理实际矛盾，坚决不在地图上绘制误导性的大圆弧线
            if (isMismatched) {
              const mismatchedData = {
                found: false,
                isMismatched: true,
                mismatchReason,
                callsign: cs,
                airline: fr.airline?.name || null,
                airlineIcao: fr.airline?.icao || null,
                staleRoute: {
                  origin,
                  destination: dest,
                  totalDistanceKm: totalDistKm,
                },
              };
              routeCache.set(cs, mismatchedData);
              return mismatchedData;
            }

            const routeData = {
              found: true,
              callsign: cs,
              airline: fr.airline?.name || null,
              airlineIcao: fr.airline?.icao || null,
              origin,
              destination: dest,
              totalDistanceKm: totalDistKm,
              progress: Math.round(progress * 100),
              geodesicPoints: greatCirclePoints(origin.lat, origin.lng, dest.lat, dest.lng, 48),
            };
            routeCache.set(cs, routeData);
            return routeData;
          }
        }
        const notFound = { found: false, callsign: cs };
        routeCache.set(cs, notFound);
        return notFound;
      } else if (res.status === 404) {
        const notFound = { found: false, callsign: cs };
        routeCache.set(cs, notFound);
        return notFound;
      }
    } catch (err) {
      // 尝试下一个端点
    }
  }

  return { found: false, callsign: cs };
}

// 中英文国家与城市/机场热词映射表 (赋能全局航班语义联想模糊搜索)
const ZH_COUNTRY_MAP = {
  "中国": "china",
  "美国": "united states",
  "法国": "france",
  "英国": "united kingdom",
  "德国": "germany",
  "日本": "japan",
  "俄罗斯": "russia",
  "印度": "india",
  "加拿大": "canada",
  "澳大利亚": "australia",
  "西班牙": "spain",
  "意大利": "italy",
  "荷兰": "netherlands",
  "瑞士": "switzerland",
  "韩国": "south korea",
  "新加坡": "singapore",
  "泰国": "thailand",
  "马来西亚": "malaysia",
  "阿联酋": "united arab emirates",
  "土耳其": "turkey",
  "墨西哥": "mexico",
  "巴西": "brazil",
};

const CITY_KEYWORD_EXPANSIONS = {
  "巴黎": ["france", "ory", "cdg", "tvf", "afr"],
  "paris": ["france", "ory", "cdg", "tvf", "afr"],
  "北京": ["china", "pek", "pkx", "cca"],
  "beijing": ["china", "pek", "pkx", "cca"],
  "上海": ["china", "pvg", "sha", "ces"],
  "shanghai": ["china", "pvg", "sha", "ces"],
  "广州": ["china", "can", "csn"],
  "guangzhou": ["china", "can", "csn"],
  "深圳": ["china", "szx", "csz"],
  "shenzhen": ["china", "szx", "csz"],
  "成都": ["china", "ctu", "tfu", "csu"],
  "chengdu": ["china", "ctu", "tfu", "csu"],
  "重庆": ["china", "ckg"],
  "chongqing": ["china", "ckg"],
  "伦敦": ["united kingdom", "lhr", "lgw", "baw"],
  "london": ["united kingdom", "lhr", "lgw", "baw"],
  "纽约": ["united states", "jfk", "ewr", "lga", "dal", "ual", "aal"],
  "new york": ["united states", "jfk", "ewr", "lga", "dal", "ual", "aal"],
  "洛杉矶": ["united states", "lax"],
  "los angeles": ["united states", "lax"],
  "东京": ["japan", "hnd", "nrt", "jal", "ana"],
  "tokyo": ["japan", "hnd", "nrt", "jal", "ana"],
  "首尔": ["south korea", "icn", "gmp", "kal", "aar"],
  "seoul": ["south korea", "icn", "gmp", "kal", "aar"],
  "法兰克福": ["germany", "fra", "dlh"],
  "frankfurt": ["germany", "fra", "dlh"],
  "香港": ["hong kong", "hkg", "cpa"],
  "hong kong": ["hong kong", "hkg", "cpa"],
  "迪拜": ["united arab emirates", "dxb", "uae"],
  "dubai": ["united arab emirates", "dxb", "uae"],
  "新加坡": ["singapore", "sin", "sia"],
  "singapore": ["singapore", "sin", "sia"],
  "罗马": ["italy", "fco", "cia", "ity"],
  "rome": ["italy", "fco", "cia", "ity"],
  "马德里": ["spain", "mad", "ibe"],
  "madrid": ["spain", "mad", "ibe"],
  "阿姆斯特丹": ["netherlands", "ams", "klm"],
  "amsterdam": ["netherlands", "ams", "klm"],
};

/**
 * 航班多维条件检索 (深度支持多语言国家、代表城市、航空公司及机场代码联想)
 */
export function filterFlights({ flights = [], category = "all", searchQuery = "", limit = 500 }) {
  if (!flights || flights.length === 0) return [];

  let list = flights;

  // 1. 类别过滤
  if (category && category !== "all") {
    if (category === "heli") {
      list = list.filter((f) => f.aircraft_category === "heli");
    } else {
      list = list.filter((f) => f.category === category);
    }
  }

  // 2. 关键词模糊检索 (支持呼号、ICAO24、机型、中英国家名、城市联想)
  const q = (searchQuery || "").trim().toLowerCase();
  if (q) {
    const zhCountryTarget = ZH_COUNTRY_MAP[searchQuery.trim()];
    const cityExpansions = CITY_KEYWORD_EXPANSIONS[q] || CITY_KEYWORD_EXPANSIONS[searchQuery.trim()];

    list = list.filter((f) => {
      const cs = (f.callsign || "").toLowerCase();
      const hex = (f.icao24 || "").toLowerCase();
      const model = (f.model || "").toLowerCase();
      const country = (f.country || "").toLowerCase();
      const reg = (f.registration || "").toLowerCase();
      const airlineCode = (f.airline_code || "").toLowerCase();

      // 基础属性匹配
      if (
        cs.includes(q) ||
        hex.includes(q) ||
        model.includes(q) ||
        country.includes(q) ||
        reg.includes(q) ||
        airlineCode.includes(q)
      ) {
        return true;
      }

      // 全量中文国家名与别名匹配 (如搜索 "巴林"、"孟加拉"、"乌克兰" 等均精准匹配)
      const countryDisplay = getCountryDisplayName(f.country || "Other");
      if (countryDisplay.zh && countryDisplay.zh.toLowerCase().includes(q)) {
        return true;
      }
      if (zhCountryTarget && country.includes(zhCountryTarget)) {
        return true;
      }

      // 城市热词关联拓展匹配 (如搜索 "巴黎" / "paris" 匹配法国航司、法国机身及 ORY/CDG 相关航班)
      if (cityExpansions) {
        for (const word of cityExpansions) {
          if (country.includes(word) || cs.includes(word) || airlineCode.includes(word)) {
            return true;
          }
        }
      }

      return false;
    });
  }

  return limit ? list.slice(0, limit) : list;
}
