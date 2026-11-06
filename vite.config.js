import { defineConfig } from "vite";
import { handleFlightApi } from "./tools/flightServerMiddleware.mjs";

export default defineConfig({
  base: "/TravelMap/",
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    host: "127.0.0.1",
    watch: {
      ignored: ["**/tools/**"],
    },
  },
  plugins: [
    {
      name: "aviation-and-cctv-proxy-middleware",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // 1. 航班 API 处理器 (/api/flights, /api/aircraft, /api/flight-route)
          try {
            const handled = await handleFlightApi(req, res);
            if (handled) return;
          } catch (err) {
            console.error("[Vite Flight Proxy Error]", err);
          }

          // 2. 德州 CCTV 图像代理
          if (req.url && req.url.startsWith("/api/cctv/texas/snapshot")) {
            try {
              const u = new URL(req.url, "http://127.0.0.1");
              const district = u.searchParams.get("district") || "";
              const id = u.searchParams.get("id") || "";
              if (!district || !id) {
                res.statusCode = 400;
                res.end("Bad Request");
                return;
              }
              const target = `https://its.txdot.gov/its/DistrictIts/GetCctvSnapshotByIcdId?districtCode=${district}&icdId=${id}`;
              const upstream = await fetch(target, { signal: AbortSignal.timeout(6000) });
              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end("Upstream Error");
                return;
              }
              const json = await upstream.json();
              if (json?.snippet && typeof json.snippet === "string") {
                const buf = Buffer.from(json.snippet, "base64");
                res.setHeader("Content-Type", "image/jpeg");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(buf);
                return;
              }
              res.statusCode = 404;
              res.end("Not Found");
              return;
            } catch (err) {
              res.statusCode = 502;
              res.end("Proxy Error");
              return;
            }
          }
          next();
        });
      },
    },
  ],
});
