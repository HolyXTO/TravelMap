// -*- coding: utf-8 -*-
/**
 * satelliteClassification.js
 *
 * CelesTrak GP 目录卫星分类、颜色方案与中英展示元数据：
 * - 优先使用 CelesTrak 官方目录分组来源 (`celestrak:<group>`)
 * - 辅助以轨道/名称关键词 (`name_keyword`)，并显式保留 classificationSource
 * - 无法确认用途的公开目标归入 `other` ("未分类")
 */

export const SATELLITE_CATEGORIES = [
  {
    id: "all",
    label: "全部",
    fullLabel: "全部已加载卫星",
    color: "#e2e8f0",
    lightColor: "#334155",
  },
  {
    id: "comms",
    label: "通信卫星",
    fullLabel: "通信卫星（含星链）",
    color: "#38bdf8",
    lightColor: "#0284c7",
  },
  {
    id: "navigation",
    label: "导航卫星",
    fullLabel: "导航卫星（GPS / 北斗 / Galileo）",
    color: "#22c55e",
    lightColor: "#15803d",
  },
  {
    id: "earth_obs",
    label: "观测气象",
    fullLabel: "对地观测与气象卫星",
    color: "#14b8a6",
    lightColor: "#0f766e",
  },
  {
    id: "science",
    label: "空间站/科学",
    fullLabel: "空间站与科学卫星",
    color: "#a855f7",
    lightColor: "#7e22ce",
  },
  {
    id: "military",
    label: "军事/政府",
    fullLabel: "公开目录中的军事／政府相关",
    color: "#f59e0b",
    lightColor: "#b45309",
  },
  {
    id: "other",
    label: "未分类",
    fullLabel: "未分类公开目标",
    color: "#94a3b8",
    lightColor: "#64748b",
  },
];

export const SATELLITE_CATEGORY_MAP = Object.fromEntries(
  SATELLITE_CATEGORIES.map((item) => [item.id, item]),
);

// WebGL RGBA 归一化颜色表 (用于 3D 着色器与 2D 叠加渲染)
export const CATEGORY_RGB = {
  comms: [56 / 255, 189 / 255, 248 / 255],
  navigation: [34 / 255, 197 / 255, 94 / 255],
  earth_obs: [20 / 255, 184 / 255, 166 / 255],
  science: [168 / 255, 85 / 255, 247 / 255],
  military: [245 / 255, 158 / 255, 11 / 255],
  other: [148 / 255, 163 / 255, 184 / 255],
};

const DEBRIS_GROUPS = new Set([
  "fengyun-1c-debris",
  "cosmos-2251-debris",
  "iridium-33-debris",
  "cosmos-1408-debris",
]);

// CelesTrak GP GROUP -> 业务分类优先级映射
const GROUP_PRIORITY_TO_CATEGORY = [
  { group: "stations", category: "science", source: "celestrak:stations" },
  { group: "military", category: "military", source: "celestrak:military" },
  { group: "radar", category: "military", source: "celestrak:radar" },
  { group: "science", category: "science", source: "celestrak:science" },
  { group: "education", category: "science", source: "celestrak:education" },
  { group: "engineering", category: "science", source: "celestrak:engineering" },
  { group: "geodetic", category: "earth_obs", source: "celestrak:geodetic" },
  { group: "gps-ops", category: "navigation", source: "celestrak:gps-ops" },
  { group: "beidou", category: "navigation", source: "celestrak:beidou" },
  { group: "galileo", category: "navigation", source: "celestrak:galileo" },
  { group: "glo-ops", category: "navigation", source: "celestrak:glo-ops" },
  { group: "glonass-operational", category: "navigation", source: "celestrak:glonass-operational" },
  { group: "gnss", category: "navigation", source: "celestrak:gnss" },
  { group: "nnss", category: "navigation", source: "celestrak:nnss" },
  { group: "weather", category: "earth_obs", source: "celestrak:weather" },
  { group: "goes", category: "earth_obs", source: "celestrak:goes" },
  { group: "noaa", category: "earth_obs", source: "celestrak:noaa" },
  { group: "resource", category: "earth_obs", source: "celestrak:resource" },
  { group: "planet", category: "earth_obs", source: "celestrak:planet" },
  { group: "spire", category: "earth_obs", source: "celestrak:spire" },
  { group: "sarsat", category: "earth_obs", source: "celestrak:sarsat" },
  { group: "argos", category: "earth_obs", source: "celestrak:argos" },
  { group: "dmc", category: "earth_obs", source: "celestrak:dmc" },
  { group: "starlink", category: "comms", source: "celestrak:starlink" },
  { group: "oneweb", category: "comms", source: "celestrak:oneweb" },
  { group: "iridium-NEXT", category: "comms", source: "celestrak:iridium-NEXT" },
  { group: "iridium", category: "comms", source: "celestrak:iridium" },
  { group: "intelsat", category: "comms", source: "celestrak:intelsat" },
  { group: "ses", category: "comms", source: "celestrak:ses" },
  { group: "globalstar", category: "comms", source: "celestrak:globalstar" },
  { group: "orbcomm", category: "comms", source: "celestrak:orbcomm" },
  { group: "other-comm", category: "comms", source: "celestrak:other-comm" },
  { group: "x-comm", category: "comms", source: "celestrak:x-comm" },
  { group: "tdrss", category: "comms", source: "celestrak:tdrss" },
  { group: "amateur", category: "comms", source: "celestrak:amateur" },
  { group: "geo", category: "comms", source: "celestrak:geo" },
  { group: "gpz", category: "comms", source: "celestrak:gpz" },
];

const KEYWORD_RULES = [
  {
    category: "science",
    pattern: /\b(ISS|ZARYA|TIANGONG|CSS|HST|HUBBLE|JWST|WEBB|CHANDRA|FERMI|TERRA|AQUA|TESS|SWIFT)\b/i,
  },
  {
    category: "navigation",
    pattern: /\b(GPS|NAVSTAR|GLONASS|COSMOS 25|GALILEO|BEIDOU|QZSS|IRNSS|NAVIC)\b/i,
  },
  {
    category: "earth_obs",
    pattern: /\b(NOAA|GOES|METEOSAT|METEOR-M|HIMAWARI|FENGYUN|FY-|LANDSAT|SENTINEL|SUOMI|JASON|ICESAT|CALIPSO|GRACE|SMAP|RADARSAT|PLANET|FLOCK|LEMUR|SPIRE|ICEYE|CAPELLA|WORLDVIEW|GAOFEN|JILIN|ZHUHAI)\b/i,
  },
  {
    category: "comms",
    pattern: /\b(STARLINK|ONEWEB|IRIDIUM|INTELSAT|EUTELSAT|SES-|INMARSAT|GLOBALSTAR|ORBCOMM|VIASAT|O3B|TELESAT|KUIPER|CHINASAT|APSTAR|TIANLIAN|QIANFAN|HULIANWANG|GALAXY|ARABSAT|YAMAL|TURKSAT|HISPASAT|G60)\b/i,
  },
  {
    category: "military",
    pattern: /\b(USA[- ]\d+|NROL|SBIRS|DSP|AEHF|WGS|MUOS|MILSTAR|STARSHIELD|MENTOR|ORION|SHIJIAN|YAOGAN|TIANHUI|LUDIAN|KONDOR)\b/i,
  },
];

/**
 * 根据已知 CelesTrak 目录标签与名称规则判定分类，并保留明确来源。
 */
export function classifySatellite({ name = "", groups = [] } = {}) {
  const normalizedGroups = Array.isArray(groups)
    ? groups.map((g) => String(g || "").trim())
    : [];
  const groupSet = new Set(normalizedGroups);
  const upperName = String(name || "").toUpperCase();

  // 优先识别轨道碎片/火箭体，避免误归为在役科学或观测卫星
  for (const dg of DEBRIS_GROUPS) {
    if (groupSet.has(dg)) {
      return {
        category: "other",
        classificationSource: `celestrak:${dg}`,
      };
    }
  }
  if (/\bDEB\b|\bDEBRIS\b|\bR\/B\b/.test(upperName)) {
    return {
      category: "other",
      classificationSource: "debris_keyword",
    };
  }

  for (const rule of GROUP_PRIORITY_TO_CATEGORY) {
    if (groupSet.has(rule.group)) {
      return {
        category: rule.category,
        classificationSource: rule.source,
      };
    }
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(upperName)) {
      return {
        category: rule.category,
        classificationSource: "name_keyword",
      };
    }
  }

  if (groupSet.has("active")) {
    return {
      category: "other",
      classificationSource: "celestrak:active",
    };
  }

  if (groupSet.has("cubesat")) {
    return {
      category: "other",
      classificationSource: "celestrak:cubesat",
    };
  }

  if (groupSet.has("visual")) {
    return {
      category: "other",
      classificationSource: "celestrak:visual",
    };
  }

  return {
    category: "other",
    classificationSource: "unclassified",
  };
}

export function getCategoryMeta(categoryId, isLight = false) {
  const item = SATELLITE_CATEGORY_MAP[categoryId] || SATELLITE_CATEGORY_MAP.other;
  return {
    ...item,
    displayColor: isLight ? item.lightColor : item.color,
    rgb: CATEGORY_RGB[item.id] || CATEGORY_RGB.other,
  };
}

export function formatClassificationSource(source) {
  if (!source) return "未标记来源";
  if (source.startsWith("celestrak:")) {
    return `CelesTrak 目录 (${source.slice("celestrak:".length)})`;
  }
  if (source === "name_keyword") {
    return "公开名称关键词归类";
  }
  if (source === "debris_keyword") {
    return "轨道碎片／火箭体 (未分类)";
  }
  if (source === "emergency_fallback") {
    return "离线内置轨道要素";
  }
  return "公开目录未指明用途";
}

export function classifyOrbitRegime(altKm) {
  if (!Number.isFinite(altKm)) return { code: "LEO", label: "近地轨道 (LEO)" };
  if (altKm < 2000) return { code: "LEO", label: "近地轨道 (LEO)" };
  if (altKm < 34000) return { code: "MEO", label: "中地球轨道 (MEO)" };
  if (altKm <= 37500) return { code: "GEO", label: "地球同步轨道 (GEO)" };
  return { code: "HEO", label: "高椭圆／高轨 (HEO)" };
}
