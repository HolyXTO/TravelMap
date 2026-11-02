// -*- coding: utf-8 -*-
/**
 * mapTheme.js
 * 
 * 全球实时摄像头地图配色主题系统：
 * 1. 提供 8 套涵盖亮色、深海、暖金、军工绿、赛博紫及水墨高对比的专业级预设方案；
 * 2. 默认风格锁定为用户配置的“极简纯白 · 极昼靛蓝”；
 * 3. 完整支持 6 类核心地学要素 (功能块底色、海洋水系、陆地地貌、行政边界、道路网络、监控探头)；
 * 4. 自动根据陆地与海洋明暗计算高对比度地理注记文本与光晕色彩，确保全球注记始终清晰透亮；
 * 5. 基于 MapLibre setPaintProperty 实现 16ms 零闪烁、零重载实时渲染；
 * 6. 具备 LocalStorage 本地持久化与恢复默认配置保障。
 */

export const THEME_PRESETS = [
  {
    id: "default-pure-white",
    name: "极简纯白 · 极昼靛蓝 (默认)",
    enName: "Pure White & Midnight Navy (Default)",
    desc: "用户默认风格 · 纯白高雅功能块底衬，深邃海军蓝大洋与极夜大陆地貌",
    colors: {
      bg: "#ffffff",
      ocean: "#2e405c",
      land: "#0b0e14",
      border: "#b0bdc9",
      road: "#16202c",
      dots: "#00e676",
    },
  },
  {
    id: "osiris-dark",
    name: "OSIRIS 战术暗夜",
    enName: "OSIRIS Tactical Night",
    desc: "原生经典方案 · 极黑深空背景、纯黑隐形海陆与翠绿霓虹探头",
    colors: {
      bg: "#04040a",
      ocean: "#05070a",
      land: "#0b0e14",
      border: "#2a3b4c",
      road: "#16202c",
      dots: "#00e676",
    },
  },
  {
    id: "deep-oceanic",
    name: "蔚蓝星海 · 群青深蓝",
    enName: "Azure Deep Oceanic",
    desc: "大洋湛蓝美学 · 浩瀚蔚蓝海域、深邃海军蓝大陆与极光青电光探头",
    colors: {
      bg: "#051329",
      ocean: "#0a3663",
      land: "#162a45",
      border: "#38bdf8",
      road: "#1e4976",
      dots: "#00f0ff",
    },
  },
  {
    id: "ivory-paper",
    name: "象牙素雅 · 晨曦明白",
    enName: "Ivory Light Carto",
    desc: "典雅亮色地图 · 象牙素白大陆、清透天青海域与烈焰猩红探头",
    colors: {
      bg: "#f1f5f9",
      ocean: "#bae6fd",
      land: "#e2e8f0",
      border: "#64748b",
      road: "#cbd5e1",
      dots: "#ef4444",
    },
  },
  {
    id: "sahara-amber",
    name: "荒漠大地 · 琥珀暖金",
    enName: "Sahara Warm Amber",
    desc: "地质暖棕风采 · 温暖赭石大陆、深沉墨绿洋流与璀璨琥珀金光标",
    colors: {
      bg: "#140f0b",
      ocean: "#13212b",
      land: "#2b1d14",
      border: "#b48356",
      road: "#4a3525",
      dots: "#f59e0b",
    },
  },
  {
    id: "matrix-green",
    name: "战术雷达 · 军工墨绿",
    enName: "Tactical Radar Camo",
    desc: "战术军工绿意 · 橄榄迷彩大陆、深邃墨绿洋面与剧毒荧光绿扫描点",
    colors: {
      bg: "#05140b",
      ocean: "#082013",
      land: "#0f2e1b",
      border: "#22c55e",
      road: "#184729",
      dots: "#39ff14",
    },
  },
  {
    id: "cyber-violet",
    name: "幻境罗兰 · 赛博霓虹",
    enName: "Cyberpunk Violet",
    desc: "科幻紫晶光谱 · 电光紫罗兰陆地、星云暗夜紫海与霓虹粉红光点",
    colors: {
      bg: "#120722",
      ocean: "#170c2e",
      land: "#2b1448",
      border: "#a855f7",
      road: "#49237c",
      dots: "#f43f5e",
    },
  },
  {
    id: "graphite-platinum",
    name: "水墨石墨 · 极致反差",
    enName: "Graphite Platinum Contrast",
    desc: "极致黑白反差 · 坚实石墨灰大陆轮廓、纯黑大洋与冰川天蓝探头",
    colors: {
      bg: "#18181b",
      ocean: "#09090b",
      land: "#3f3f46",
      border: "#f4f4f5",
      road: "#52525b",
      dots: "#38bdf8",
    },
  },
];

// 默认配色严格设为推荐预设风格的第一项（用户当前本地配置风格）
export const DEFAULT_THEME = { ...THEME_PRESETS[0].colors };

const THEME_STORAGE_KEY = "TRAVELMAP_LIVEWORLD_THEME_CUSTOM";

/**
 * 相对亮度计算工具 (WCAG 2.0 标准)
 */
export function getLuminance(hexColor) {
  if (!hexColor) return 0;
  const hex = hexColor.replace("#", "").trim();
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length >= 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 从本地缓存获取用户已保存的配色，如无则返回默认配色
 */
export function getSavedMapTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.land && parsed.ocean) {
        return {
          ...DEFAULT_THEME,
          ...parsed,
          bg: parsed.bg || DEFAULT_THEME.bg,
        };
      }
    }
  } catch (e) {
    console.warn("[mapTheme] Failed to read saved theme from localStorage:", e);
  }
  return { ...DEFAULT_THEME };
}

/**
 * 持久化用户自定或选择的配色
 */
export function saveMapTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (e) {
    console.warn("[mapTheme] Failed to write theme to localStorage:", e);
  }
}

// 核心地表与陆地相关图层
export const LAND_LAYERS = [
  "background",
  "landcover",
  "landuse_residential",
  "landuse",
  "park_national_park",
  "park_nature_reserve",
  "building",
  "building-top",
];

// 水体与海洋相关图层
export const OCEAN_LAYERS = ["water", "waterway"];

// 国家与省州行政边界
export const BORDER_LAYERS = [
  "boundary_country_inner",
  "boundary_country_outline",
  "boundary_state",
  "boundary_county",
];

// 道路与通道体系
export const ROAD_LAYERS = [
  "tunnel_service_case",
  "tunnel_minor_case",
  "tunnel_sec_case",
  "tunnel_pri_case",
  "tunnel_trunk_case",
  "tunnel_mot_case",
  "tunnel_path",
  "tunnel_service_fill",
  "tunnel_minor_fill",
  "tunnel_sec_fill",
  "tunnel_pri_fill",
  "tunnel_trunk_fill",
  "tunnel_mot_fill",
  "tunnel_rail",
  "tunnel_rail_dash",
  "road_service_case",
  "road_minor_case",
  "road_pri_case_ramp",
  "road_trunk_case_ramp",
  "road_mot_case_ramp",
  "road_sec_case_noramp",
  "road_pri_case_noramp",
  "road_trunk_case_noramp",
  "road_mot_case_noramp",
  "road_path",
  "road_service_fill",
  "road_minor_fill",
  "road_pri_fill_ramp",
  "road_trunk_fill_ramp",
  "road_mot_fill_ramp",
  "road_sec_fill_noramp",
  "road_pri_fill_noramp",
  "road_trunk_fill_noramp",
  "road_mot_fill_noramp",
  "rail",
  "rail_dash",
  "aeroway-runway",
  "aeroway-taxiway",
  "bridge_service_case",
  "bridge_minor_case",
  "bridge_sec_case",
  "bridge_pri_case",
  "bridge_trunk_case",
  "bridge_mot_case",
  "bridge_path",
  "bridge_service_fill",
  "bridge_minor_fill",
  "bridge_sec_fill",
  "bridge_pri_fill",
  "bridge_trunk_fill",
  "bridge_mot_fill",
];

// 地理注记文本图层 (国家、大洲、省份、主要城市)
export const PLACE_LABEL_LAYERS = [
  "place_country_1",
  "place_country_2",
  "place_continent",
  "place_state",
  "place_city_r6",
  "place_city_r5",
  "place_city_dot_r7",
  "place_city_dot_r4",
  "place_city_dot_r2",
  "place_town",
  "place_villages",
  "place_hamlet",
];

// 水体地理注记文本图层 (海洋、海湾、湖泊)
export const WATER_LABEL_LAYERS = [
  "watername_ocean",
  "watername_sea",
  "watername_lake",
  "waterway_label",
];

/**
 * 极速应用配色到当前 MapLibre 实例中，无需重新加载样式，1 帧内平滑生效
 */
export function applyMapTheme(map, theme) {
  if (!map || typeof map.getLayer !== "function") return;

  // 0. 功能块底色同步到 3D 深空与天空背景 (保持低雾化系数，防止暗雾掩盖地球本身的色彩)
  if (theme.bg && typeof map.setSky === "function") {
    try {
      map.setSky({
        "sky-color": theme.bg,
        "sky-horizon-blend": 0.5,
        "horizon-color": theme.bg,
        "horizon-fog-blend": 0.3,
        "fog-color": theme.bg,
        "fog-ground-blend": 0.05,
      });
    } catch (e) {}
  }

  // 1. 陆地与背景地貌
  if (theme.land) {
    for (const layerId of LAND_LAYERS) {
      if (map.getLayer(layerId)) {
        try {
          if (layerId === "background") {
            map.setPaintProperty(layerId, "background-color", theme.land);
          } else {
            map.setPaintProperty(layerId, "fill-color", theme.land);
          }
        } catch (e) {}
      }
    }
  }

  // 2. 海洋与水网
  if (theme.ocean) {
    for (const layerId of OCEAN_LAYERS) {
      if (map.getLayer(layerId)) {
        try {
          if (layerId === "waterway") {
            map.setPaintProperty(layerId, "line-color", theme.ocean);
          } else {
            map.setPaintProperty(layerId, "fill-color", theme.ocean);
          }
        } catch (e) {}
      }
    }
  }

  // 3. 国家与行政边界
  if (theme.border) {
    for (const layerId of BORDER_LAYERS) {
      if (map.getLayer(layerId)) {
        try {
          map.setPaintProperty(layerId, "line-color", theme.border);
        } catch (e) {}
      }
    }
  }

  // 4. 道路路网体系
  if (theme.road) {
    for (const layerId of ROAD_LAYERS) {
      if (map.getLayer(layerId)) {
        try {
          map.setPaintProperty(layerId, "line-color", theme.road);
        } catch (e) {}
      }
    }
  }

  // 5. 地理注记文本自适应对比度 (避免亮色地图下白字看不清或暗黑地图下黑字看不清)
  if (theme.land) {
    const isLandLight = getLuminance(theme.land) > 0.55;
    const placeTextColor = isLandLight ? "#0f172a" : "#cbd5e1";
    const placeHaloColor = isLandLight ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 0, 0, 0.85)";

    for (const layerId of PLACE_LABEL_LAYERS) {
      if (map.getLayer(layerId)) {
        try {
          map.setPaintProperty(layerId, "text-color", placeTextColor);
          map.setPaintProperty(layerId, "text-halo-color", placeHaloColor);
          map.setPaintProperty(layerId, "text-halo-width", 1.2);
        } catch (e) {}
      }
    }
  }

  if (theme.ocean) {
    const isOceanLight = getLuminance(theme.ocean) > 0.55;
    const oceanTextColor = isOceanLight ? "#0369a1" : "#7dd3fc";
    const oceanHaloColor = isOceanLight ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 0, 0, 0.8)";

    for (const layerId of WATER_LABEL_LAYERS) {
      if (map.getLayer(layerId)) {
        try {
          map.setPaintProperty(layerId, "text-color", oceanTextColor);
          map.setPaintProperty(layerId, "text-halo-color", oceanHaloColor);
          map.setPaintProperty(layerId, "text-halo-width", 1.0);
        } catch (e) {}
      }
    }
  }

  // 6. CCTV 监控探头圆点与注记文本
  if (theme.dots) {
    const dotLayers = ["livecam-cameras-dots", "cctv-dots"];
    for (const dotId of dotLayers) {
      if (map.getLayer(dotId)) {
        try {
          map.setPaintProperty(dotId, "circle-color", theme.dots);
        } catch (e) {}
      }
    }
    const labelLayers = ["livecam-cameras-label", "cctv-label"];
    for (const labelId of labelLayers) {
      if (map.getLayer(labelId)) {
        try {
          map.setPaintProperty(labelId, "text-color", theme.dots);
        } catch (e) {}
      }
    }
  }
}
