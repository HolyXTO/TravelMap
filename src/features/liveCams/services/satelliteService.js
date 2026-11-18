// -*- coding: utf-8 -*-
/**
 * satelliteService.js
 *
 * 卫星轨道要素目录服务：
 * - 本地开发 / 配置 API 时优先请求 `/api/satellites/catalog` (服务端已实现 >= 2h 缓存与退避)
 * - GitHub Pages 等静态部署环境使用 IndexedDB/localStorage 缓存与 `data/satellitesSnapshot.json`
 * - 严格分离 `fetchedAt` (采集时间) 与 `elementEpoch` (轨道要素历元)
 * - 显式状态机：`live` | `cached` | `stale` | `unavailable`
 */

import {
  inferSatelliteOwnerCode,
  getSatelliteOwnerGroupKey,
  getSatelliteCountryDisplay,
} from "../utils/satelliteOwners";

const BASE_URL = import.meta.env.BASE_URL || "/";
const API_BASE = (import.meta.env.VITE_SATELLITE_API_BASE || "").replace(/\/+$/, "");
const LOCAL_CACHE_KEY = "travelmap_sat_catalog_meta_v1";
const STALE_EPOCH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_FETCH_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const MANUAL_REFRESH_COOLDOWN_MS = 3 * 60 * 1000;

let memoryCatalog = null;
let lastManualAttemptMs = 0;

// 应急保底轨道要素（仅当网络与静态快照均不可达时避免白屏，状态标为 unavailable）
const EMERGENCY_FALLBACK_CATALOG = {
  source: "emergency_fallback",
  elementSetId: "emergency-iss-25544",
  fetchedAt: "2026-11-17T06:00:00.000Z",
  elementEpoch: "2026-11-17T04:56:00.646656Z",
  totalCount: 1,
  satellites: [
    {
      noradId: "25544",
      name: "ISS (ZARYA)",
      objectId: "1998-067A",
      category: "science",
      classificationSource: "emergency_fallback",
      groups: ["stations"],
      elementEpoch: "2026-11-17T04:56:00.646656Z",
      omm: {
        OBJECT_NAME: "ISS (ZARYA)",
        OBJECT_ID: "1998-067A",
        EPOCH: "2026-11-17T04:56:00.646656",
        MEAN_MOTION: "15.49427836",
        ECCENTRICITY: ".00073782",
        INCLINATION: "51.6317",
        RA_OF_ASC_NODE: "262.8623",
        ARG_OF_PERICENTER: "34.8927",
        MEAN_ANOMALY: "325.2544",
        EPHEMERIS_TYPE: "0",
        CLASSIFICATION_TYPE: "U",
        NORAD_CAT_ID: "25544",
        ELEMENT_SET_NO: "999",
        REV_AT_EPOCH: "59547",
        BSTAR: ".17680433E-3",
        MEAN_MOTION_DOT: ".9453E-4",
        MEAN_MOTION_DDOT: "0",
      },
    },
  ],
};

function canUseBackendApi() {
  if (API_BASE) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

export function computeCategoryCounts(satellites = []) {
  const counts = {
    all: satellites.length,
    comms: 0,
    navigation: 0,
    earth_obs: 0,
    science: 0,
    military: 0,
    other: 0,
  };
  for (const s of satellites) {
    const key = s?.category && counts[s.category] !== undefined ? s.category : "other";
    counts[key] += 1;
  }
  return counts;
}

export function evaluateDataStatus({
  source,
  fetchedAt,
  elementEpoch,
  cacheHit = false,
  apiReachable = true,
  catalogLength = 0,
}) {
  if (source === "emergency_fallback" || catalogLength === 0) {
    return { status: "unavailable", label: "不可用(保底)", detail: "远端与静态快照均未加载" };
  }

  const now = Date.now();
  const epochMs = Date.parse(elementEpoch || "");
  const fetchedMs = Date.parse(fetchedAt || "");

  if (Number.isFinite(epochMs) && now - epochMs > STALE_EPOCH_THRESHOLD_MS) {
    return { status: "stale", label: "数据陈旧", detail: "轨道要素历元已超过 7 天，推算误差可能增大" };
  }

  if (
    !apiReachable &&
    Number.isFinite(fetchedMs) &&
    now - fetchedMs > STALE_FETCH_THRESHOLD_MS
  ) {
    return { status: "stale", label: "数据陈旧", detail: "当前使用较早的离线快照" };
  }

  if (source === "static-snapshot" || cacheHit || !apiReachable) {
    return {
      status: "cached",
      label: source === "static-snapshot" ? "静态缓存" : "本地缓存",
      detail: "当前基于本地或随站打包的 GP 轨道要素推算",
    };
  }

  return {
    status: "live",
    label: "实时更新",
    detail: "已装载最新 CelesTrak GP 轨道要素并在浏览器持续推算",
  };
}

function hasCatalogPayload(raw) {
  return (
    (Array.isArray(raw?.rows) && raw.rows.length > 0) ||
    (Array.isArray(raw?.satellites) && raw.satellites.length > 0)
  );
}

function inflateCompactRow(row, index, defaultEpoch) {
  if (!Array.isArray(row) || row.length < 13) return null;
  const noradId = String(row[0] || "").trim();
  const epochRaw = row[6];
  const meanMotion = row[7];
  if (!noradId || !epochRaw || !meanMotion) return null;

  const epochStr = String(epochRaw).trim();
  const epochIso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(epochStr) ? epochStr : `${epochStr}Z`;
  const name = String(row[1] || "UNKNOWN").trim();
  const owner = inferSatelliteOwnerCode({ owner: row[16], name });
  const countryKey = getSatelliteOwnerGroupKey(owner);
  const countryDisplay = getSatelliteCountryDisplay(countryKey);

  return {
    index,
    noradId,
    name,
    objectId: String(row[2] || "").trim(),
    category: row[3] || "other",
    classificationSource: row[4] || "unclassified",
    groups: Array.isArray(row[5]) ? row[5] : [],
    owner,
    countryKey,
    countryDisplay,
    elementEpoch: epochIso || defaultEpoch || null,
    omm: {
      NORAD_CAT_ID: noradId,
      EPOCH: epochStr,
      MEAN_MOTION: String(meanMotion),
      ECCENTRICITY: String(row[8] ?? "0"),
      INCLINATION: String(row[9] ?? "0"),
      RA_OF_ASC_NODE: String(row[10] ?? "0"),
      ARG_OF_PERICENTER: String(row[11] ?? "0"),
      MEAN_ANOMALY: String(row[12] ?? "0"),
      BSTAR: String(row[13] ?? "0"),
      MEAN_MOTION_DOT: String(row[14] ?? "0"),
      MEAN_MOTION_DDOT: String(row[15] ?? "0"),
    },
  };
}

function normalizeCatalogPayload(raw, metaOverrides = {}) {
  let sats = [];
  if (Array.isArray(raw?.rows) && raw.rows.length > 0) {
    for (let i = 0; i < raw.rows.length; i += 1) {
      const inflated = inflateCompactRow(raw.rows[i], sats.length, raw.elementEpoch);
      if (inflated) sats.push(inflated);
    }
  } else if (Array.isArray(raw?.satellites)) {
    sats = raw.satellites
      .filter((s) => s && s.noradId && s.omm)
      .map((s, index) => {
        const name = String(s.name || "UNKNOWN").trim();
        const owner = inferSatelliteOwnerCode({ owner: s.owner, name });
        const countryKey = getSatelliteOwnerGroupKey(owner);
        return {
          index,
          noradId: String(s.noradId).trim(),
          name,
          objectId: String(s.objectId || "").trim(),
          category: s.category || "other",
          classificationSource: s.classificationSource || "unclassified",
          groups: Array.isArray(s.groups) ? s.groups : [],
          owner,
          countryKey,
          countryDisplay: getSatelliteCountryDisplay(countryKey),
          elementEpoch: s.elementEpoch || raw.elementEpoch || null,
          omm: s.omm,
        };
      });
  }

  const counts = computeCategoryCounts(sats);
  const source = metaOverrides.source || raw?.source || "static-snapshot";
  const fetchedAt = raw?.fetchedAt || new Date().toISOString();
  const elementEpoch = raw?.elementEpoch || fetchedAt;
  const statusInfo = evaluateDataStatus({
    source,
    fetchedAt,
    elementEpoch,
    cacheHit: Boolean(metaOverrides.cacheHit ?? raw?.cacheHit),
    apiReachable: metaOverrides.apiReachable ?? true,
    catalogLength: sats.length,
  });

  return {
    source,
    elementSetId: raw?.elementSetId || `sat-${fetchedAt}-${sats.length}`,
    fetchedAt,
    elementEpoch,
    totalCount: sats.length,
    counts,
    status: statusInfo.status,
    statusLabel: statusInfo.label,
    statusDetail: statusInfo.detail,
    satellites: sats,
  };
}

export async function fetchSatelliteCatalog({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    const now = Date.now();
    if (now - lastManualAttemptMs < MANUAL_REFRESH_COOLDOWN_MS && memoryCatalog) {
      return {
        ...memoryCatalog,
        rateLimitedNote: "已沿用最近缓存（遵守 CelesTrak 频次保护，避免重复抓取）",
      };
    }
    lastManualAttemptMs = now;
  } else if (memoryCatalog) {
    return memoryCatalog;
  }

  // 1. 尝试本地开发中间件或外部配置的代理 API
  if (canUseBackendApi()) {
    const apiUrl = `${API_BASE}/api/satellites/catalog${forceRefresh ? "?refresh=1" : ""}`;
    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(12000) });
      if (res.ok) {
        const json = await res.json();
        if (hasCatalogPayload(json)) {
          const normalized = normalizeCatalogPayload(json, {
            source: "celestrak-gp-csv",
            cacheHit: Boolean(json.cacheHit),
            apiReachable: true,
          });
          memoryCatalog = normalized;
          try {
            localStorage.setItem(
              LOCAL_CACHE_KEY,
              JSON.stringify({
                elementSetId: normalized.elementSetId,
                fetchedAt: normalized.fetchedAt,
                elementEpoch: normalized.elementEpoch,
              }),
            );
          } catch {}
          return normalized;
        }
      }
    } catch {
      // 回退静态快照
    }
  }

  // 2. 静态托管快照 (`public/data/satellitesSnapshot.json`)
  const snapshotUrl = `${BASE_URL}data/satellitesSnapshot.json`;
  try {
    const res = await fetch(snapshotUrl, {
      cache: forceRefresh ? "reload" : "default",
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const json = await res.json();
      if (hasCatalogPayload(json)) {
        const normalized = normalizeCatalogPayload(json, {
          source: "static-snapshot",
          cacheHit: true,
          apiReachable: false,
        });
        memoryCatalog = normalized;
        return normalized;
      }
    }
  } catch {
    // 进入保底回退
  }

  // 3. 保底目录（仅 ISS 以便仍可验证 SGP4 推算与 3D 展示）
  const fallback = normalizeCatalogPayload(EMERGENCY_FALLBACK_CATALOG, {
    source: "emergency_fallback",
    cacheHit: true,
    apiReachable: false,
  });
  memoryCatalog = fallback;
  return fallback;
}

export function filterSatellites({ satellites = [], category = "all", searchQuery = "" }) {
  const q = String(searchQuery || "").trim().toLowerCase();
  const isAll = !category || category === "all";

  if (isAll && !q) {
    return satellites;
  }

  return satellites.filter((sat) => {
    if (!isAll && sat.category !== category) {
      return false;
    }
    if (!q) return true;

    const nameMatch = sat.name.toLowerCase().includes(q);
    const noradMatch = sat.noradId.toLowerCase().includes(q);
    const objectIdMatch = sat.objectId && sat.objectId.toLowerCase().includes(q);
    const groupMatch = sat.groups.some((g) => g.toLowerCase().includes(q));
    const countryZh = sat.countryDisplay?.zh?.toLowerCase() || "";
    const countryEn = sat.countryDisplay?.en?.toLowerCase() || "";
    const ownerCode = sat.owner?.toLowerCase() || "";
    return (
      nameMatch ||
      noradMatch ||
      objectIdMatch ||
      groupMatch ||
      countryZh.includes(q) ||
      countryEn.includes(q) ||
      ownerCode === q
    );
  });
}
