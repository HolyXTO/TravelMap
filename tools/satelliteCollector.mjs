import fs from "fs";
import path from "path";
import { classifySatellite } from "../src/features/liveCams/utils/satelliteClassification.js";
import { inferSatelliteOwnerCode } from "../src/features/liveCams/utils/satelliteOwners.js";

/**
 * 全量 CelesTrak GP CSV 分组清单（对齐 OSIRIS 的 ~18,600+ 颗全量追踪范围）：
 * - 对所有分组均采用容错采集：单个分组若遇到 CelesTrak 2 小时去重保护 (HTTP 403 "not updated")
 *   或限流，仅跳过或使用本地 2 小时分组缓存，不阻断其余分组，从而稳定合成 16,000 ~ 19,000 颗目录。
 */
export const CELESTRAK_GROUP_SOURCES = [
  // 空间站与科研探索
  { group: "stations", optional: true },
  { group: "science", optional: true },
  { group: "education", optional: true },
  { group: "engineering", optional: true },
  // 全球四大导航星座
  { group: "gps-ops", optional: true },
  { group: "glo-ops", optional: true },
  { group: "galileo", optional: true },
  { group: "beidou", optional: true },
  { group: "gnss", optional: true },
  { group: "nnss", optional: true },
  // 气象与对地观测
  { group: "weather", optional: true },
  { group: "goes", optional: true },
  { group: "noaa", optional: true },
  { group: "resource", optional: true },
  { group: "planet", optional: true },
  { group: "spire", optional: true },
  { group: "sarsat", optional: true },
  { group: "argos", optional: true },
  { group: "dmc", optional: true },
  { group: "geodetic", optional: true },
  // 军事 / 政府 / 雷达遥测
  { group: "military", optional: true },
  { group: "radar", optional: true },
  { group: "tdrss", optional: true },
  // 通信与大型低轨/同步轨星座
  { group: "oneweb", optional: true },
  { group: "iridium-NEXT", optional: true },
  { group: "globalstar", optional: true },
  { group: "orbcomm", optional: true },
  { group: "intelsat", optional: true },
  { group: "ses", optional: true },
  { group: "other-comm", optional: true },
  { group: "x-comm", optional: true },
  { group: "amateur", optional: true },
  { group: "geo", optional: true },
  // Starlink 优先走 supplemental feed，并辅以 GP starlink 分组
  {
    group: "starlink-sup",
    labelGroup: "starlink",
    optional: true,
    url: "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=csv",
  },
  { group: "starlink", optional: true },
  // 立方星 / 最近30天发射 / 高可见目标 / 全量在役兜底
  { group: "cubesat", optional: true },
  { group: "last-30-days", optional: true },
  { group: "visual", optional: true },
  { group: "active", optional: true },
  // 四大追踪轨道碎片带（约 2,000+ 个追踪目标）
  { group: "fengyun-1c-debris", optional: true },
  { group: "cosmos-2251-debris", optional: true },
  { group: "iridium-33-debris", optional: true },
  { group: "cosmos-1408-debris", optional: true },
];

export const COMPACT_ROW_FIELDS = [
  "noradId",
  "name",
  "objectId",
  "category",
  "classificationSource",
  "groups",
  "EPOCH",
  "MEAN_MOTION",
  "ECCENTRICITY",
  "INCLINATION",
  "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER",
  "MEAN_ANOMALY",
  "BSTAR",
  "MEAN_MOTION_DOT",
  "MEAN_MOTION_DDOT",
  "owner",
];

const OMM_COMPACT_FIELDS = [
  "OBJECT_NAME",
  "OBJECT_ID",
  "EPOCH",
  "MEAN_MOTION",
  "ECCENTRICITY",
  "INCLINATION",
  "RA_OF_ASC_NODE",
  "ARG_OF_PERICENTER",
  "MEAN_ANOMALY",
  "NORAD_CAT_ID",
  "BSTAR",
  "MEAN_MOTION_DOT",
  "MEAN_MOTION_DDOT",
  "owner",
];

const GROUP_CACHE_DIR = path.resolve(".cache/celestrak_groups");
const GROUP_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const SATCAT_CACHE_PATH = path.resolve(".cache/satcat.csv");
const SATCAT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function loadSatcatOwnerMap() {
  let csvText = "";
  try {
    if (fs.existsSync(SATCAT_CACHE_PATH)) {
      const stat = fs.statSync(SATCAT_CACHE_PATH);
      const cached = fs.readFileSync(SATCAT_CACHE_PATH, "utf8");
      if (cached && cached.includes("NORAD_CAT_ID")) {
        csvText = cached;
        if (Date.now() - stat.mtimeMs < SATCAT_CACHE_TTL_MS) {
          // 缓存新鲜，直接解析
        } else {
          try {
            const res = await fetch("https://celestrak.org/pub/satcat.csv", {
              signal: AbortSignal.timeout(20000),
            });
            if (res.ok) {
              const fresh = await res.text();
              if (fresh.includes("NORAD_CAT_ID")) {
                csvText = fresh;
                fs.writeFileSync(SATCAT_CACHE_PATH, fresh, "utf8");
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  if (!csvText) {
    try {
      const res = await fetch("https://celestrak.org/pub/satcat.csv", {
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const fresh = await res.text();
        if (fresh.includes("NORAD_CAT_ID")) {
          csvText = fresh;
          fs.mkdirSync(path.dirname(SATCAT_CACHE_PATH), { recursive: true });
          fs.writeFileSync(SATCAT_CACHE_PATH, fresh, "utf8");
        }
      }
    } catch {}
  }

  const map = new Map();
  if (!csvText) return map;
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return map;
  const headers = parseCsvRow(lines[0]).map((h) => h.trim());
  const idIdx = headers.indexOf("NORAD_CAT_ID");
  const ownerIdx = headers.indexOf("OWNER");
  if (idIdx < 0 || ownerIdx < 0) return map;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseCsvRow(line);
    const id = (cols[idIdx] || "").trim();
    const ow = (cols[ownerIdx] || "").trim().toUpperCase();
    if (id && ow) map.set(id, ow);
  }
  return map;
}

function parseCsvRow(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function parseGpCsvText(csvText) {
  const lines = String(csvText || "")
    .trim()
    .split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvRow(lines[0]).map((h) => h.trim());
  const headerIdx = new Map();
  headers.forEach((h, i) => headerIdx.set(h, i));

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const cols = parseCsvRow(raw);
    if (cols.length < 8) continue;

    const omm = {};
    for (const key of OMM_COMPACT_FIELDS) {
      const idx = headerIdx.get(key);
      if (idx !== undefined) {
        omm[key] = (cols[idx] || "").trim();
      }
    }

    const noradId = String(omm.NORAD_CAT_ID || "").trim();
    const name = String(omm.OBJECT_NAME || "").trim();
    if (!noradId || !name || !omm.EPOCH || !omm.MEAN_MOTION) continue;

    rows.push(omm);
  }
  return rows;
}

function normalizeIsoUtc(epochStr) {
  if (!epochStr) return null;
  const trimmed = String(epochStr).trim();
  if (!trimmed) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  return `${trimmed}Z`;
}

function createCatalogVersionId(rows, fetchedAt) {
  const head = rows.slice(0, 5).map((r) => `${r[0]}:${r[6] || ""}`).join("|");
  return `celestrak-full-${fetchedAt.slice(0, 13)}-${rows.length}-${head.length}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCachedGroupCsv(cacheKey) {
  try {
    const p = path.join(GROUP_CACHE_DIR, `${cacheKey}.csv`);
    if (!fs.existsSync(p)) return null;
    const stat = fs.statSync(p);
    const text = fs.readFileSync(p, "utf8");
    if (!text.startsWith("OBJECT_NAME,")) return null;
    return {
      text,
      isFresh: Date.now() - stat.mtimeMs < GROUP_CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeCachedGroupCsv(cacheKey, text) {
  try {
    fs.mkdirSync(GROUP_CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(GROUP_CACHE_DIR, `${cacheKey}.csv`), text, "utf8");
  } catch {}
}

export async function fetchCelesTrakCatalog({
  groups = CELESTRAK_GROUP_SOURCES,
  timeoutMs = 20000,
  requestDelayMs = 220,
  onUpstreamBlocked,
} = {}) {
  const fetchedAt = new Date().toISOString();
  const groupStats = {};
  const failedGroups = [];
  const groupResults = [];

  for (let idx = 0; idx < groups.length; idx += 1) {
    const spec = groups[idx];
    const cacheKey = spec.group;
    const groupName = spec.labelGroup || spec.group;
    const url =
      spec.url ||
      `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(spec.group)}&FORMAT=csv`;

    // 优先命中本地 2 小时分组缓存，遵守 CelesTrak 不重复抓取策略
    const cached = readCachedGroupCsv(cacheKey);
    if (cached?.isFresh) {
      const parsed = parseGpCsvText(cached.text);
      groupStats[cacheKey] = parsed.length;
      groupResults.push({ groupName, parsed });
      continue;
    }

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/csv,text/plain,*/*",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 403 || res.status === 429 || res.status === 500 || res.status === 503) {
        const bodyNote = (await res.text().catch(() => "")).trim().slice(0, 160);
        failedGroups.push({ group: cacheKey, status: res.status, note: bodyNote });
        // 如果之前有旧分组缓存，降级沿用旧分组 CSV
        if (cached?.text) {
          const parsed = parseGpCsvText(cached.text);
          groupStats[`${cacheKey}(cached)`] = parsed.length;
          groupResults.push({ groupName, parsed });
        }
        if (res.status === 429 || res.status === 503) {
          if (onUpstreamBlocked) onUpstreamBlocked(res.status);
        }
        continue;
      }

      if (!res.ok) {
        failedGroups.push({ group: cacheKey, status: res.status });
        continue;
      }

      const text = await res.text();
      if (!text.startsWith("OBJECT_NAME,")) {
        failedGroups.push({ group: cacheKey, status: "invalid_csv" });
        continue;
      }

      writeCachedGroupCsv(cacheKey, text);
      const parsed = parseGpCsvText(text);
      groupStats[cacheKey] = parsed.length;
      groupResults.push({ groupName, parsed });
    } catch (err) {
      failedGroups.push({ group: cacheKey, error: err?.message || "fetch_failed" });
      if (cached?.text) {
        const parsed = parseGpCsvText(cached.text);
        groupStats[`${cacheKey}(cached)`] = parsed.length;
        groupResults.push({ groupName, parsed });
      }
    }

    if (idx < groups.length - 1 && requestDelayMs > 0) {
      await sleep(requestDelayMs);
    }
  }

  // 按预设分组优先顺序合并去重（相同 NORAD 保留更优分类分组与最新 EPOCH）
  const byNorad = new Map();
  for (const res of groupResults) {
    if (!res) continue;
    const { groupName, parsed } = res;
    for (let k = 0; k < parsed.length; k += 1) {
      const omm = parsed[k];
      const noradId = String(omm.NORAD_CAT_ID).trim();
      const existing = byNorad.get(noradId);
      if (existing) {
        if (!existing.groups.includes(groupName)) {
          existing.groups.push(groupName);
        }
        const nextIso = normalizeIsoUtc(omm.EPOCH);
        if (nextIso && (!existing.elementEpoch || nextIso > existing.elementEpoch)) {
          existing.omm = omm;
          existing.elementEpoch = nextIso;
        }
      } else {
        byNorad.set(noradId, {
          noradId,
          name: String(omm.OBJECT_NAME).trim(),
          objectId: String(omm.OBJECT_ID || "").trim(),
          groups: [groupName],
          elementEpoch: normalizeIsoUtc(omm.EPOCH),
          omm,
        });
      }
    }
  }

  const ownerMap = await loadSatcatOwnerMap();
  const sortable = [];
  let latestEpochMs = 0;
  let epochSumMs = 0;
  let epochCount = 0;

  for (const item of byNorad.values()) {
    const { category, classificationSource } = classifySatellite({
      name: item.name,
      groups: item.groups,
    });
    const epMs = item.elementEpoch ? Date.parse(item.elementEpoch) : NaN;
    if (Number.isFinite(epMs)) {
      if (epMs > latestEpochMs) latestEpochMs = epMs;
      epochSumMs += epMs;
      epochCount += 1;
    }
    const owner = inferSatelliteOwnerCode({
      owner: ownerMap.get(item.noradId),
      name: item.name,
    });

    sortable.push({
      noradId: item.noradId,
      name: item.name,
      objectId: item.objectId,
      category,
      classificationSource,
      groups: item.groups,
      omm: item.omm,
      owner,
    });
  }

  sortable.sort((a, b) => {
    const rank = (s) => {
      if (s.noradId === "25544") return 0;
      if (s.noradId === "48274") return 1;
      if (s.groups.includes("stations")) return 2;
      if (s.category === "science") return 3;
      if (s.category === "navigation") return 4;
      if (s.category === "earth_obs") return 5;
      if (s.category === "military") return 6;
      if (s.category === "comms") return 7;
      return 8;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  if (sortable.length === 0) {
    throw new Error("CelesTrak returned zero valid GP records across all requested groups");
  }

  const rows = sortable.map((s) => [
    s.noradId,
    s.name,
    s.objectId,
    s.category,
    s.classificationSource,
    s.groups,
    s.omm.EPOCH,
    s.omm.MEAN_MOTION,
    s.omm.ECCENTRICITY,
    s.omm.INCLINATION,
    s.omm.RA_OF_ASC_NODE,
    s.omm.ARG_OF_PERICENTER,
    s.omm.MEAN_ANOMALY,
    s.omm.BSTAR || "0",
    s.omm.MEAN_MOTION_DOT || "0",
    s.omm.MEAN_MOTION_DDOT || "0",
    s.owner || "TBD",
  ]);

  const elementEpoch = latestEpochMs
    ? new Date(latestEpochMs).toISOString()
    : fetchedAt;
  const meanElementEpoch = epochCount
    ? new Date(Math.round(epochSumMs / epochCount)).toISOString()
    : elementEpoch;

  return {
    schema: "compact-omm-v1",
    source: "celestrak-gp-csv",
    elementSetId: createCatalogVersionId(rows, fetchedAt),
    fetchedAt,
    elementEpoch,
    meanElementEpoch,
    totalCount: rows.length,
    groupStats,
    failedGroups,
    fields: COMPACT_ROW_FIELDS,
    rows,
  };
}
