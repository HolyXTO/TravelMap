import { defineConfig } from "vite";

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
});
