import fs from "fs";
import path from "path";
import { fetchCelesTrakCatalog } from "./satelliteCollector.mjs";

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // CelesTrak GP 数据约每 2 小时更新，缓存 >= 2 小时
const BACKOFF_MS = 15 * 60 * 1000; // 上游 403/429/500/503 退避 15 分钟
const MIN_FULL_CATALOG_COUNT = 5000; // 避免旧版局部缓存继续生效
const SNAPSHOT_PATH = path.resolve("public/data/satellitesSnapshot.json");
const DISK_CACHE_PATH = path.resolve(".cache/satellitesCatalogCache.json");

let memoryCatalog = null;
let memoryFetchedAtMs = 0;
let upstreamBlockedUntil = 0;
let inFlightPromise = null;

function getCatalogCount(parsed) {
  if (!parsed) return 0;
  if (Array.isArray(parsed.rows)) return parsed.rows.length;
  if (Array.isArray(parsed.satellites)) return parsed.satellites.length;
  return 0;
}

function readDiskCache() {
  try {
    if (!fs.existsSync(DISK_CACHE_PATH)) return null;
    const raw = fs.readFileSync(DISK_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (
      getCatalogCount(parsed) < MIN_FULL_CATALOG_COUNT ||
      !Array.isArray(parsed.fields) ||
      !parsed.fields.includes("owner")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDiskCache(catalog) {
  try {
    fs.mkdirSync(path.dirname(DISK_CACHE_PATH), { recursive: true });
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(catalog), "utf8");
  } catch (err) {
    console.warn("[SatelliteServer] Failed to persist cache:", err?.message);
  }
}

function readSnapshotFallback() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (getCatalogCount(parsed) === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sendJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.end(JSON.stringify(payload));
}

export async function handleSatelliteApi(req, res) {
  const url = req.url || "";
  if (!url.startsWith("/api/satellites")) {
    return false;
  }

  const now = Date.now();

  // 初始化时先从磁盘缓存装载，避免重启 dev server 后频繁重拉 CelesTrak
  if (!memoryCatalog) {
    const disk = readDiskCache();
    if (disk) {
      memoryCatalog = disk;
      memoryFetchedAtMs = Date.parse(disk.fetchedAt || "") || 0;
    }
  }

  const cacheAgeMs = memoryFetchedAtMs ? now - memoryFetchedAtMs : Infinity;
  if (memoryCatalog && cacheAgeMs < CACHE_TTL_MS) {
    sendJson(res, {
      ...memoryCatalog,
      cacheHit: true,
      freshness: "live",
    });
    return true;
  }

  // 上游处于退避期：绝不继续打 CelesTrak，优先返回缓存或快照
  if (now < upstreamBlockedUntil) {
    const fallback = memoryCatalog || readSnapshotFallback();
    if (fallback) {
      sendJson(res, {
        ...fallback,
        cacheHit: true,
        freshness: "stale",
        backoffUntil: new Date(upstreamBlockedUntil).toISOString(),
      });
      return true;
    }
    sendJson(res, { error: "CelesTrak upstream temporarily paused" }, 503);
    return true;
  }

  try {
    if (!inFlightPromise) {
      inFlightPromise = fetchCelesTrakCatalog({
        timeoutMs: 15000,
        onUpstreamBlocked: (status) => {
          upstreamBlockedUntil = Date.now() + BACKOFF_MS;
          console.warn(
            `[SatelliteServer] CelesTrak blocked (${status}), backing off for 15 minutes`,
          );
        },
      }).finally(() => {
        inFlightPromise = null;
      });
    }

    const fresh = await inFlightPromise;
    memoryCatalog = fresh;
    memoryFetchedAtMs = Date.now();
    writeDiskCache(fresh);

    sendJson(res, {
      ...fresh,
      cacheHit: false,
      freshness: "live",
    });
    return true;
  } catch (err) {
    console.warn("[SatelliteServer] Upstream fetch failed, serving fallback:", err?.message);
    const fallback = memoryCatalog || readSnapshotFallback();
    if (fallback) {
      sendJson(res, {
        ...fallback,
        cacheHit: true,
        freshness: "cached",
        warning: err?.message || "Upstream fetch failed",
      });
      return true;
    }
    sendJson(res, { error: "Satellite catalog unavailable" }, 502);
    return true;
  }
}
