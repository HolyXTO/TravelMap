/**
 * OSIRIS 同款全球实时航班数据服务 (Flight Service)
 * 支持 OpenSky 全球航空网络 + adsb.fi 军用航空网络多源聚合，
 * 附带 ADSBDB 航空器注册与起降航线反查。
 */

import { lookupAirport, greatCirclePoints, haversineKm } from "../utils/airports";

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
            if (Number.isFinite(currentLat) && Number.isFinite(currentLng)) {
              const flownKm = haversineKm(origin.lat, origin.lng, currentLat, currentLng);
              progress = Math.min(Math.max(flownKm / (totalDistKm || 1), 0.05), 0.98);
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

/**
 * 航班多维条件检索
 */
export function filterFlights({ flights = [], category = "all", searchQuery = "", limit = 200 }) {
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

  // 2. 关键词模糊检索
  const q = (searchQuery || "").trim().toLowerCase();
  if (q) {
    list = list.filter((f) => {
      return (
        (f.callsign && f.callsign.toLowerCase().includes(q)) ||
        (f.icao24 && f.icao24.toLowerCase().includes(q)) ||
        (f.model && f.model.toLowerCase().includes(q)) ||
        (f.country && f.country.toLowerCase().includes(q)) ||
        (f.registration && f.registration.toLowerCase().includes(q))
      );
    });
  }

  return list.slice(0, limit);
}
