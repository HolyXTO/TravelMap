// -*- coding: utf-8 -*-
/**
 * mapTheme.js
 * 
 * 全球实时摄像头地图配色主题系统：
 * 1. 提供 6 套精心设计的专业级暗色/战术/未来科技预设方案；
 * 2. 支持用户自由自定义 5 类核心地学要素 (陆地底色、海洋水系、国家/省州行政边界、道路网络、监控探头)；
 * 3. 基于 MapLibre setPaintProperty 实现 16ms 零闪烁、零重载实时渲染；
 * 4. 具备 LocalStorage 本地持久化与恢复默认配置保障。
 */

export const THEME_PRESETS = [
  {
    id: "osiris-dark",
    name: "OSIRIS 战术暗夜",
    enName: "OSIRIS Tactical Night",
    desc: "经典默认 · 极黑深空背景与翠绿霓虹探头",
    colors: {
      bg: "#04040a",
      land: "#0b0e14",
      ocean: "#05070a",
      border: "#2a3b4c",
      road: "#16202c",
      dots: "#00e676",
    },
  },
  {
    id: "cyber-navy",
    name: "赛博深蓝",
    enName: "Cyberpunk Midnight Navy",
    desc: "午夜群青海陆配色搭配冷冽赛博青光探头",
    colors: {
      bg: "#030816",
      land: "#0a1128",
      ocean: "#030712",
      border: "#1c3d5a",
      road: "#112240",
      dots: "#00e5ff",
    },
  },
  {
    id: "obsidian-gold",
    name: "黑曜石金",
    enName: "Obsidian Gold & Amber",
    desc: "深邃玄黑地貌与奢雅琥珀金光标",
    colors: {
      bg: "#0c0b08",
      land: "#141414",
      ocean: "#080808",
      border: "#4a3e26",
      road: "#262015",
      dots: "#ffd700",
    },
  },
  {
    id: "matrix-green",
    name: "雷达矩阵",
    enName: "Matrix Tactical Radar",
    desc: "军工战术墨绿地貌与毒液荧光绿信号",
    colors: {
      bg: "#030a06",
      land: "#08140e",
      ocean: "#020805",
      border: "#1b3b28",
      road: "#102619",
      dots: "#39ff14",
    },
  },
  {
    id: "deep-nebula",
    name: "暗紫星云",
    enName: "Deep Nebula Purple",
    desc: "深邃幽紫异星地质与电光粉紫光点",
    colors: {
      bg: "#0c0614",
      land: "#140d1e",
      ocean: "#09050d",
      border: "#3b2852",
      road: "#241834",
      dots: "#d946ef",
    },
  },
  {
    id: "monochrome-slate",
    name: "极简冷灰",
    enName: "Industrial Slate",
    desc: "工业高对比度冷灰与炽烈猩红警示点",
    colors: {
      bg: "#121216",
      land: "#1e1e24",
      ocean: "#111115",
      border: "#484856",
      road: "#2d2d38",
      dots: "#ff3366",
    },
  },
];

export const DEFAULT_THEME = { ...THEME_PRESETS[0].colors };

const THEME_STORAGE_KEY = "TRAVELMAP_LIVEWORLD_THEME_CUSTOM";

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
const LAND_LAYERS = [
  "background",
  "landcover",
  "landuse_residential",
  "landuse",
  "park_national_park",
  "park_nature_reserve",
];

// 水体与海洋相关图层
const OCEAN_LAYERS = ["water", "waterway", "water_shadow"];

// 国家与省州行政边界
const BORDER_LAYERS = [
  "boundary_country_inner",
  "boundary_country_outline",
  "boundary_state",
  "boundary_county",
];

// 道路与通道体系
const ROAD_LAYERS = [
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

/**
 * 极速应用配色到当前 MapLibre 实例中，无需重新加载样式，1 帧内平滑生效
 */
export function applyMapTheme(map, theme) {
  if (!map || typeof map.getLayer !== "function") return;

  // 0. 功能块底色同步到 3D 深空与天空雾化背景
  if (theme.bg && typeof map.setSky === "function") {
    try {
      map.setSky({
        "sky-color": theme.bg,
        "sky-horizon-blend": 0.5,
        "horizon-color": theme.bg,
        "horizon-fog-blend": 0.3,
        "fog-color": theme.bg,
        "fog-ground-blend": 0.9,
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

  // 5. CCTV 监控探头圆点与注记文本
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
