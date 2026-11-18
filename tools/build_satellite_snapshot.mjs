import fs from "fs";
import path from "path";
import { fetchCelesTrakCatalog } from "./satelliteCollector.mjs";

const OUT_PATH = path.resolve("public/data/satellitesSnapshot.json");
const CACHE_PATH = path.resolve(".cache/satellitesCatalogCache.json");

async function main() {
  console.log("[build_satellite_snapshot] Fetching full GP CSV groups from CelesTrak...");
  const catalog = await fetchCelesTrakCatalog({ timeoutMs: 25000 });
  const serialized = JSON.stringify(catalog);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, serialized, "utf8");

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, serialized, "utf8");

  const sizeMb = (fs.statSync(OUT_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(
    `[build_satellite_snapshot] Wrote ${catalog.totalCount} satellites (${sizeMb} MB) to ${OUT_PATH}`,
  );
  console.log("[build_satellite_snapshot] Group counts:", catalog.groupStats);
  if (catalog.failedGroups.length > 0) {
    console.warn("[build_satellite_snapshot] Failed/skipped groups:", catalog.failedGroups);
  }
}

main().catch((err) => {
  console.error("[build_satellite_snapshot] Failed:", err);
  process.exit(1);
});
