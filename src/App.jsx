import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Database,
  Globe2,
  Layers3,
  ListFilter,
  LogIn,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
  Users,
} from "lucide-react";
import {
  initialVisits,
  placeLevels,
  places,
  profiles,
  tripTypes,
} from "./data/mockData";
import { supabase } from "./lib/supabase";

const PHOTO_BUCKET = "travel-photos";
const GLOBE_SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const routeTransportOptions = [
  { id: "flight", label: "飞机" },
  { id: "ship", label: "轮船" },
  { id: "car", label: "汽车" },
  { id: "train", label: "火车" },
  { id: "walk", label: "步行" },
  { id: "other", label: "其他" },
];
const PROFILE_ID_ORDER = new Map(profiles.map((profile, index) => [profile.id, index]));
const PROFILE_COLOR_ORDER = new Map(
  profiles.map((profile, index) => [(profile.color || "").toLowerCase(), index]),
);
const CHINA_BOUNDS = [
  [18, 73],
  [54, 135],
];
const CHINA_MODAL_BOUNDS = [
  [18, 73],
  [54, 125],
];
const WORLD_BOUNDS = [
  [-56, -170],
  [81, 179],
];
const WORLD_DEFAULT_VIEW = {
  center: [10, 35],
  zoom: 1.75,
};
const WORLD_WRAP_OFFSETS = [-360, 0, 360];
const CHINA_SPECIAL_REGION_PARENT_IDS = {
  CN081: "CN-HK",
  CN082: "CN-MO",
};
const CONTINENT_LABELS = {
  Asia: "亚洲",
  Europe: "欧洲",
  Africa: "非洲",
  Oceania: "大洋洲",
  "North America": "北美洲",
  "South America": "南美洲",
  Antarctica: "南极洲",
};

const SOUTH_AMERICA_CODES = new Set([
  "ARG",
  "BOL",
  "BRA",
  "CHL",
  "COL",
  "ECU",
  "GUY",
  "PER",
  "PRY",
  "SUR",
  "URY",
  "VEN",
]);

const CONTINENT_ACCENTS = {
  亚洲: "#2563eb",
  北美洲: "#16a34a",
  欧洲: "#ea580c",
  非洲: "#0891b2",
  大洋洲: "#7c3aed",
  南美洲: "#dc2626",
  南极洲: "#64748b",
};

const COUNTRY_DOT_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0f766e", "#ca8a04"];
const PROFILE_TONES = [
  {
    fill: "#6aa6d9",
    stroke: "#2463a8",
    marker: "#2563eb",
  },
  {
    fill: "#f3a6bd",
    stroke: "#be4469",
    marker: "#d9467a",
  },
];
function countryDotColor(id) {
  const source = id || "";
  const hash = source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COUNTRY_DOT_COLORS[hash % COUNTRY_DOT_COLORS.length];
}

function visitTone(visitInfo, profiles = [], mapTheme, activeProfile = "all") {
  if (!visitInfo || !visitInfo.count) return null;
  if (activeProfile !== "all") {
    return {
      fill: mapTheme.visitedFill,
      stroke: mapTheme.visitedStroke,
      marker: mapTheme.markerFill,
    };
  }
  const profileIds = visitInfo.profileIds || new Set();
  const firstId = profiles[0]?.id;
  const secondId = profiles[1]?.id;
  if (firstId && secondId && profileIds.has(firstId) && profileIds.has(secondId)) {
    return {
      fill: mapTheme.visitedFill,
      stroke: mapTheme.visitedStroke,
      marker: mapTheme.markerFill,
    };
  }
  if (firstId && profileIds.has(firstId)) return PROFILE_TONES[0];
  if (secondId && profileIds.has(secondId)) return PROFILE_TONES[1];
  return {
    fill: mapTheme.visitedFill,
    stroke: mapTheme.visitedStroke,
    marker: mapTheme.markerFill,
  };
}

const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function useNearViewport(rootMargin = "320px") {
  const ref = useRef(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNear(entry.isIntersecting);
      },
      { root: null, rootMargin, threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, isNear];
}

const MAP_THEMES = [
  {
    id: "ocean",
    label: "蓝色经典",
    tile: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    swatches: ["#c8e9ff", "#1d4ed8"],
    background: "#dbeafe",
    selectedStroke: "#1d4ed8",
    visitedFill: "#f59e0b",
    countryBaseFill: "#f8d894",
    visitedStroke: "#b45309",
    bothFill: "#ec4899",
    emptyFill: "#eef6e4",
    emptyStroke: "#b8c7bf",
    markerFill: "#be185d",
    markerStroke: "#fff7ed",
  },
  {
    id: "copper",
    label: "暖棕",
    tile: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    swatches: ["#f4dfc1", "#7c4a2d"],
    background: "#f8efe3",
    selectedStroke: "#7c4a2d",
    visitedFill: "#e8ad7d",
    countryBaseFill: "#f4d4b5",
    visitedStroke: "#a1623c",
    bothFill: "#b97845",
    emptyFill: "#fff8ec",
    emptyStroke: "#dac8ad",
    markerFill: "#6b3f21",
    markerStroke: "#fff7ed",
  },
  {
    id: "ink",
    label: "深墨",
    tile: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    swatches: ["#172033", "#d6a800"],
    background: "#eef2f7",
    selectedStroke: "#f8fafc",
    visitedFill: "#172033",
    countryBaseFill: "#607089",
    visitedStroke: "#f2e8f0",
    bothFill: "#0f172a",
    emptyFill: "#9fb1c8",
    emptyStroke: "#cbd5e1",
    markerFill: "#d6a800",
    markerStroke: "#fff7d6",
  },
  {
    id: "coral",
    label: "柔和珊瑚",
    tile: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    swatches: ["#f7d6a5", "#e87f63"],
    background: "#e8f5fb",
    selectedStroke: "#e76f51",
    visitedFill: "#e98c70",
    countryBaseFill: "#f3c6b8",
    visitedStroke: "#bc6c45",
    bothFill: "#8ab17d",
    emptyFill: "#fff5e6",
    emptyStroke: "#cfbda7",
    markerFill: "#27364b",
    markerStroke: "#ffffff",
  },
  {
    id: "mint",
    label: "清新绿",
    tile: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    swatches: ["#facc15", "#22c55e"],
    background: "#e7f6ef",
    selectedStroke: "#16a34a",
    visitedFill: "#76c893",
    countryBaseFill: "#cce8cc",
    visitedStroke: "#40916c",
    bothFill: "#facc15",
    emptyFill: "#eef4d8",
    emptyStroke: "#b7c9a0",
    markerFill: "#1f3a5f",
    markerStroke: "#f8fafc",
  },
];

const MAP_THEME_PICKER_ORDER = ["copper", "ocean", "ink", "coral", "mint"];
const ORDERED_MAP_THEMES = MAP_THEME_PICKER_ORDER
  .map((id) => MAP_THEMES.find((theme) => theme.id === id))
  .filter(Boolean);

const CONTINENT_ICONS = {
  [CONTINENT_LABELS.Asia]: "🌏",
  [CONTINENT_LABELS.Europe]: "🌍",
  [CONTINENT_LABELS.Africa]: "🌍",
  [CONTINENT_LABELS.Oceania]: "🌏",
  [CONTINENT_LABELS["North America"]]: "🌎",
  [CONTINENT_LABELS["South America"]]: "🌎",
  [CONTINENT_LABELS.Antarctica]: "🇦🇶",
};

const CONTINENT_SHAPES = {
  [CONTINENT_LABELS.Asia]:
    "M7 17 C12 9 22 7 31 9 C40 6 52 11 58 20 C55 28 48 29 44 35 C39 32 35 38 30 35 C27 30 21 30 16 26 C12 26 9 23 7 17 Z M33 31 C37 34 38 40 33 43 C30 39 29 35 33 31 Z M48 29 C54 31 58 36 54 42 C49 39 46 34 48 29 Z",
  [CONTINENT_LABELS.Europe]:
    "M10 18 C14 12 22 10 29 12 C36 8 46 12 51 19 C48 25 40 26 35 23 C31 28 27 31 22 27 C17 30 12 25 10 18 Z M23 8 C26 3 33 4 35 9 C31 12 27 11 23 8 Z M30 25 C34 29 33 35 29 38 C27 34 27 29 30 25 Z",
  [CONTINENT_LABELS.Africa]:
    "M29 4 C38 7 45 15 46 24 C43 32 37 41 31 45 C24 41 18 33 15 24 C15 15 20 7 29 4 Z M43 25 C50 24 54 28 50 33 C45 33 42 30 43 25 Z",
  [CONTINENT_LABELS.Oceania]:
    "M8 29 C17 23 31 23 42 31 C37 38 23 39 13 34 C10 33 9 31 8 29 Z M43 18 C51 18 59 23 58 29 C50 32 43 28 43 18 Z M51 36 C57 36 60 40 56 44 C51 43 48 40 51 36 Z",
  [CONTINENT_LABELS["North America"]]:
    "M6 14 C15 7 28 6 41 13 C50 15 58 23 56 31 C49 36 39 35 31 27 C24 29 15 25 9 20 C7 18 6 16 6 14 Z M30 27 C37 31 39 37 32 43 C27 38 25 32 30 27 Z",
  [CONTINENT_LABELS["South America"]]:
    "M29 4 C38 9 42 17 39 27 C35 35 31 45 25 47 C20 41 18 34 16 26 C13 17 19 8 29 4 Z",
};

const CONTINENT_ICON_IMAGES = {
  [CONTINENT_LABELS.Asia]: "continent-icons/asia.png",
  [CONTINENT_LABELS.Europe]: "continent-icons/europe.png",
  [CONTINENT_LABELS.Africa]: "continent-icons/africa.png",
  [CONTINENT_LABELS.Oceania]: "continent-icons/oceania.png",
  [CONTINENT_LABELS["North America"]]: "continent-icons/north-america.png",
  [CONTINENT_LABELS["South America"]]: "continent-icons/south-america.png",
  [CONTINENT_LABELS.Antarctica]: "continent-icons/antarctica.png",
};

const PLACE_NAME_OVERRIDES = {
  "W-3191281": { localName: "萨拉热窝", aliases: ["Sarajevo", "塞拉耶佛"] },
  "W-2193733": { localName: "奥克兰", aliases: ["奥克兰都會区", "Auckland"] },
  "W-3042030": { localName: "瓦杜兹", aliases: ["瓦都兹", "Vaduz"] },
  "W-727011": { localName: "索非亚", aliases: ["索菲亚", "Sofia"] },
};

const SUPPLEMENTAL_PLACES = [
  {
    id: "EXTRA-LONGYEARBYEN",
    level: "city",
    parentId: "NOR",
    countryCode: "NOR",
    countryName: "挪威",
    isoA2: "NO",
    name: "Longyearbyen",
    localName: "朗伊尔城",
    province: "斯瓦尔巴群岛",
    center: [15.6469, 78.2232],
    aliases: ["Svalbard", "斯瓦尔巴", "斯瓦尔巴群岛"],
  },
  {
    id: "EXTRA-SVALBARD",
    level: "city",
    parentId: "NOR",
    countryCode: "NOR",
    countryName: "挪威",
    isoA2: "NO",
    name: "Svalbard",
    localName: "斯瓦尔巴群岛",
    province: "斯瓦尔巴群岛",
    center: [16.0, 78.0],
    aliases: ["Longyearbyen", "朗伊尔城"],
  },
  {
    id: "EXTRA-SANTORINI",
    level: "city",
    parentId: "GRC",
    countryCode: "GRC",
    countryName: "希腊",
    isoA2: "GR",
    name: "Santorini",
    localName: "圣托里尼",
    province: "南爱琴",
    center: [25.4615, 36.3932],
    aliases: ["Thira", "锡拉"],
  },
  {
    id: "EXTRA-LOFOTEN",
    level: "city",
    parentId: "NOR",
    countryCode: "NOR",
    countryName: "挪威",
    isoA2: "NO",
    name: "Lofoten Islands",
    localName: "罗弗敦群岛",
    province: "诺尔兰",
    center: [13.8, 68.25],
    aliases: ["Lofoten", "罗弗敦"],
  },
  {
    id: "EXTRA-BLED",
    level: "city",
    parentId: "SVN",
    countryCode: "SVN",
    countryName: "斯洛文尼亚",
    isoA2: "SI",
    name: "Bled",
    localName: "布莱德",
    province: "上卡尼奥拉",
    center: [14.1136, 46.3683],
    aliases: ["Lake Bled", "布莱德湖"],
  },
  {
    id: "EXTRA-BUDVA",
    level: "city",
    parentId: "MNE",
    countryCode: "MNE",
    countryName: "黑山",
    isoA2: "ME",
    name: "Budva",
    localName: "布德瓦",
    province: "布德瓦",
    center: [18.84, 42.286],
    aliases: ["Budva Municipality"],
  },
  {
    id: "EXTRA-AYIA-NAPA",
    level: "city",
    parentId: "CYP",
    countryCode: "CYP",
    countryName: "塞浦路斯",
    isoA2: "CY",
    name: "Ayia Napa",
    localName: "圣纳帕",
    province: "法马古斯塔区",
    center: [34.0018, 34.9823],
    aliases: ["Agia Napa", "Ayia Napa Municipality"],
  },
  {
    id: "EXTRA-VIK",
    level: "city",
    parentId: "ISL",
    countryCode: "ISL",
    countryName: "冰岛",
    isoA2: "IS",
    name: "Vik",
    localName: "维克",
    province: "南部区",
    center: [-19.006, 63.419],
    aliases: ["Vík", "Vik i Myrdal", "Vík í Mýrdal"],
  },
  {
    id: "EXTRA-JURMALA",
    level: "city",
    parentId: "LVA",
    countryCode: "LVA",
    countryName: "拉脱维亚",
    isoA2: "LV",
    name: "Jurmala",
    localName: "尤尔马拉",
    province: "尤尔马拉",
    center: [23.779, 56.968],
    aliases: ["Jūrmala"],
  },
  {
    id: "EXTRA-MENTON",
    level: "city",
    parentId: "FRA",
    countryCode: "FRA",
    countryName: "法国",
    isoA2: "FR",
    name: "Menton",
    localName: "芒通",
    province: "普罗旺斯-阿尔卑斯-蓝色海岸",
    center: [7.504, 43.775],
    aliases: ["Menton, France"],
  },
  {
    id: "EXTRA-CANNES",
    level: "city",
    parentId: "FRA",
    countryCode: "FRA",
    countryName: "法国",
    isoA2: "FR",
    name: "Cannes",
    localName: "戛纳",
    province: "普罗旺斯-阿尔卑斯-蓝色海岸",
    center: [7.017, 43.552],
    aliases: ["Cannes, France"],
  },
  {
    id: "EXTRA-RIMINI",
    level: "city",
    parentId: "ITA",
    countryCode: "ITA",
    countryName: "意大利",
    isoA2: "IT",
    name: "Rimini",
    localName: "里米尼",
    province: "艾米利亚-罗马涅",
    center: [12.568, 44.067],
    aliases: ["Rimini, Italy"],
  },
];

const LEGACY_PLACE_ID_ALIASES = {
  it: "ITA",
  "city-rome": "W-3169070",
};

function canonicalPlaceId(placeId) {
  return LEGACY_PLACE_ID_ALIASES[placeId] || placeId;
}

const regionNamesZh =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["zh-CN"], { type: "region" })
    : null;

const COUNTRY_NAME_ZH_OVERRIDES = {
  CHN: "中国",
  PRK: "朝鲜",
  KOR: "韩国",
  JPN: "日本",
  VAT: "梵蒂冈",
  PSE: "巴勒斯坦",
  ATA: "南极洲",
};

const COUNTRY_LABEL_CENTERS = {
  PRK: [40.25, 127.35],
  KOR: [36.35, 127.85],
  JPN: [38.1, 138.15],
};

function geometryCenter(geometry) {
  const points = [];
  const collect = (item) => {
    if (!Array.isArray(item)) return;
    if (typeof item[0] === "number") {
      points.push(item);
      return;
    }
    item.forEach(collect);
  };
  collect(geometry?.coordinates ?? geometry);
  if (points.length === 0) return [0, 0];
  const bounds = points.reduce(
    (acc, [lon, lat]) => ({
      minLon: Math.min(acc.minLon, lon),
      maxLon: Math.max(acc.maxLon, lon),
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
    }),
    { minLon: 180, maxLon: -180, minLat: 90, maxLat: -90 },
  );
  return [
    (bounds.minLon + bounds.maxLon) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
  ];
}

function flagEmoji(isoA2) {
  if (!isoA2 || isoA2.length !== 2) return "◇";
  return isoA2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("");
}

function isoA2ForPlace(place) {
  if (place?.id === "cn" || place?.mapId === "CHN") return "cn";
  if (place?.isoA2?.length === 2) return place.isoA2.toLowerCase();
  if (place?.countryCode === "CHN" || place?.id === "CHN" || place?.flag === "CN") return "cn";
  return "";
}

function countryNameZh(code, isoA2, fallback) {
  if (COUNTRY_NAME_ZH_OVERRIDES[code]) return COUNTRY_NAME_ZH_OVERRIDES[code];
  if (isoA2 && regionNamesZh) {
    try {
      const name = regionNamesZh.of(isoA2.toUpperCase());
      if (name && !/^[A-Z]{2}$/i.test(name)) return name;
    } catch {
      // Keep the source name when the browser cannot localize a code.
    }
  }
  return fallback;
}

function cleanPlaceName(value) {
  return String(value || "")
    .replace(/[\[〔【（(]\s*\d+\s*[\]〕】）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mergePlaceGeometriesAsMultiPolygon(places = []) {
  const polygons = [];
  for (const place of places) {
    const geometry = place.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      polygons.push(geometry.coordinates);
    } else if (geometry.type === "MultiPolygon") {
      polygons.push(...geometry.coordinates);
    } else if (Array.isArray(geometry)) {
      polygons.push([geometry]);
    }
  }
  return polygons.length > 0
    ? { type: "MultiPolygon", coordinates: polygons }
    : null;
}

function edgePointKey(point) {
  const [lon, lat] = point;
  return `${Number(lon).toFixed(5)},${Number(lat).toFixed(5)}`;
}

function pointFromEdgeKey(key) {
  return key.split(",").map(Number);
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function addBoundarySegment(edges, a, b) {
  if (a === b) return;
  const key = edgeKey(a, b);
  if (edges.has(key)) {
    edges.delete(key);
  } else {
    edges.set(key, [a, b]);
  }
}

function extractOuterBoundaryGeometry(places = []) {
  const edges = new Map();
  const addRing = (ring = []) => {
    for (let index = 0; index < ring.length - 1; index += 1) {
      addBoundarySegment(edges, edgePointKey(ring[index]), edgePointKey(ring[index + 1]));
    }
  };

  for (const place of places) {
    const geometry = place.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      geometry.coordinates.forEach(addRing);
    } else if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((polygon) => polygon.forEach(addRing));
    }
  }

  const adjacency = new Map();
  const pointLookup = new Map();
  const connect = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push(b);
    pointLookup.set(a, pointFromEdgeKey(a));
    pointLookup.set(b, pointFromEdgeKey(b));
  };
  edges.forEach(([a, b]) => {
    connect(a, b);
    connect(b, a);
  });

  adjacency.forEach((neighbors, key) => {
    const [lon, lat] = pointLookup.get(key);
    neighbors.sort((aKey, bKey) => {
      const [aLon, aLat] = pointLookup.get(aKey);
      const [bLon, bLat] = pointLookup.get(bKey);
      return Math.atan2(aLat - lat, aLon - lon) - Math.atan2(bLat - lat, bLon - lon);
    });
  });

  const visited = new Set();
  const directedEdgeKey = (a, b) => `${a}->${b}`;
  const polygons = [];

  for (const [edgeA, edgeB] of edges.values()) {
    for (const [startA, startB] of [
      [edgeA, edgeB],
      [edgeB, edgeA],
    ]) {
      if (visited.has(directedEdgeKey(startA, startB))) continue;

      const ringKeys = [];
      let previous = startA;
      let current = startB;

      for (let guard = 0; guard < edges.size * 2 + 20; guard += 1) {
        const currentDirectedKey = directedEdgeKey(previous, current);
        if (visited.has(currentDirectedKey)) break;
        visited.add(currentDirectedKey);
        ringKeys.push(previous);

        const candidates = adjacency.get(current) || [];
        const previousIndex = candidates.indexOf(previous);
        if (previousIndex < 0) break;

        const next = candidates[(previousIndex - 1 + candidates.length) % candidates.length];
        previous = current;
        current = next;

        if (previous === startA && current === startB) {
          ringKeys.push(previous);
          break;
        }
      }

      if (ringKeys.length > 3 && ringKeys[ringKeys.length - 1] === startA) {
        polygons.push([ringKeys.map(pointFromEdgeKey)]);
      }
    }
  }

  return polygons.length > 0
    ? {
        type: "MultiPolygon",
        coordinates: polygons
          .map((polygon) => ({ polygon, area: ringSignedArea(polygon[0]) }))
          .filter((item) => item.area > 1)
          .sort((a, b) => b.area - a.area)
          .map((item) => item.polygon),
      }
    : null;
}

function ringSignedArea(ring = []) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}

function appendPlaceGeometries(geometry, places = []) {
  if (!geometry) return geometry;
  const coordinates = [...(geometry.coordinates || [])];
  for (const place of places) {
    const source = place.geometry;
    if (!source) continue;
    if (source.type === "Polygon") {
      coordinates.push(source.coordinates);
    } else if (source.type === "MultiPolygon") {
      coordinates.push(...source.coordinates);
    }
  }
  return { ...geometry, coordinates };
}

function applyChinaRegionGeometry(countryPlaces, regionPlaces) {
  const chinaRegions = regionPlaces.filter((place) => place.countryCode === "CHN" && place.level === "region");
  const specialRegionGeometries = chinaRegions.filter((place) => place.id === "CN-HK" || place.id === "CN-MO");
  const chinaGeometry =
    appendPlaceGeometries(extractOuterBoundaryGeometry(chinaRegions), specialRegionGeometries) ||
    mergePlaceGeometriesAsMultiPolygon(chinaRegions);
  if (!chinaGeometry) return countryPlaces;
  return countryPlaces.map((place) =>
    place.id === "CHN"
      ? {
          ...place,
          geometry: chinaGeometry,
          center: geometryCenter(chinaGeometry),
        }
      : place,
  );
}

function featureToPlace(feature) {
  const props = feature.properties;
  const localName = countryNameZh(
    props.code || props.countryCode || props.id,
    props.isoA2,
    props.localName || props.name,
  );
  const name = cleanPlaceName(props.name);
  const cleanLocalName = cleanPlaceName(localName || name);
  return {
    ...props,
    id: props.id,
    level: props.level,
    name,
    localName: cleanLocalName,
    parentId: props.parentId,
    countryCode: props.countryCode || props.code || props.id,
    countryName: cleanPlaceName(props.country || cleanLocalName || name),
    province: cleanPlaceName(props.province),
    flag: flagEmoji(props.isoA2),
    region: props.region || props.continent,
    geometry: feature.geometry,
    center:
      props.longitude && props.latitude
        ? [Number(props.longitude), Number(props.latitude)]
        : geometryCenter(feature.geometry),
  };
}

function normalizePlace(place) {
  const override = PLACE_NAME_OVERRIDES[place.id] || {};
  const next = {
    ...place,
    ...override,
    aliases: [...(place.aliases || []), ...(override.aliases || [])],
  };
  if (next.countryCode === "CN") {
    next.countryCode = "CHN";
    next.countryName = "中国";
  }
  if (next.parentId && CHINA_SPECIAL_REGION_PARENT_IDS[next.parentId]) {
    next.parentId = CHINA_SPECIAL_REGION_PARENT_IDS[next.parentId];
  }
  if (next.provinceCode && CHINA_SPECIAL_REGION_PARENT_IDS[next.provinceCode]) {
    next.parentId = CHINA_SPECIAL_REGION_PARENT_IDS[next.provinceCode];
  }
  if (next.id === "CN081010") {
    next.parentId = "CN-HK";
    next.countryCode = "CHN";
    next.countryName = "中国";
    next.province = "香港";
  }
  if (next.id === "CN082010") {
    next.parentId = "CN-MO";
    next.countryCode = "CHN";
    next.countryName = "中国";
    next.province = "澳门";
  }
  next.name = cleanPlaceName(next.name);
  next.localName = cleanPlaceName(next.localName || next.name);
  next.countryName = cleanPlaceName(next.countryName);
  next.province = cleanPlaceName(next.province);
  next.aliases = [...new Set((next.aliases || []).map(cleanPlaceName).filter(Boolean))];
  return next;
}

function normalizeProvinceName(value) {
  return cleanPlaceName(value)
    .replace(/\s+/g, "")
    .trim();
}

function linkChinaCityParents(regionPlaces, candidatePlaces) {
  const regionByName = new Map(
    regionPlaces
      .filter((place) => place.countryCode === "CHN" && place.level === "region")
      .map((place) => [normalizeProvinceName(place.localName || place.name), place]),
  );

  return candidatePlaces.map((place) => {
    if (place.countryCode !== "CHN" || place.level !== "city" || !place.province) {
      return place;
    }
    const region = regionByName.get(normalizeProvinceName(place.province));
    return region ? { ...place, parentId: region.id } : place;
  });
}

function buildChinaRegionCityIndex(regionPlaces = [], cityPlaces = []) {
  const chinaRegions = regionPlaces.filter(
    (place) => place.countryCode === "CHN" && place.level === "region",
  );
  const chinaCities = cityPlaces.filter(
    (place) => place.countryCode === "CHN" && place.level === "city",
  );
  const citiesByRegionId = new Map(chinaRegions.map((region) => [region.id, []]));
  for (const city of chinaCities) {
    if (!city.parentId || !citiesByRegionId.has(city.parentId)) continue;
    citiesByRegionId.get(city.parentId).push(city);
  }
  return { chinaCities, chinaRegions, citiesByRegionId };
}

function placeToFeature(place) {
  return {
    type: "Feature",
    id: place.id,
    properties: {
      id: place.id,
      level: place.level,
      name: place.name,
      localName: place.localName,
      center: place.center,
      countryCode: place.countryCode,
      isoA2: place.isoA2,
    },
    geometry: Array.isArray(place.geometry)
      ? { type: "Polygon", coordinates: [place.geometry] }
      : place.geometry,
  };
}

function shiftGeometryLongitudes(geometry, offset) {
  if (!geometry || !offset) return geometry;
  const shift = (item) => {
    if (!Array.isArray(item)) return item;
    if (typeof item[0] === "number" && typeof item[1] === "number") {
      return [item[0] + offset, item[1], ...item.slice(2)];
    }
    return item.map(shift);
  };
  return {
    ...geometry,
    coordinates: shift(geometry.coordinates),
  };
}

function placeToFeatureWithOffset(place, offset = 0) {
  const feature = placeToFeature(place);
  return {
    ...feature,
    id: offset ? `${place.id}:${offset}` : place.id,
    properties: {
      ...feature.properties,
      wrapOffset: offset,
    },
    geometry: shiftGeometryLongitudes(feature.geometry, offset),
  };
}

function placesToMapFeatures(items, wrap = false) {
  if (!wrap) return items.map(placeToFeature);
  return WORLD_WRAP_OFFSETS.flatMap((offset) =>
    items.map((place) => placeToFeatureWithOffset(place, offset)),
  );
}

function findPlace(placeId, placeLookup) {
  const canonicalId = canonicalPlaceId(placeId);

  return (
    placeLookup?.get(canonicalId) ||
    placeLookup?.get(placeId) ||
    places.find((place) => place.id === canonicalId || place.id === placeId)
  );
}

function placeChain(placeId, placeLookup) {
  const chain = [];
  let current = findPlace(placeId, placeLookup);
  const seen = new Set();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? findPlace(current.parentId, placeLookup) : null;
  }
  return chain;
}

function resolvePlaceForLevel(placeId, level, placeLookup) {
  const chain = placeChain(placeId, placeLookup);
  if (level === "country") {
    return chain.find((place) => place.level === "country");
  }
  if (level === "region") {
    return chain.find((place) => place.level === "region") ?? chain[0];
  }
  return findPlace(placeId, placeLookup);
}

function resolveMapIdForLevel(placeId, level, placeLookup) {
  const place = resolvePlaceForLevel(placeId, level, placeLookup);
  return place?.mapId || canonicalPlaceId(place?.id);
}

function formatPath(placeId, placeLookup) {
  const chain = placeChain(placeId, placeLookup);
  if (chain.length > 0) {
    return chain.map((place) => displayPlaceName(place)).join(" / ");
  }
  return displayPlaceName(placeLookup.get(placeId)) ?? placeId;
}

function regionLabel(region) {
  return CONTINENT_LABELS[region] || region || "其他";
}

function continentLabelForCountry(country) {
  const source = country?.region || country?.continent;
  if (source === "Americas") {
    return SOUTH_AMERICA_CODES.has(country?.id || country?.countryCode) ? "南美洲" : "北美洲";
  }
  return regionLabel(source || "Other");
}

function placeSearchText(place) {
  return [
    place.flag,
    displayPlaceName(place),
    displayCountryName({ id: place.countryCode, isoA2: place.isoA2, localName: place.countryName }),
    place.localName,
    place.name,
    place.countryName,
    place.province,
    place.region,
    ...(place.aliases || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function displayPlaceName(place) {
  if (!place) return "未知地点";
  if (place.level === "country") {
    return countryNameZh(place.id || place.countryCode, place.isoA2, place.localName || place.name);
  }
  return place.localName || place.name || "未知地点";
}

function displayCountryName(place) {
  if (!place) return "未知地区";
  return countryNameZh(
    place.id || place.countryCode,
    place.isoA2,
    place.localName || place.countryName || place.name,
  );
}

function displayProfileName(name) {
  if (name === "Person A") return "Bobo";
  if (name === "Person B" || name === "Person") return "Yier";
  return name;
}

function profileStableIndex(profile) {
  if (PROFILE_ID_ORDER.has(profile?.id)) return PROFILE_ID_ORDER.get(profile.id);
  const colorIndex = PROFILE_COLOR_ORDER.get((profile?.color || "").toLowerCase());
  if (colorIndex !== undefined) return colorIndex;
  return 99;
}

function sortProfilesStable(items = []) {
  return [...items].sort((a, b) => {
    const order = profileStableIndex(a) - profileStableIndex(b);
    if (order !== 0) return order;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
}

function normalizeProfilesForDisplay(items = []) {
  const ordered = sortProfilesStable(items);
  if (ordered.length >= 2) {
    const [first, second] = ordered;
    const firstName = (first.name || "").trim().toLowerCase();
    const secondName = (second.name || "").trim().toLowerCase();
    if (
      profileStableIndex(first) === 0 &&
      profileStableIndex(second) === 1 &&
      firstName === "tang" &&
      secondName === "xiao"
    ) {
      return [{ ...first, name: "Xiao" }, { ...second, name: "Tang" }, ...ordered.slice(2)];
    }
  }
  return ordered;
}

function parseVisitMeta(note) {
  if (!note) return { rating: 0, text: "", datePrecision: "day", dateDisplay: "", transportMode: "" };
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === "object") {
      return {
        rating: Number(parsed.rating) || 0,
        text: parsed.text || "",
        datePrecision: parsed.datePrecision || "day",
        dateDisplay: parsed.dateDisplay || "",
        transportMode: parsed.transportMode || "",
      };
    }
  } catch {
    // Existing plain-text notes are preserved as text.
  }
  return { rating: 0, text: note, datePrecision: "day", dateDisplay: "", transportMode: "" };
}

function buildVisitNote({ dateDisplay = "", datePrecision = "day", rating = 0, text = "", transportMode = "" } = {}) {
  const normalizedRating = Math.max(0, Math.min(10, Number(rating) || 0));
  if (!normalizedRating && !text && !dateDisplay && !transportMode) return "";
  return JSON.stringify({ dateDisplay, datePrecision, rating: normalizedRating, text, transportMode });
}

function normalizeVisitDateInput(value) {
  const raw = String(value || "").trim().replace(/\//g, "-").replace(/\s+/g, "");
  if (!raw) {
    return { dbDate: null, display: "", precision: "none" };
  }
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return { dbDate: `${yearOnly[1]}-01-01`, display: yearOnly[1], precision: "year" };
  }
  const yearMonth = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) {
    const month = yearMonth[2].padStart(2, "0");
    return { dbDate: `${yearMonth[1]}-${month}-01`, display: `${yearMonth[1]}-${month}`, precision: "month" };
  }
  const fullDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullDate) {
    const month = fullDate[2].padStart(2, "0");
    const day = fullDate[3].padStart(2, "0");
    return { dbDate: `${fullDate[1]}-${month}-${day}`, display: `${fullDate[1]}-${month}-${day}`, precision: "day" };
  }
  throw new Error("日期格式请填写为 YYYY、YYYY-MM 或 YYYY-MM-DD");
}

function DatePrecisionInput({ disabled = false, onChange, value }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("day");

  function applyDate(nextValue) {
    onChange(nextValue || "");
    if (nextValue && mode === "day") setOpen(false);
  }

  return (
    <div className="date-precision-input">
      <input
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="YYYY / YYYY-MM / YYYY-MM-DD"
        type="text"
        value={value || ""}
      />
      <button
        aria-label="打开日期选择"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title="选择日期"
        type="button"
      >
        <CalendarDays size={16} />
      </button>
      {open && !disabled && (
        <div className="date-picker-popover">
          <div className="date-picker-modes">
            {[
              ["year", "年"],
              ["month", "年月"],
              ["day", "年月日"],
            ].map(([id, label]) => (
              <button
                className={mode === id ? "active" : ""}
                key={id}
                onClick={() => setMode(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "year" && (
            <input
              max="2100"
              min="1900"
              onChange={(event) => applyDate(event.target.value)}
              placeholder="YYYY"
              type="number"
              value={/^\d{4}$/.test(value || "") ? value : ""}
            />
          )}
          {mode === "month" && (
            <input
              onChange={(event) => applyDate(event.target.value)}
              type="month"
              value={/^\d{4}-\d{2}$/.test(value || "") ? value : ""}
            />
          )}
          {mode === "day" && (
            <input
              onChange={(event) => applyDate(event.target.value)}
              type="date"
              value={/^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : ""}
            />
          )}
        </div>
      )}
    </div>
  );
}

function displayVisitDate(visit) {
  return visit?.dateDisplay || visit?.visitedAt || "";
}

function resetMapViewport(map, level) {
  if (!map) return;
  if (level === "country") {
    map.setView(WORLD_DEFAULT_VIEW.center, WORLD_DEFAULT_VIEW.zoom, { animate: false });
    return;
  }
  const bounds = L.latLngBounds(CHINA_BOUNDS);
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [10, 10], animate: false });
  }
}

function calculateVisitStats(targetVisits, placeLookup) {
  const countries = new Set();
  const regions = new Set();
  const cities = new Set();
  const domesticCities = new Set();
  const internationalCities = new Set();
  for (const visit of targetVisits) {
    const chain = placeChain(visit.placeId, placeLookup);
    const country = chain.find((place) => place.level === "country");
    const region = chain.find((place) => place.level === "region");
    const city = chain.find((place) => place.level === "city");
    if (country) countries.add(country.mapId || country.id);
    if (region && country?.id === "CHN") regions.add(region.mapId || region.id);
    if (city) {
      const cityId = city.mapId || city.id;
      cities.add(cityId);
      if (country?.id === "CHN") domesticCities.add(cityId);
      else internationalCities.add(cityId);
    }
  }
  return {
    countries: countries.size,
    regions: regions.size,
    cities: cities.size,
    domesticCities: domesticCities.size,
    internationalCities: internationalCities.size,
    visits: targetVisits.length,
  };
}

function placeLatLng(place) {
  const [lng, lat] = place?.center || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function buildJourneyPoints(targetVisits, placeLookup) {
  const uniquePoints = new Map();
  const sequence = [];
  const orderedVisits = [...targetVisits].reverse();
  for (const visit of orderedVisits) {
    const place =
      resolvePlaceForLevel(visit.placeId, "city", placeLookup) ||
      findPlace(visit.placeId, placeLookup);
    const latLng = placeLatLng(place);
    if (!place || !latLng) continue;
    const id = canonicalPlaceId(place.id);
    const point = {
      id,
      lat: latLng.lat,
      lng: latLng.lng,
      name: displayPlaceName(place),
      country: displayCountryName(resolvePlaceForLevel(visit.placeId, "country", placeLookup)),
    };
    if (!uniquePoints.has(id)) uniquePoints.set(id, point);
    if (sequence.at(-1)?.id !== id) sequence.push(point);
  }
  const points = Array.from(uniquePoints.values()).slice(0, 220);
  const arcs = [];
  for (let index = 1; index < sequence.length && arcs.length < 90; index += 1) {
    const start = sequence[index - 1];
    const end = sequence[index];
    if (start.id !== end.id) arcs.push({ id: `${start.id}-${end.id}-${index}`, start, end });
  }
  return { points, arcs };
}

function mapRoute(row) {
  const meta = parseVisitMeta(row.note);
  return {
    id: row.id,
    profileId: row.profile_id,
    startPlaceId: row.start_place_id,
    endPlaceId: row.end_place_id,
    traveledAt: row.traveled_at,
    dateDisplay: meta.dateDisplay || row.traveled_at || "",
    datePrecision: meta.datePrecision || "day",
    transportMode: meta.transportMode || "flight",
  };
}

function routeTransportLabel(mode) {
  return routeTransportOptions.find((item) => item.id === mode)?.label || "交通";
}

function routeArcFromPlaces(route, placeLookup) {
  const startPlace = findPlace(route.startPlaceId, placeLookup);
  const endPlace = findPlace(route.endPlaceId, placeLookup);
  const startLatLng = placeLatLng(startPlace);
  const endLatLng = placeLatLng(endPlace);
  if (!startPlace || !endPlace || !startLatLng || !endLatLng) return null;
  return {
    id: `route-${route.id}`,
    routeId: route.id,
    profileId: route.profileId,
    start: {
      id: canonicalPlaceId(startPlace.id),
      lat: startLatLng.lat,
      lng: startLatLng.lng,
      name: displayPlaceName(startPlace),
      country: displayCountryName(resolvePlaceForLevel(startPlace.id, "country", placeLookup)),
    },
    end: {
      id: canonicalPlaceId(endPlace.id),
      lat: endLatLng.lat,
      lng: endLatLng.lng,
      name: displayPlaceName(endPlace),
      country: displayCountryName(resolvePlaceForLevel(endPlace.id, "country", placeLookup)),
    },
    dateDisplay: route.dateDisplay,
    transportMode: route.transportMode,
    generated: false,
  };
}

function buildRouteArcs(routes, placeLookup) {
  return routes
    .map((route) => routeArcFromPlaces(route, placeLookup))
    .filter(Boolean)
    .slice(0, 160);
}

function collectGeometryCoordinates(geometry, output = []) {
  if (!geometry) return output;
  const walk = (item) => {
    if (!Array.isArray(item)) return;
    if (typeof item[0] === "number" && typeof item[1] === "number") {
      output.push(item);
      return;
    }
    item.forEach(walk);
  };
  walk(geometry.coordinates || geometry);
  return output;
}

function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates || []];
  if (geometry.type === "MultiPolygon") return geometry.coordinates || [];
  return [];
}

function ringBounds(ring) {
  return ring.reduce(
    (bounds, point) => ({
      minLng: Math.min(bounds.minLng, point[0]),
      maxLng: Math.max(bounds.maxLng, point[0]),
      minLat: Math.min(bounds.minLat, point[1]),
      maxLat: Math.max(bounds.maxLat, point[1]),
    }),
    { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 },
  );
}

function isPointInBounds(lng, lat, bounds) {
  return lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat;
}

function isPointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInPolygon(lng, lat, polygon) {
  if (!polygon.rings.length || !isPointInBounds(lng, lat, polygon.bounds)) return false;
  if (!isPointInRing(lng, lat, polygon.rings[0])) return false;
  return !polygon.rings.slice(1).some((ring) => isPointInRing(lng, lat, ring));
}

function buildWorldShapeDots(countryPlaces) {
  const polygons = countryPlaces
    .filter((country) => country.id !== "ATA")
    .flatMap((country) =>
      geometryPolygons(country.geometry)
        .filter((rings) => rings?.[0]?.length)
        .map((rings) => ({
          bounds: ringBounds(rings[0]),
          rings,
        })),
    );
  const dots = [];
  const latStep = 2.15;
  const lngStep = 2.15;
  let row = 0;
  for (let lat = 82; lat >= -57; lat -= latStep, row += 1) {
    const offset = row % 2 === 0 ? 0 : lngStep / 2;
    for (let lng = -178 + offset; lng <= 180; lng += lngStep) {
      if (polygons.some((polygon) => isPointInPolygon(lng, lat, polygon))) {
        dots.push({ id: `${lng.toFixed(2)},${lat.toFixed(2)}`, lat, lng });
      }
    }
  }
  return dots;
}

function collectUniquePlacesForLevel(targetVisits, placeLookup, level) {
  const result = new Map();
  for (const visit of targetVisits) {
    const place = resolvePlaceForLevel(visit.placeId, level, placeLookup);
    const country = resolvePlaceForLevel(visit.placeId, "country", placeLookup);
    if (!place) continue;
    if (level === "region" && country?.id !== "CHN") continue;
    if (level === "country" && place.id === "ATA") continue;
    result.set(place.mapId || place.id, place);
  }
  return result;
}

function buildPlaceDifference(leftMap, rightMap) {
  const sortPlaces = (items) =>
    items.sort((a, b) => displayPlaceName(a).localeCompare(displayPlaceName(b), "zh-CN"));
  return {
    leftOnly: sortPlaces(Array.from(leftMap.entries()).filter(([id]) => !rightMap.has(id)).map(([, place]) => place)),
    rightOnly: sortPlaces(Array.from(rightMap.entries()).filter(([id]) => !leftMap.has(id)).map(([, place]) => place)),
  };
}

function buildContinentSummary(visits, placeLookup, countryPlaces = []) {
  const buckets = new Map();
  for (const country of countryPlaces) {
    if (country.id === "ATA") continue;
    const continent = continentLabelForCountry(country);
    if (!buckets.has(continent)) {
      buckets.set(continent, {
        label: continent,
        count: 0,
        cityIds: new Set(),
        visitedCountryIds: new Set(),
        countryTotal: 0,
        countries: new Map(),
      });
    }
    buckets.get(continent).countryTotal += 1;
  }
  for (const visit of visits) {
    const canonicalVisitPlaceId = canonicalPlaceId(visit.placeId);
    const chain = placeChain(canonicalVisitPlaceId, placeLookup);
    const country = chain.find((place) => place.level === "country");
    const region = chain.find((place) => place.level === "region");
    const city = chain.find((place) => place.level === "city");
    const continent = continentLabelForCountry(country);
    if (!buckets.has(continent)) {
      buckets.set(continent, {
        label: continent,
        count: 0,
        cityIds: new Set(),
        visitedCountryIds: new Set(),
        countryTotal: 0,
        countries: new Map(),
      });
    }
    const bucket = buckets.get(continent);
    bucket.count += 1;
    if (country?.id) bucket.visitedCountryIds.add(country.id);
    bucket.cityIds.add(city?.id || canonicalVisitPlaceId);
    const countryId = country?.id || "unknown";
    if (!bucket.countries.has(countryId)) {
      bucket.countries.set(countryId, {
        id: countryId,
        name: displayCountryName(country),
        place: country,
        regions: new Set(),
        cities: new Set(),
        cityNames: new Set(),
        regionNames: new Set(),
        detailGroups: new Map(),
        visits: 0,
      });
    }
    const item = bucket.countries.get(countryId);
    item.visits += 1;
    if (region) {
      item.regions.add(region.id);
      item.regionNames.add(displayPlaceName(region));
    }
    if (city) {
      item.cities.add(city.id);
      item.cityNames.add(displayPlaceName(city));
    }
    const visitedPlace = findPlace(canonicalVisitPlaceId, placeLookup);
    const detailId = region?.id || country?.id || "other";
    const detailName = region ? displayPlaceName(region) : country ? "已标记地点" : "其他地点";
    const tagPlace = city || (visitedPlace?.level !== "country" ? visitedPlace : null);
    if (tagPlace) {
      if (!item.detailGroups.has(detailId)) {
        item.detailGroups.set(detailId, {
          id: detailId,
          name: detailName,
          cities: new Map(),
        });
      }
      item.detailGroups.get(detailId).cities.set(tagPlace.id, displayPlaceName(tagPlace));
    }
  }

  const order = ["亚洲", "欧洲", "北美洲", "南美洲", "非洲", "大洋洲", "南极洲"];
  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      cityCount: bucket.cityIds.size,
      countryCount: bucket.visitedCountryIds.size,
      countries: Array.from(bucket.countries.values())
        .map((country) => ({
          ...country,
          detailGroups: Array.from(country.detailGroups.values())
            .map((group) => ({
              ...group,
              cities: Array.from(group.cities.values()).sort((a, b) => a.localeCompare(b, "zh-CN")),
            }))
            .sort((a, b) => b.cities.length - a.cities.length || a.name.localeCompare(b.name, "zh-CN")),
        }))
        .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "zh-CN")),
    }))
    .sort((a, b) => {
      const aHasVisits = a.cityCount > 0 || a.countryCount > 0;
      const bHasVisits = b.cityCount > 0 || b.countryCount > 0;
      if (aHasVisits !== bHasVisits) return aHasVisits ? -1 : 1;
      const ai = order.indexOf(a.label);
      const bi = order.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

function photoFromPath(path) {
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return {
    name: path.split("/").pop() || "旅行照片",
    url: data.publicUrl,
  };
}

function mapProfile(row) {
  return {
    id: row.id,
    name: displayProfileName(row.display_name),
    color: row.color,
    createdAt: row.created_at,
  };
}

function mapVisit(row) {
  const meta = parseVisitMeta(row.note || "");
  return {
    id: row.id,
    profileId: row.profile_id,
    placeId: row.place_id,
    visitedAt: row.visited_at,
    dateDisplay: meta.dateDisplay || row.visited_at,
    datePrecision: meta.datePrecision || "day",
    type: row.trip_type,
    note: meta.text,
    rating: meta.rating,
    photos: (row.visit_photos || []).map((photo) =>
      photoFromPath(photo.storage_path),
    ),
  };
}

function safeStorageName(name) {
  return name.replace(/[^\w.-]+/g, "_").slice(-100) || "photo";
}

function App() {
  const [activeProfile, setActiveProfile] = useState("all");
  const [activeLevel, setActiveLevel] = useState("country");
  const [yearFilter, setYearFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [activeMapThemeId, setActiveMapThemeId] = useState("copper");
  const [appProfiles, setAppProfiles] = useState(profiles);
  const [visits, setVisits] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [routeMessage, setRouteMessage] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("CHN");
  const [countryModalId, setCountryModalId] = useState(null);
  const [mapPlaces, setMapPlaces] = useState({ country: [], region: [], city: [] });
  const [searchPlaces, setSearchPlaces] = useState([]);
  const [mapStatus, setMapStatus] = useState("正在加载真实边界");
  const [dataStatus, setDataStatus] = useState("正在连接 Supabase");
  const [session, setSession] = useState(null);
  const [isEditor, setIsEditor] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [quickAddFocusRequest, setQuickAddFocusRequest] = useState(null);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [profileSettingsMessage, setProfileSettingsMessage] = useState("");

  function openVisitEditor(visit) {
    setAuthMessage("");
    setEditMessage("");
    setEditingVisit(visit);
  }

  const profileFilters = useMemo(
    () => [
      { id: "all", label: "两个人" },
      ...appProfiles.map((profile) => ({ id: profile.id, label: profile.name })),
    ],
    [appProfiles],
  );

  useEffect(() => {
    if (
      activeProfile !== "all" &&
      !appProfiles.some((profile) => profile.id === activeProfile)
    ) {
      setActiveProfile("all");
    }
  }, [activeProfile, appProfiles]);

  const loadTravelData = async () => {
    try {
      setDataStatus("正在同步 Supabase 数据");
      const [profilesResult, visitsResult] = await Promise.all([
        supabase
          .from("travel_profiles")
          .select("id, display_name, color, created_at")
          .order("created_at", { ascending: true }),
        supabase
          .from("visits")
          .select(
            "id, profile_id, place_id, visited_at, trip_type, note, visit_photos(id, storage_path, caption)",
          )
          .order("visited_at", { ascending: false }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (visitsResult.error) throw visitsResult.error;

      const nextProfiles = normalizeProfilesForDisplay(profilesResult.data.map(mapProfile));
      setAppProfiles(nextProfiles.length > 0 ? nextProfiles : profiles);
      setVisits(visitsResult.data.map(mapVisit));
      const routesResult = await supabase
        .from("travel_routes")
        .select("id, profile_id, start_place_id, end_place_id, traveled_at, note, created_by, created_at")
        .order("created_at", { ascending: false });
      if (routesResult.error) {
        console.warn("travel_routes is not ready yet", routesResult.error);
        setRoutes([]);
        setRouteMessage("轨迹表还未创建，执行 supabase/schema.sql 后可保存真实轨迹。");
      } else {
        setRoutes(routesResult.data.map(mapRoute));
        setRouteMessage("");
      }
      setDataStatus("Supabase 已连接");
    } catch (error) {
      console.error(error);
      setAppProfiles(profiles);
      setVisits(initialVisits);
      setRoutes([]);
      setDataStatus("Supabase 暂不可用，正在显示本地示例数据");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadMaps() {
      try {
        const base = import.meta.env.BASE_URL;
        const [
          countriesResponse,
          statesResponse,
          citiesResponse,
          indexResponse,
        ] = await Promise.all([
          fetch(`${base}maps/countries.geojson`),
          fetch(`${base}maps/states.geojson`),
          fetch(`${base}maps/china-cities.geojson`),
          fetch(`${base}maps/place-index.json`),
        ]);
        if (
          !countriesResponse.ok ||
          !statesResponse.ok ||
          !citiesResponse.ok ||
          !indexResponse.ok
        ) {
          throw new Error("Map response was not ok");
        }
        const [countries, states, cities, placeIndex] = await Promise.all([
          countriesResponse.json(),
          statesResponse.json(),
          citiesResponse.json(),
          indexResponse.json(),
        ]);
        if (!cancelled) {
          const rawCountryPlaces = countries.features.map((feature) => normalizePlace(featureToPlace(feature)));
          const regionPlaces = states.features.map((feature) => normalizePlace(featureToPlace(feature)));
          const countryPlaces = applyChinaRegionGeometry(rawCountryPlaces, regionPlaces);
          const cityPlaces = linkChinaCityParents(
            regionPlaces,
            cities.features.map((feature) => normalizePlace(featureToPlace(feature))),
          );
          const searchIndex = linkChinaCityParents(
            regionPlaces,
            [...placeIndex.map(normalizePlace), ...SUPPLEMENTAL_PLACES.map(normalizePlace)],
          );
          setMapPlaces({
            country: countryPlaces,
            region: regionPlaces,
            city: cityPlaces,
          });
          setSearchPlaces(searchIndex);
          setMapStatus(
            `${countries.metadata?.countryCount || countries.features.length} 个国家，${states.features.length} 个中国省级单位，${cities.features.length} 个中国城市`,
          );
        }
      } catch {
        if (!cancelled) setMapStatus("真实边界未加载，使用示例边界");
      }
    }
    loadMaps();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await loadTravelData();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setSession(data.session);
    }

    boot();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage("");
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkEditor() {
      if (!session) {
        setIsEditor(false);
        return;
      }
      const { data, error } = await supabase.rpc("is_travelmap_editor");
      if (!cancelled) {
        setIsEditor(Boolean(data) && !error);
        if (error) setAuthMessage("登录成功，但暂时无法确认编辑权限。");
      }
    }

    checkEditor();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const cityPlaces = useMemo(
    () => searchPlaces.filter((place) => place.level === "city" && place.countryCode === "CHN"),
    [searchPlaces],
  );

  const placeLookup = useMemo(() => {
    const lookup = new Map();
    for (const place of places) lookup.set(place.id, place);
    for (const level of ["country", "region", "city"]) {
      for (const place of mapPlaces[level]) lookup.set(place.id, place);
    }
    for (const place of searchPlaces) {
      const existing = lookup.get(place.id);
      lookup.set(place.id, {
        ...existing,
        ...place,
        geometry: existing?.geometry || place.geometry,
      });
    }
    return lookup;
  }, [mapPlaces, searchPlaces]);

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const place = findPlace(visit.placeId, placeLookup);
      const chain = placeChain(visit.placeId, placeLookup);
      const country = chain.find((item) => item.level === "country");
      const text = `${formatPath(visit.placeId, placeLookup)} ${visit.note}`.toLowerCase();
      const year = visit.visitedAt ? visit.visitedAt.slice(0, 4) : "";
      const profileMatch =
        activeProfile === "all" || visit.profileId === activeProfile;
      const yearMatch = yearFilter === "all" || year === yearFilter;
      const regionMatch =
        regionFilter === "all" ||
        place?.region === regionFilter ||
        country?.region === regionFilter;
      const typeMatch = typeFilter === "all" || visit.type === typeFilter;
      const queryMatch = !query || text.includes(query.toLowerCase());
      return profileMatch && yearMatch && regionMatch && typeMatch && queryMatch;
    });
  }, [
    activeProfile,
    placeLookup,
    query,
    regionFilter,
    typeFilter,
    visits,
    yearFilter,
  ]);

  useEffect(() => {
    setQuickAddFocusRequest(null);
  }, [activeProfile, activeLevel]);

  const visitedByLevel = useMemo(() => {
    const result = new Map();
    for (const visit of filteredVisits) {
      const mapId = resolveMapIdForLevel(visit.placeId, activeLevel, placeLookup);
      if (!mapId) continue;
      const current = result.get(mapId) ?? {
        count: 0,
        profileIds: new Set(),
        visits: [],
      };
      current.count += 1;
      current.profileIds.add(visit.profileId);
      current.visits.push(visit);
      result.set(mapId, current);
    }
    return result;
  }, [activeLevel, filteredVisits, placeLookup]);

  const visitedByCountry = useMemo(() => {
    const result = new Map();
    for (const visit of filteredVisits) {
      const countryId = resolveMapIdForLevel(visit.placeId, "country", placeLookup);
      if (!countryId) continue;
      const current = result.get(countryId) ?? {
        count: 0,
        profileIds: new Set(),
        visits: [],
      };
      current.count += 1;
      current.profileIds.add(visit.profileId);
      current.visits.push(visit);
      result.set(countryId, current);
    }
    return result;
  }, [filteredVisits, placeLookup]);

  const displayPlaces = useMemo(() => {
    const loaded = mapPlaces[activeLevel];
    if (activeLevel === "city" && loaded.length > 0) {
      const { citiesByRegionId } = buildChinaRegionCityIndex(mapPlaces.region, loaded);
      const regionFallbacks = mapPlaces.region.filter(
        (place) =>
          place.countryCode === "CHN" &&
          (citiesByRegionId.get(place.id)?.length || 0) === 0,
      );
      return [...loaded, ...regionFallbacks];
    }
    return loaded.length > 0
      ? loaded
      : places.filter((place) => place.level === activeLevel);
  }, [activeLevel, mapPlaces]);

  const selectedVisits = useMemo(() => {
    const selected = findPlace(selectedPlaceId, placeLookup);
    if (!selected) return [];
    return filteredVisits.filter((visit) => {
      if (selected.level === "city") {
        return resolveMapIdForLevel(visit.placeId, "city", placeLookup) === selected.id;
      }
      return resolveMapIdForLevel(visit.placeId, selected.level, placeLookup) === selected.id;
    });
  }, [filteredVisits, placeLookup, selectedPlaceId]);

  const stats = useMemo(
    () => calculateVisitStats(filteredVisits, placeLookup),
    [filteredVisits, placeLookup],
  );

  const profileStats = useMemo(
    () =>
      appProfiles.map((profile) => ({
        profile,
        stats: calculateVisitStats(
          visits.filter((visit) => visit.profileId === profile.id),
          placeLookup,
        ),
      })),
    [appProfiles, placeLookup, visits],
  );

  const years = useMemo(
    () =>
      Array.from(new Set(visits.map((visit) => (visit.visitedAt ? visit.visitedAt.slice(0, 4) : "")).filter(Boolean))).sort(),
    [visits],
  );

  const visitedPlaceIds = useMemo(
    () => new Set(visits.map((visit) => canonicalPlaceId(visit.placeId))),
    [visits],
  );

  const visibleVisitedPlaceIds = useMemo(
    () => new Set(filteredVisits.map((visit) => canonicalPlaceId(visit.placeId))),
    [filteredVisits],
  );

  const visibleVisitedPlaces = useMemo(
    () => searchPlaces.filter((place) => visibleVisitedPlaceIds.has(canonicalPlaceId(place.id))),
    [searchPlaces, visibleVisitedPlaceIds],
  );

  const handleMapPlaceFocus = useCallback((placeId) => {
    setQuickAddFocusRequest({ placeId, token: Date.now() });
  }, []);

  const profileScopedVisits = useMemo(
    () =>
      activeProfile === "all"
        ? visits
        : visits.filter((visit) => visit.profileId === activeProfile),
    [activeProfile, visits],
  );

  const profileScopedVisitedPlaceIds = useMemo(
    () => new Set(profileScopedVisits.map((visit) => canonicalPlaceId(visit.placeId))),
    [profileScopedVisits],
  );

  const visitedCityVisits = useMemo(() => {
    const result = new Map();
    for (const visit of filteredVisits) {
      const cityId = resolveMapIdForLevel(visit.placeId, "city", placeLookup);
      if (!cityId) continue;
      const current = result.get(cityId) ?? [];
      current.push(visit);
      result.set(cityId, current);
    }
    return result;
  }, [filteredVisits, placeLookup]);

  const visitedCountries = useMemo(() => {
    const byId = new Map();
    for (const visit of filteredVisits) {
      const country = resolvePlaceForLevel(visit.placeId, "country", placeLookup);
      if (country?.id && country.id !== "ATA") byId.set(country.id, country);
    }
    return Array.from(byId.values()).sort((a, b) =>
      displayCountryName(a).localeCompare(displayCountryName(b), "zh-CN"),
    );
  }, [filteredVisits, placeLookup]);

  const selectedCountryId = useMemo(
    () => resolveMapIdForLevel(selectedPlaceId, "country", placeLookup) || "CHN",
    [placeLookup, selectedPlaceId],
  );

  const selectedCountry = findPlace(selectedCountryId, placeLookup);
  const modalCountry = countryModalId ? findPlace(countryModalId, placeLookup) : null;
  const activeMapTheme =
    MAP_THEMES.find((theme) => theme.id === activeMapThemeId) ?? MAP_THEMES[0];

  const selectedCountryPlaces = useMemo(
    () =>
      searchPlaces.filter(
        (place) =>
          place.countryCode === selectedCountryId &&
          place.level !== "country",
      ),
    [searchPlaces, selectedCountryId],
  );

  const selectedCountryVisits = useMemo(
    () =>
      filteredVisits.filter(
        (visit) =>
          resolveMapIdForLevel(visit.placeId, "country", placeLookup) === selectedCountryId,
      ),
    [filteredVisits, placeLookup, selectedCountryId],
  );

  const continentSummary = useMemo(
    () => buildContinentSummary(filteredVisits, placeLookup, mapPlaces.country),
    [filteredVisits, placeLookup, mapPlaces.country],
  );

  const profileContinentSummaries = useMemo(
    () =>
      appProfiles.map((profile) => ({
        profile,
        summary: buildContinentSummary(
          visits.filter((visit) => visit.profileId === profile.id),
          placeLookup,
          mapPlaces.country,
        ),
      })),
    [appProfiles, placeLookup, mapPlaces.country, visits],
  );

  const comparisonDiffs = useMemo(() => {
    if (appProfiles.length < 2) return null;
    const [leftProfile, rightProfile] = appProfiles;
    const leftVisits = visits.filter((visit) => visit.profileId === leftProfile.id);
    const rightVisits = visits.filter((visit) => visit.profileId === rightProfile.id);
    return {
      leftLabel: leftProfile.name,
      rightLabel: rightProfile.name,
      countries: buildPlaceDifference(
        collectUniquePlacesForLevel(leftVisits, placeLookup, "country"),
        collectUniquePlacesForLevel(rightVisits, placeLookup, "country"),
      ),
      regions: buildPlaceDifference(
        collectUniquePlacesForLevel(leftVisits, placeLookup, "region"),
        collectUniquePlacesForLevel(rightVisits, placeLookup, "region"),
      ),
      cities: buildPlaceDifference(
        collectUniquePlacesForLevel(leftVisits, placeLookup, "city"),
        collectUniquePlacesForLevel(rightVisits, placeLookup, "city"),
      ),
    };
  }, [appProfiles, placeLookup, visits]);

  const generatedJourneyVisuals = useMemo(
    () => buildJourneyPoints(filteredVisits, placeLookup),
    [filteredVisits, placeLookup],
  );

  const profileScopedRoutes = useMemo(
    () =>
      activeProfile === "all"
        ? routes
        : routes.filter((route) => route.profileId === activeProfile),
    [activeProfile, routes],
  );

  const routeArcs = useMemo(
    () => buildRouteArcs(profileScopedRoutes, placeLookup),
    [placeLookup, profileScopedRoutes],
  );

  const journeyVisuals = useMemo(
    () => ({
      points: generatedJourneyVisuals.points,
      arcs: routeArcs,
    }),
    [generatedJourneyVisuals.points, routeArcs],
  );

  const worldShapeDots = useMemo(
    () => buildWorldShapeDots(mapPlaces.country),
    [mapPlaces.country],
  );
  const [journeyVisualGateRef, isJourneyVisualsNear] = useNearViewport("260px");

  function changeLevel(levelId) {
    setActiveLevel(levelId);
    if (levelId === "region" || levelId === "city") {
      setSelectedPlaceId("CHN");
    }
  }

  async function saveVisit({ file, placeId, profileId, resetTarget, type, visitedAt }) {
    if (!session || !isEditor) {
      setAuthMessage("请先用已授权账号登录。");
      return false;
    }
    try {
      setIsSaving(true);
      setAuthMessage("");
      const targetCityId = resolveMapIdForLevel(placeId, "city", placeLookup) || canonicalPlaceId(placeId);
      const duplicateVisit = visits.find(
        (visit) =>
          visit.profileId === profileId &&
          (resolveMapIdForLevel(visit.placeId, "city", placeLookup) || canonicalPlaceId(visit.placeId)) === targetCityId,
      );
      if (duplicateVisit) {
        setEditingVisit(duplicateVisit);
        setAuthMessage("这个地点已经添加过，已打开原记录。");
        return false;
      }
      const normalizedDate = normalizeVisitDateInput(visitedAt);
      const { data: createdVisit, error: visitError } = await supabase
        .from("visits")
        .insert({
          profile_id: profileId,
          place_id: placeId,
          visited_at: normalizedDate.dbDate,
          trip_type: type || "旅行",
          note: buildVisitNote({
            dateDisplay: normalizedDate.display,
            datePrecision: normalizedDate.precision,
          }),
          created_by: session.user.id,
        })
        .select("id")
        .single();

      if (visitError) throw visitError;

      if (file && file.size) {
        const storagePath = `${session.user.id}/${createdVisit.id}/${Date.now()}-${safeStorageName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase.from("visit_photos").insert({
          visit_id: createdVisit.id,
          storage_path: storagePath,
          created_by: session.user.id,
        });
        if (photoError) throw photoError;
      }

      await loadTravelData();
      setSelectedPlaceId(resolveMapIdForLevel(placeId, activeLevel, placeLookup) || placeId);
      setAuthMessage("已保存到 Supabase。");
      resetTarget?.reset?.();
      return true;
    } catch (error) {
      console.error(error);
      setAuthMessage(`保存失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function addVisit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await saveVisit({
      file: form.get("photo"),
      placeId: form.get("placeId"),
      profileId: form.get("profileId"),
      resetTarget: formElement,
      type: form.get("type"),
      visitedAt: form.get("visitedAt"),
    });
  }

  async function addPlace(place, options = {}) {
    const targetProfile =
      options.profileId ||
      (activeProfile !== "all" ? activeProfile : appProfiles[0]?.id);
    if (!targetProfile) {
      setAuthMessage("还没有可用的人物档案。");
      return false;
    }
    return saveVisit({
      placeId: place.id,
      profileId: targetProfile,
      type: options.type || "旅行",
      visitedAt: options.visitedAt || "",
    });
  }

  async function deleteVisit(visitId) {
    if (!session || !isEditor) {
      setAuthMessage("请先用已授权账号登录。");
      return false;
    }
    const ok = window.confirm("确认删除这条足迹记录吗？");
    if (!ok) return false;
    try {
      setIsSaving(true);
      const { error } = await supabase.from("visits").delete().eq("id", visitId);
      if (error) throw error;
      await loadTravelData();
      setAuthMessage("已删除。");
      return true;
    } catch (error) {
      console.error(error);
      setAuthMessage(`删除失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateVisit(visitId, { file, rating, type, visitedAt }) {
    if (!session || !isEditor) {
      setEditMessage("请先用已授权账号登录。");
      return false;
    }
    try {
      setIsSaving(true);
      setEditMessage("");
      const normalizedDate = normalizeVisitDateInput(visitedAt);
      const { error: updateError } = await supabase
        .from("visits")
        .update({
          visited_at: normalizedDate.dbDate,
          trip_type: type || "旅行",
          note: buildVisitNote({
            dateDisplay: normalizedDate.display,
            datePrecision: normalizedDate.precision,
            rating,
          }),
        })
        .eq("id", visitId);

      if (updateError) throw updateError;

      if (file && file.size) {
        const storagePath = `${session.user.id}/${visitId}/${Date.now()}-${safeStorageName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase.from("visit_photos").insert({
          visit_id: visitId,
          storage_path: storagePath,
          created_by: session.user.id,
        });
        if (photoError) throw photoError;
      }

      await loadTravelData();
      setEditMessage("已更新足迹。");
      return true;
    } catch (error) {
      console.error(error);
      setEditMessage(`更新失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRoute({ endPlaceId, id, profileId, startPlaceId, transportMode, traveledAt }) {
    if (!session || !isEditor) {
      setRouteMessage("请先用已授权账号登录后再保存轨迹。");
      return false;
    }
    if (!profileId || !startPlaceId || !endPlaceId) {
      setRouteMessage("请选择人物、起点和终点。");
      return false;
    }
    if (canonicalPlaceId(startPlaceId) === canonicalPlaceId(endPlaceId)) {
      setRouteMessage("起点和终点不能是同一个地点。");
      return false;
    }
    try {
      setIsSaving(true);
      setRouteMessage("");
      const normalizedDate = normalizeVisitDateInput(traveledAt);
      const payload = {
        profile_id: profileId,
        start_place_id: startPlaceId,
        end_place_id: endPlaceId,
        traveled_at: normalizedDate.dbDate,
        note: buildVisitNote({
          dateDisplay: normalizedDate.display,
          datePrecision: normalizedDate.precision,
          transportMode,
        }),
        created_by: session.user.id,
      };
      const result = id
        ? await supabase.from("travel_routes").update(payload).eq("id", id)
        : await supabase.from("travel_routes").insert(payload);
      if (result.error) throw result.error;
      await loadTravelData();
      setRouteMessage(id ? "轨迹已更新。" : "轨迹已保存。");
      return true;
    } catch (error) {
      console.error(error);
      setRouteMessage(`轨迹保存失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRoute(routeId) {
    if (!session || !isEditor) {
      setRouteMessage("请先用已授权账号登录后再删除轨迹。");
      return false;
    }
    const ok = window.confirm("确认删除这条轨迹吗？");
    if (!ok) return false;
    try {
      setIsSaving(true);
      setRouteMessage("");
      const { error } = await supabase.from("travel_routes").delete().eq("id", routeId);
      if (error) throw error;
      await loadTravelData();
      setRouteMessage("轨迹已删除。");
      return true;
    } catch (error) {
      console.error(error);
      setRouteMessage(`轨迹删除失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setAuthMessage("正在登录");
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password"),
    });
    setAuthMessage(error ? `登录失败：${error.message}` : "登录成功。");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAuthMessage("已退出登录。");
  }

  async function updateProfileNames(nextNames) {
    if (!session || !isEditor) {
      setProfileSettingsMessage("请先登录有编辑权限的账号。");
      return false;
    }
    const cleanedNames = nextNames.map((name) => name.trim());
    if (cleanedNames.some((name) => !name)) {
      setProfileSettingsMessage("两个人的名字都不能为空。");
      return false;
    }
    try {
      setIsSaving(true);
      setProfileSettingsMessage("");
      const orderedProfiles = sortProfilesStable(appProfiles);
      const results = await Promise.all(
        orderedProfiles.map((profile, index) =>
          supabase
            .from("travel_profiles")
            .update({ display_name: cleanedNames[index] })
            .eq("id", profile.id),
        ),
      );
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      await loadTravelData();
      setProfileSettingsMessage("名字已保存。");
      return true;
    } catch (error) {
      console.error(error);
      setProfileSettingsMessage(`保存失败：${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TravelMapX</p>
          <h1>足迹地图</h1>
        </div>
        <div
          className="status-strip"
          aria-label="项目状态"
          onClick={() => setAuthPanelOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setAuthPanelOpen(true);
          }}
          role="button"
          tabIndex={0}
        >
          <span>
            <Database size={16} /> {session ? "已登录" : "未登录"}
          </span>
          <span>
            <ShieldCheck size={16} /> {session && isEditor ? "可编辑" : dataStatus}
          </span>
        </div>
      </header>

      <section className="control-band" aria-label="地图控制">
        <div className="segmented">
          {profileFilters.map((profile) => (
            <button
              className={activeProfile === profile.id ? "active" : ""}
              key={profile.id}
              onClick={() => setActiveProfile(profile.id)}
              type="button"
            >
              <Users size={16} />
              {profile.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {placeLevels.map((level) => (
            <button
              className={activeLevel === level.id ? "active" : ""}
              key={level.id}
              onClick={() => changeLevel(level.id)}
              title={level.description}
              type="button"
            >
              <Layers3 size={16} />
              {level.label}
            </button>
          ))}
        </div>
      </section>

      <section className="metric-grid three" aria-label="统计数据">
        {activeProfile === "all" ? (
          <>
            <ComparisonMetric
              icon={<Globe2 />}
              label="去过国家"
              popover={comparisonDiffs && <ComparisonDiffPopover diff={comparisonDiffs.countries} leftLabel={comparisonDiffs.leftLabel} rightLabel={comparisonDiffs.rightLabel} type="country" />}
              rows={profileStats.map((item) => ({ label: item.profile.name, value: item.stats.countries }))}
            />
            <ComparisonMetric
              icon={<Layers3 />}
              label="去过中国省州"
              popover={comparisonDiffs && <ComparisonDiffPopover diff={comparisonDiffs.regions} leftLabel={comparisonDiffs.leftLabel} rightLabel={comparisonDiffs.rightLabel} type="text" />}
              rows={profileStats.map((item) => ({ label: item.profile.name, value: item.stats.regions }))}
            />
            <ComparisonMetric
              icon={<MapPinned />}
              label="去过城市"
              popover={comparisonDiffs && <ComparisonDiffPopover diff={comparisonDiffs.cities} leftLabel={comparisonDiffs.leftLabel} rightLabel={comparisonDiffs.rightLabel} type="text" />}
              rows={profileStats.map((item) => ({ label: item.profile.name, value: item.stats.cities, detail: `国内 / 国际 ${item.stats.domesticCities} / ${item.stats.internationalCities}` }))}
            />
          </>
        ) : (
          <>
            <Metric
              icon={<Globe2 />}
              label="去过国家"
              popover={
                visitedCountries.length > 0 && (
                  <div className="metric-flag-popover">
                    {visitedCountries.map((country) => (
                      <span key={country.id} title={displayCountryName(country)}>
                        <FlagIcon place={country} />
                      </span>
                    ))}
                  </div>
                )
              }
              value={stats.countries}
            />
            <Metric icon={<Layers3 />} label="去过中国省州" value={stats.regions} />
            <Metric
              detail={`国内 / 国际 ${stats.domesticCities} / ${stats.internationalCities}`}
              icon={<MapPinned />}
              label="去过城市"
              value={stats.cities}
            />
          </>
        )}
      </section>

      <section className="workspace">
        <QuickAddDock
          activeProfile={activeProfile}
          addPlace={addPlace}
          authMessage={authMessage}
          isEditor={isEditor}
          isSaving={isSaving}
          onEditVisit={openVisitEditor}
          onSignIn={signIn}
          onSignOut={signOut}
          profiles={appProfiles}
          searchPlaces={searchPlaces}
          session={session}
          visitedPlaceIds={profileScopedVisitedPlaceIds}
          visits={profileScopedVisits}
          onDeleteVisit={deleteVisit}
          focusRequest={quickAddFocusRequest}
          onFocusConsumed={() => setQuickAddFocusRequest(null)}
        />
        <MapView
          activeLevel={activeLevel}
          activeProfile={activeProfile}
          countryPlaces={mapPlaces.country}
          displayPlaces={displayPlaces}
          mapStatus={mapStatus}
          mapTheme={activeMapTheme}
          mapThemes={ORDERED_MAP_THEMES}
          placeLookup={placeLookup}
          profiles={appProfiles}
          regionPlaces={mapPlaces.region}
          selectedPlaceId={selectedPlaceId}
          setSelectedPlaceId={setSelectedPlaceId}
          setMapThemeId={setActiveMapThemeId}
          onCountryOpen={setCountryModalId}
          visitedByLevel={visitedByLevel}
          visitedByCountry={visitedByCountry}
          visitedCityVisits={visitedCityVisits}
          visitedPlaces={visibleVisitedPlaces}
          onPlaceFocus={handleMapPlaceFocus}
        />
      </section>

      {modalCountry && (
          <CountryModal
            activeProfile={activeProfile}
          addPlace={addPlace}
          authMessage={authMessage}
          cityPlaces={mapPlaces.city}
          country={modalCountry}
          countryPlaces={searchPlaces.filter(
            (place) => place.countryCode === modalCountry.id && place.level !== "country",
          )}
          isEditor={isEditor}
          isSaving={isSaving}
          onEditVisit={openVisitEditor}
          onClose={() => {
            setCountryModalId(null);
            setQuickAddFocusRequest(null);
          }}
          onDeleteVisit={deleteVisit}
            profiles={appProfiles}
          regionPlaces={mapPlaces.region}
          placeLookup={placeLookup}
          session={session}
          visits={filteredVisits.filter(
            (visit) =>
              resolveMapIdForLevel(visit.placeId, "country", placeLookup) === modalCountry.id,
          )}
          visitedPlaceIds={visitedPlaceIds}
          visitedByLevel={visitedByLevel}
        />
      )}

      <TravelOverview
        activeProfile={activeProfile}
        continentSummary={continentSummary}
        placeLookup={placeLookup}
        profileSummaries={profileContinentSummaries}
      />
      <div
        className={`journey-visual-gate ${isJourneyVisualsNear ? "active" : "idle"}`}
        ref={journeyVisualGateRef}
      >
        {isJourneyVisualsNear ? (
          <JourneyVisuals
            arcs={journeyVisuals.arcs}
            isEditor={isEditor}
            isSaving={isSaving}
            onDeleteRoute={deleteRoute}
            onSaveRoute={saveRoute}
            points={journeyVisuals.points}
            profiles={appProfiles}
            routeMessage={routeMessage}
            routes={profileScopedRoutes}
            searchPlaces={searchPlaces}
            session={session}
            visits={visits}
            worldDots={worldShapeDots}
          />
        ) : (
          <section className="journey-visual-placeholder" aria-label="足迹视觉展示">
            <p className="eyebrow">Visual Journey</p>
            <h2>足迹可视化</h2>
            <span>继续向下滚动时加载球形足迹与点阵轨迹</span>
          </section>
        )}
      </div>
      {editingVisit && (
        <VisitEditDialog
          authMessage={editMessage}
          isSaving={isSaving}
          onClose={() => setEditingVisit(null)}
          onDeleteVisit={deleteVisit}
          onUpdateVisit={updateVisit}
          place={findPlace(editingVisit.placeId, placeLookup)}
          visit={editingVisit}
        />
      )}
      {authPanelOpen && (
        <AuthDialog
          authMessage={authMessage}
          isEditor={isEditor}
          onClose={() => setAuthPanelOpen(false)}
          onSignIn={signIn}
          onSignOut={signOut}
          session={session}
        />
      )}
      <ProfileNameSettings
        isEditor={isEditor}
        isOpen={profileSettingsOpen}
        isSaving={isSaving}
        message={profileSettingsMessage}
        onClose={() => setProfileSettingsOpen(false)}
        onOpen={() => {
          setProfileSettingsMessage("");
          setProfileSettingsOpen(true);
        }}
        onSave={updateProfileNames}
        profiles={appProfiles}
        session={session}
      />
    </main>
  );
}

function ProfileNameSettings({
  isEditor,
  isOpen,
  isSaving,
  message,
  onClose,
  onOpen,
  onSave,
  profiles,
  session,
}) {
  const [names, setNames] = useState(profiles.map((profile) => profile.name));

  useEffect(() => {
    if (isOpen) setNames(profiles.map((profile) => profile.name));
  }, [isOpen, profiles]);

  async function submit(event) {
    event.preventDefault();
    await onSave(names);
  }

  return (
    <>
      <button
        aria-label="修改两个人的名字"
        className="hidden-profile-trigger"
        onClick={onOpen}
        title="修改名字"
        type="button"
      >
        <SlidersHorizontal size={17} />
      </button>
      {isOpen && (
        <div className="profile-settings-popover" role="dialog" aria-label="修改名字">
          <header>
            <div>
              <p className="eyebrow">Names</p>
              <strong>修改显示名字</strong>
            </div>
            <button aria-label="关闭" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </header>
          <form onSubmit={submit}>
            {profiles.map((profile, index) => (
              <label key={profile.id}>
                第 {index + 1} 个人
                <input
                  disabled={!session || !isEditor || isSaving}
                  onChange={(event) => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                  }}
                  value={names[index] || ""}
                />
              </label>
            ))}
            {!session && <p className="form-message">当前未登录，登录编辑账号后才能保存。</p>}
            {session && !isEditor && <p className="form-message">当前账号没有编辑权限。</p>}
            {message && <p className="form-message">{message}</p>}
            <button
              className="primary-action"
              disabled={!session || !isEditor || isSaving}
              type="submit"
            >
              {isSaving ? "保存中..." : "保存名字"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function JourneyVisuals({
  arcs,
  isEditor,
  isSaving,
  onDeleteRoute,
  onSaveRoute,
  points,
  profiles,
  routeMessage,
  routes,
  searchPlaces,
  session,
  visits,
  worldDots,
}) {
  return (
    <section className="journey-visual-section" aria-label="足迹视觉展示">
      <div className="section-title">
        <p className="eyebrow">Visual Journey</p>
        <h2>足迹可视化</h2>
      </div>
      <div className="journey-visual-grid">
        <AceternityStyleGlobe
          arcs={arcs}
          isEditor={isEditor}
          isSaving={isSaving}
          onDeleteRoute={onDeleteRoute}
          onSaveRoute={onSaveRoute}
          points={points}
          profiles={profiles}
          routeMessage={routeMessage}
          routes={routes}
          searchPlaces={searchPlaces}
          session={session}
          visits={visits}
          worldDots={worldDots}
        />
        <AceternityStyleWorldMap arcs={arcs} points={points} worldDots={worldDots} />
      </div>
    </section>
  );
}

function projectAceternityGlobePoint(point, rotation, radius = 43) {
  const rad = Math.PI / 180;
  const lat = point.lat * rad;
  const lon = (point.lng + rotation) * rad;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  return {
    x: 50 + x * radius,
    y: 50 - y * radius,
    z,
    visible: z > -0.16,
    opacity: Math.max(0.08, Math.min(1, (z + 1) / 1.48)),
  };
}

function aceternityGlobeArcSegments(arc, rotation) {
  let startLng = arc.start.lng;
  let endLng = arc.end.lng;
  const delta = endLng - startLng;
  if (delta > 180) endLng -= 360;
  if (delta < -180) endLng += 360;
  const segments = [];
  let current = [];
  for (let index = 0; index <= 32; index += 1) {
    const t = index / 32;
    const lat = arc.start.lat + (arc.end.lat - arc.start.lat) * t;
    const lng = startLng + (endLng - startLng) * t;
    const lift = Math.sin(Math.PI * t) * 2.8;
    const projected = projectAceternityGlobePoint({ lat, lng }, rotation, 43 + lift);
    if (projected.z > 0.02) {
      current.push(projected);
    } else if (current.length > 1) {
      segments.push(current);
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments.map((segment) =>
    segment
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" "),
  );
}

function RoutePlanner({
  isEditor,
  isSaving,
  message,
  onDeleteRoute,
  onSaveRoute,
  profiles = [],
  routes = [],
  searchPlaces = [],
  session,
  visits = [],
}) {
  const [open, setOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [startPlace, setStartPlace] = useState(null);
  const [endPlace, setEndPlace] = useState(null);
  const [traveledAt, setTraveledAt] = useState("");
  const [transportMode, setTransportMode] = useState("flight");
  const plannerRef = useRef(null);

  const placeLookup = useMemo(() => {
    const lookup = new Map();
    searchPlaces.forEach((place) => lookup.set(place.id, place));
    return lookup;
  }, [searchPlaces]);

  const routeSearchPlaces = useMemo(() => {
    if (!profileId) return [];
    const visitedIds = new Set(
      visits
        .filter((visit) => visit.profileId === profileId)
        .map((visit) => canonicalPlaceId(visit.placeId)),
    );
    return searchPlaces
      .filter((place) => {
        const id = canonicalPlaceId(place.id);
        const mapId = canonicalPlaceId(place.mapId || place.id);
        return place.level === "city" && (visitedIds.has(id) || visitedIds.has(mapId));
      })
      .sort((a, b) => displayPlaceName(a).localeCompare(displayPlaceName(b), "zh-CN"));
  }, [profileId, searchPlaces, visits]);

  useEffect(() => {
    if (!profileId && profiles[0]) setProfileId(profiles[0].id);
  }, [profileId, profiles]);

  useEffect(() => {
    const allowedIds = new Set(routeSearchPlaces.map((place) => canonicalPlaceId(place.id)));
    if (startPlace && !allowedIds.has(canonicalPlaceId(startPlace.id))) setStartPlace(null);
    if (endPlace && !allowedIds.has(canonicalPlaceId(endPlace.id))) setEndPlace(null);
  }, [endPlace, routeSearchPlaces, startPlace]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (plannerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function resetForm() {
    setEditingRoute(null);
    setStartPlace(null);
    setEndPlace(null);
    setTraveledAt("");
    setTransportMode("flight");
  }

  function startEdit(route) {
    setEditingRoute(route);
    setProfileId(route.profileId || profiles[0]?.id || "");
    setStartPlace(placeLookup.get(route.startPlaceId) || null);
    setEndPlace(placeLookup.get(route.endPlaceId) || null);
    setTraveledAt(route.dateDisplay || route.traveledAt || "");
    setTransportMode(route.transportMode || "flight");
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    const ok = await onSaveRoute?.({
      id: editingRoute?.id,
      profileId,
      startPlaceId: startPlace?.id,
      endPlaceId: endPlace?.id,
      transportMode,
      traveledAt,
    });
    if (ok) resetForm();
  }

  return (
    <div className={`route-planner ${open ? "open" : ""}`} ref={plannerRef}>
      <button className="route-planner-trigger" onClick={() => setOpen((value) => !value)} type="button">
        <Plus size={15} />
        轨迹
      </button>
      {open && (
        <div className="route-planner-popover">
          <header>
            <div>
              <p className="eyebrow">Routes</p>
              <strong>{editingRoute ? "编辑轨迹" : "添加轨迹"}</strong>
            </div>
            <button aria-label="关闭轨迹面板" onClick={() => setOpen(false)} type="button">
              <X size={16} />
            </button>
          </header>
          <form className="route-form" onSubmit={submit}>
            <select
              disabled={!session || !isEditor}
              onChange={(event) => setProfileId(event.target.value)}
              value={profileId}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <RoutePlacePicker
              disabled={!session || !isEditor}
              label="起点"
              onSelect={setStartPlace}
              places={routeSearchPlaces}
              selected={startPlace}
            />
            <RoutePlacePicker
              disabled={!session || !isEditor}
              label="终点"
              onSelect={setEndPlace}
              places={routeSearchPlaces}
              selected={endPlace}
            />
            <select
              disabled={!session || !isEditor}
              onChange={(event) => setTransportMode(event.target.value)}
              value={transportMode}
            >
              {routeTransportOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <DatePrecisionInput disabled={!session || !isEditor} onChange={setTraveledAt} value={traveledAt} />
            <div className="route-form-actions">
              {editingRoute && (
                <button onClick={resetForm} type="button">
                  取消编辑
                </button>
              )}
              <button disabled={!session || !isEditor || isSaving || !startPlace || !endPlace} type="submit">
                {isSaving ? "保存中..." : editingRoute ? "保存修改" : "保存轨迹"}
              </button>
            </div>
          </form>
          {message && <p className="route-message">{message}</p>}
          <div className="route-list">
            <p>已添加轨迹</p>
            {routes.length === 0 && <small>还没有正式保存的轨迹。</small>}
            {routes.map((route) => {
              const start = placeLookup.get(route.startPlaceId);
              const end = placeLookup.get(route.endPlaceId);
              return (
                <div className="route-list-item" key={route.id}>
                  <span>
                    <strong>
                      {start ? displayPlaceName(start) : route.startPlaceId} → {end ? displayPlaceName(end) : route.endPlaceId}
                    </strong>
                    <small>{routeTransportLabel(route.transportMode)} · {route.dateDisplay || "未填写日期"}</small>
                  </span>
                  <span className="route-list-actions">
                    <button disabled={isSaving} onClick={() => startEdit(route)} type="button">
                      <Pencil size={13} />
                    </button>
                    <button disabled={isSaving} onClick={() => onDeleteRoute?.(route.id)} type="button">
                      <X size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RoutePlacePicker({ disabled, label, onSelect, places, selected }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return places
      .filter((place) => placeSearchText(place).includes(needle))
      .sort((a, b) => displayPlaceName(a).localeCompare(displayPlaceName(b), "zh-CN"))
      .slice(0, 60);
  }, [places, query]);

  return (
    <label className="route-place-picker">
      <span>{label}</span>
      <input
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={selected ? displayPlaceName(selected) : `搜索${label}地点`}
        value={query}
      />
      {selected && (
        <em>
          <FlagIcon place={selected} />
          {displayPlaceName(selected)}
        </em>
      )}
      {query.trim() && results.length > 0 && (
        <div className="route-place-results">
          {results.map((place) => (
            <button
              key={place.id}
              onClick={() => {
                onSelect(place);
                setQuery("");
              }}
              type="button"
            >
              <FlagIcon place={place} />
              <span>
                <strong>{displayPlaceName(place)}</strong>
                <small>{displayCountryName({ id: place.countryCode, isoA2: place.isoA2, localName: place.countryName })}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function AceternityStyleGlobe({
  arcs,
  isEditor,
  isSaving,
  onDeleteRoute,
  onSaveRoute,
  points,
  profiles,
  routeMessage,
  routes,
  searchPlaces,
  session,
  visits,
  worldDots,
}) {
  const [rotation, setRotation] = useState(-112);
  const [zoom, setZoom] = useState(0.88);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [resetTick, setResetTick] = useState(0);
  const globeSvgRef = useRef(null);
  const dragRef = useRef({ active: false, x: 0 });
  const [cardRef, isVisualActive] = useNearViewport("420px");
  const speed = GLOBE_SPEEDS[speedIndex];

  useEffect(() => {
    if (!isVisualActive) return undefined;
    const timer = window.setInterval(() => {
      if (!dragRef.current.active) {
        setRotation((value) => (value + 0.42 * speed * 2) % 360);
      }
    }, 70);
    return () => window.clearInterval(timer);
  }, [isVisualActive, speed]);

  useEffect(() => {
    const globe = globeSvgRef.current;
    if (!globe) return undefined;
    const handleNativeWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setZoom((value) => Math.max(0.72, Math.min(1.28, value + (event.deltaY < 0 ? 0.06 : -0.06))));
    };
    globe.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => globe.removeEventListener("wheel", handleNativeWheel);
  }, []);

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (!dragRef.current.active) return;
      event.preventDefault();
      const dx = event.clientX - dragRef.current.x;
      dragRef.current.x = event.clientX;
      setRotation((value) => (value + dx * 0.55 + 360) % 360);
    };
    const handleWindowPointerUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, []);

  function changeSpeed(direction) {
    setSpeedIndex((value) => Math.max(0, Math.min(GLOBE_SPEEDS.length - 1, value + direction)));
  }

  function resetGlobes() {
    dragRef.current.active = false;
    setRotation(-112);
    setZoom(0.88);
    setSpeedIndex(2);
    setResetTick((value) => value + 1);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { active: true, x: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function finishDrag(event) {
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  const landDots = useMemo(
    () =>
      worldDots
        .filter((_, index) => index % 2 === 0)
        .map((point) => ({ ...point, ...projectAceternityGlobePoint(point, rotation, 42.7) }))
        .filter((point) => point.visible),
    [rotation, worldDots],
  );

  const projectedPoints = useMemo(
    () =>
      points
        .slice(0, 150)
        .map((point) => ({ ...point, ...projectAceternityGlobePoint(point, rotation, 44) }))
        .filter((point) => point.visible),
    [points, rotation],
  );

  const routeSegments = useMemo(
    () =>
      arcs
        .slice(0, 22)
        .flatMap((arc) => aceternityGlobeArcSegments(arc, rotation))
        .slice(0, 30),
    [arcs, rotation],
  );

  return (
    <article
      className={`journey-card globe-card aceternity-globe-card ${isVisualActive ? "visual-active" : "visual-paused"}`}
      ref={cardRef}
    >
      <div>
        <div>
          <p className="eyebrow">Globe</p>
          <h3>球形足迹</h3>
        </div>
        <div className="globe-card-actions">
          <span>{points.length} 个地点</span>
          <button className="globe-reset-button" type="button" onClick={resetGlobes} aria-label="重置两个球体">
            <RotateCcw size={15} />
          </button>
          <div className="globe-speed-control" aria-label="调整球体转速">
            <button
              aria-label="减慢地球转速"
              disabled={speedIndex === 0}
              onClick={() => changeSpeed(-1)}
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <strong>{speed.toFixed(1)}x</strong>
            <button
              aria-label="加快地球转速"
              disabled={speedIndex === GLOBE_SPEEDS.length - 1}
              onClick={() => changeSpeed(1)}
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      <RoutePlanner
        isEditor={isEditor}
        isSaving={isSaving}
        message={routeMessage}
        onDeleteRoute={onDeleteRoute}
        onSaveRoute={onSaveRoute}
        profiles={profiles}
        routes={routes}
        searchPlaces={searchPlaces}
        session={session}
        visits={visits}
      />
      <div className="globe-visual-pair">
      <svg
        className="aceternity-globe"
        onPointerCancel={finishDrag}
        onPointerDown={handlePointerDown}
        onPointerUp={finishDrag}
        ref={globeSvgRef}
        role="img"
        style={{ "--globe-zoom": zoom }}
        viewBox="0 0 100 100"
        aria-label="球形地球足迹"
      >
        <defs>
          <radialGradient id="aceternityGlobeSurface" cx="42%" cy="22%" r="82%">
            <stop offset="0%" stopColor="#123a74" />
            <stop offset="38%" stopColor="#061a56" />
            <stop offset="72%" stopColor="#020617" />
            <stop offset="100%" stopColor="#e6f6ff" />
          </radialGradient>
          <radialGradient id="aceternityGlobeShade" cx="50%" cy="22%" r="82%">
            <stop offset="0%" stopColor="#ffffff00" />
            <stop offset="63%" stopColor="#ffffff00" />
            <stop offset="100%" stopColor="#e0f7ffdd" />
          </radialGradient>
          <clipPath id="aceternityGlobeClip">
            <circle cx="50" cy="50" r="42.8" />
          </clipPath>
          <filter id="aceternityPointGlow">
            <feGaussianBlur stdDeviation="1.35" />
          </filter>
        </defs>
        <circle cx="50" cy="50" r="42.8" fill="url(#aceternityGlobeSurface)" />
        <g clipPath="url(#aceternityGlobeClip)">
          {landDots.map((point) => (
            <circle
              cx={point.x}
              cy={point.y}
              fill="#78c8ff"
              key={point.id}
              opacity={point.opacity * 0.45}
              r="0.22"
            />
          ))}
          {routeSegments.map((path, index) => (
            <path
              className="globe-route"
              d={path}
              key={`globe-route-${index}`}
            />
          ))}
          {projectedPoints.map((point, index) => (
            <g className="globe-visit-point" key={point.id}>
              <circle cx={point.x} cy={point.y} fill="#38bdf8" filter="url(#aceternityPointGlow)" opacity="0.2" r="1.32" />
              <circle cx={point.x} cy={point.y} fill="#0284c7" r="0.52" />
              {index % 8 === 0 && <circle className="globe-ring" cx={point.x} cy={point.y} fill="none" r="0.82" />}
            </g>
          ))}
        </g>
        <circle cx="50" cy="50" r="42.8" fill="url(#aceternityGlobeShade)" />
        <circle cx="50" cy="50" r="42.8" fill="none" stroke="#cbeeff" strokeOpacity="0.58" strokeWidth="0.72" />
      </svg>
        <SatellitePinGlobe active={isVisualActive} points={points} resetTick={resetTick} speed={speed} />
      </div>
    </article>
  );
}

function createPinTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(0,0,0,0.55)";
  context.shadowBlur = 10;
  context.shadowOffsetY = 4;
  context.font = "64px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("📍", 48, 49);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function SatellitePinGlobe({ active, points, resetTick, speed }) {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const activeRef = useRef(active);
  const satelliteZoomRef = useRef(1.08);

  useEffect(() => {
    activeRef.current = active;
    if (controlsRef.current) controlsRef.current.autoRotate = active;
  }, [active]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotateSpeed = 2 * speed;
  }, [speed]);

  useEffect(() => {
    const mount = mountRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!mount || !camera || !controls) return;
    satelliteZoomRef.current = 1.08;
    mount.style.setProperty("--satellite-zoom", "1.08");
    camera.position.set(0, 0, 7);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [resetTick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 520;
    const height = mount.clientHeight || width;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minDistance = 4.45;
    controls.maxDistance = 9.2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2 * speed;
    controlsRef.current = controls;
    mount.style.setProperty("--satellite-zoom", satelliteZoomRef.current.toFixed(2));

    const basePath = import.meta.env.BASE_URL || "/";
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(`${basePath}textures/earth-blue-marble.jpg`);
    const bumpTexture = textureLoader.load(`${basePath}textures/earth-topology.png`);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    earthTexture.anisotropy = 16;
    bumpTexture.anisotropy = 8;

    const globeRoot = new THREE.Group();
    globeRoot.rotation.y = THREE.MathUtils.degToRad(-110);
    scene.add(globeRoot);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(2, 96, 96),
      new THREE.MeshStandardMaterial({
        map: earthTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.05,
        roughness: 0.7,
        metalness: 0,
      }),
    );
    globeRoot.add(earth);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.08, 96, 96),
      new THREE.MeshBasicMaterial({
        color: "#7dd3fc",
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    atmosphere.visible = false;
    globeRoot.add(atmosphere);

    scene.add(new THREE.AmbientLight("#d8f4ff", 0.9));
    const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
    keyLight.position.set(4.2, 3.4, 5.6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight("#7dd3fc", 1.4);
    rimLight.position.set(-4, 1.3, -2.5);
    scene.add(rimLight);

    const markerGroup = new THREE.Group();
    const pinHeadGeometry = new THREE.SphereGeometry(0.026, 18, 18);
    const pinStemGeometry = new THREE.CylinderGeometry(0.0032, 0.0032, 0.08, 8);
    const pinHeadMaterial = new THREE.MeshPhongMaterial({
      color: "#f43f72",
      emissive: "#7f1232",
      emissiveIntensity: 0.12,
      shininess: 54,
    });
    const pinStemMaterial = new THREE.MeshPhongMaterial({
      color: "#d6d3d1",
      shininess: 28,
    });
    const localUp = new THREE.Vector3(0, 1, 0);
    points.forEach((point) => {
      const normal = latLngToVector3(point.lat, point.lng, 1).normalize();
      const pin = new THREE.Group();
      pin.quaternion.setFromUnitVectors(localUp, normal);
      pin.userData.normal = normal;
      pin.userData.surfacePosition = normal.clone().multiplyScalar(2);

      const stem = new THREE.Mesh(pinStemGeometry, pinStemMaterial);
      stem.position.set(0, 2.05, 0);
      const head = new THREE.Mesh(pinHeadGeometry, pinHeadMaterial);
      head.position.set(0, 2.11, 0);
      pin.add(stem, head);
      markerGroup.add(pin);
    });
    globeRoot.add(markerGroup);

    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      satelliteZoomRef.current = THREE.MathUtils.clamp(
        satelliteZoomRef.current + (event.deltaY < 0 ? 0.06 : -0.06),
        0.72,
        1.28,
      );
      mount.style.setProperty("--satellite-zoom", satelliteZoomRef.current.toFixed(2));
    };
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width || width;
      const nextHeight = entry.contentRect.height || nextWidth;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(mount);

    let frame = 0;
    let idleTimer = 0;
    let disposed = false;
    const renderScene = () => {
      controls.update();
      markerGroup.children.forEach((pin) => {
        const worldNormal = pin.userData.normal.clone().applyQuaternion(globeRoot.quaternion);
        const worldSurface = pin.userData.surfacePosition.clone().applyQuaternion(globeRoot.quaternion);
        const toCamera = camera.position.clone().sub(worldSurface).normalize();
        pin.visible = worldNormal.dot(toCamera) > 0.08;
      });
      renderer.render(scene, camera);
    };
    const schedule = () => {
      if (disposed) return;
      if (activeRef.current) {
        frame = window.requestAnimationFrame(animate);
      } else {
        idleTimer = window.setTimeout(animate, 500);
      }
    };
    const animate = () => {
      frame = 0;
      idleTimer = 0;
      if (activeRef.current) {
        renderScene();
      }
      schedule();
    };
    renderScene();
    schedule();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      cameraRef.current = null;
      controlsRef.current = null;
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("wheel", handleWheel);
      controls.dispose();
      earth.geometry.dispose();
      earth.material.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      pinHeadGeometry.dispose();
      pinStemGeometry.dispose();
      pinHeadMaterial.dispose();
      pinStemMaterial.dispose();
      earthTexture.dispose();
      bumpTexture.dispose();
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [points]);

  return (
    <div
      aria-label="真实纹理 3D 地球足迹"
      className="satellite-globe satellite-globe-mount"
      ref={mountRef}
      role="img"
    />
  );

  const textureOffset = ((rotation % 360) / 360) * -42;
  const pins = useMemo(
    () =>
      points
        .slice(0, 180)
        .map((point) => ({ ...point, ...projectAceternityGlobePoint(point, rotation - 32, 40.5) }))
        .filter((point) => point.z > 0.08)
        .sort((a, b) => a.z - b.z)
        .slice(-18),
    [points, rotation],
  );

  return (
    <svg className="satellite-globe" viewBox="0 0 100 100" role="img" aria-label="遥感风格地球足迹">
      <defs>
        <radialGradient id="satelliteOcean" cx="34%" cy="26%" r="74%">
          <stop offset="0%" stopColor="#244f86" />
          <stop offset="42%" stopColor="#071f46" />
          <stop offset="74%" stopColor="#020817" />
          <stop offset="100%" stopColor="#00030a" />
        </radialGradient>
        <linearGradient id="satelliteLand" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#e2e7cf" />
          <stop offset="36%" stopColor="#8ea15f" />
          <stop offset="72%" stopColor="#694b2f" />
          <stop offset="100%" stopColor="#2f3f2b" />
        </linearGradient>
        <linearGradient id="satelliteIce" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b7d9f1" />
        </linearGradient>
        <radialGradient id="satelliteShade" cx="66%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#00000000" />
          <stop offset="54%" stopColor="#00000018" />
          <stop offset="100%" stopColor="#000000c5" />
        </radialGradient>
        <radialGradient id="satelliteBottomGlow" cx="54%" cy="118%" r="56%">
          <stop offset="0%" stopColor="#eafafff0" />
          <stop offset="42%" stopColor="#b9dcef91" />
          <stop offset="100%" stopColor="#ffffff00" />
        </radialGradient>
        <pattern id="satelliteSpeckles" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
          <circle cx="0.75" cy="0.75" r="0.18" fill="#dff7ff" opacity="0.2" />
        </pattern>
        <clipPath id="satelliteGlobeClip">
          <circle cx="50" cy="50" r="42.5" />
        </clipPath>
        <filter id="satelliteBlur">
          <feGaussianBlur stdDeviation="0.45" />
        </filter>
      </defs>
      <circle cx="50" cy="50" r="42.5" fill="url(#satelliteOcean)" />
      <g clipPath="url(#satelliteGlobeClip)">
        <rect x="6" y="6" width="88" height="88" fill="url(#satelliteSpeckles)" opacity="0.7" />
        <g className="satellite-texture" transform={`translate(${textureOffset.toFixed(2)} 0)`}>
          {[-44, 0, 44].map((offset) => (
            <g key={offset} transform={`translate(${offset} 0)`}>
              <path className="satellite-land" d="M26 20 C34 10 49 12 58 20 C62 27 55 34 45 32 C36 31 29 28 26 20Z" fill="url(#satelliteIce)" opacity="0.82" />
              <path className="satellite-land" d="M14 31 C24 20 39 24 44 35 C42 45 36 48 29 55 C22 50 15 43 14 31Z" fill="url(#satelliteLand)" opacity="0.88" />
              <path className="satellite-land" d="M31 55 C39 57 42 67 37 79 C29 74 25 64 31 55Z" fill="url(#satelliteLand)" opacity="0.76" />
              <path className="satellite-land" d="M51 33 C61 21 78 24 87 37 C92 48 85 59 72 58 C59 56 49 47 51 33Z" fill="url(#satelliteLand)" opacity="0.9" />
              <path className="satellite-land" d="M64 57 C73 58 80 66 79 75 C69 77 62 70 64 57Z" fill="url(#satelliteLand)" opacity="0.72" />
              <path className="satellite-cloud" d="M19 25 C30 20 44 20 54 26 M50 45 C64 37 78 39 91 45 M18 62 C31 57 43 59 55 65" fill="none" stroke="#ffffff" strokeLinecap="round" strokeOpacity="0.23" strokeWidth="1.4" />
            </g>
          ))}
        </g>
        <rect x="0" y="0" width="100" height="100" fill="#ffffff" filter="url(#satelliteBlur)" opacity="0.03" />
        {pins.map((point) => (
          <text
            className="satellite-pin"
            dominantBaseline="central"
            key={point.id}
            opacity={Math.min(1, point.opacity + 0.18)}
            textAnchor="middle"
            x={point.x}
            y={point.y}
          >
            📍
          </text>
        ))}
      </g>
      <circle cx="50" cy="50" r="42.5" fill="url(#satelliteShade)" />
      <circle cx="50" cy="50" r="42.5" fill="url(#satelliteBottomGlow)" />
      <circle cx="50" cy="50" r="42.5" fill="none" stroke="#9bd8ff" strokeOpacity="0.55" strokeWidth="0.58" />
      <path d="M9 18 C29 -6 72 -3 91 23" fill="none" stroke="#93dfff" strokeLinecap="round" strokeOpacity="0.35" strokeWidth="0.55" />
      <path d="M11 83 C30 106 72 105 90 78" fill="none" stroke="#93dfff" strokeLinecap="round" strokeOpacity="0.28" strokeWidth="0.55" />
    </svg>
  );
}

function projectAceternityFlatWorld(point) {
  return {
    x: ((point.lng + 180) / 360) * 800,
    y: ((90 - point.lat) / 180) * 400,
  };
}

function aceternityWorldRoutePath(start, end) {
  const a = projectAceternityFlatWorld(start);
  const b = projectAceternityFlatWorld(end);
  const dx = Math.abs(b.x - a.x);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = Math.min(95, Math.max(28, distance * 0.19 + dx * 0.05));
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - lift;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function AceternityStyleWorldMap({ arcs, points, worldDots }) {
  const [cardRef, isVisualActive] = useNearViewport("420px");

  return (
    <article
      className={`journey-card dot-map-card aceternity-world-card ${isVisualActive ? "visual-active" : "visual-paused"}`}
      ref={cardRef}
    >
      <div>
        <p className="eyebrow">World Map</p>
        <h3>点阵轨迹</h3>
        <span>{arcs.length} 条轨迹</span>
      </div>
      <svg className="aceternity-world-map" viewBox="0 0 800 400" role="img" aria-label="点阵世界地图轨迹">
        <defs>
          <linearGradient id="aceternityRouteGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="8%" stopColor="#0ea5e9" stopOpacity="0.96" />
            <stop offset="92%" stopColor="#0ea5e9" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="aceternityWorldFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="9%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="89%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <mask id="aceternityWorldMask">
            <rect width="800" height="400" fill="url(#aceternityWorldFade)" />
          </mask>
          <filter id="aceternityMapGlow">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        <rect width="800" height="400" rx="20" fill="#ffffff00" />
        <g mask="url(#aceternityWorldMask)">
          {worldDots.map((dot) => {
            const projected = projectAceternityFlatWorld(dot);
            return (
              <circle
                cx={projected.x}
                cy={projected.y}
                fill="#a8adb7"
                key={dot.id}
                opacity="0.82"
                r="0.98"
              />
            );
          })}
        </g>
        {arcs.map((arc, index) => (
          <path
            className="world-route-line"
            d={aceternityWorldRoutePath(arc.start, arc.end)}
            fill="none"
            key={arc.id}
            stroke="url(#aceternityRouteGradient)"
            strokeLinecap="round"
            strokeWidth="1.35"
            style={{ animationDelay: `${index * 0.055}s` }}
          />
        ))}
        {points.slice(0, 170).map((point, index) => {
          const projected = projectAceternityFlatWorld(point);
          return (
            <g className="world-visit-point" key={point.id}>
              <circle cx={projected.x} cy={projected.y} fill="#38bdf8" filter="url(#aceternityMapGlow)" opacity="0.38" r="7" />
              <circle cx={projected.x} cy={projected.y} fill="#0ea5e9" r="3" />
              {index % 2 === 0 && <circle className="world-map-pulse" cx={projected.x} cy={projected.y} fill="#0ea5e9" opacity="0.5" r="3" />}
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function SphericalJourneyGlobe({ points }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRotation((value) => (value + 1.1) % 360);
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  const projected = useMemo(() => {
    const rad = Math.PI / 180;
    return points.slice(0, 170).map((point) => {
      const lat = point.lat * rad;
      const lon = (point.lng + rotation) * rad;
      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon);
      return {
        ...point,
        visible: z > -0.18,
        x: 50 + x * 38,
        y: 50 - y * 38,
        opacity: Math.max(0.18, Math.min(1, (z + 1) / 1.55)),
        size: 0.82 + Math.max(0, z) * 1.35,
      };
    });
  }, [points, rotation]);

  return (
    <article className="journey-card globe-card">
      <div>
        <p className="eyebrow">Globe</p>
        <h3>球形足迹</h3>
        <span>{points.length} 个地点</span>
      </div>
      <svg className="journey-globe" viewBox="0 0 100 100" role="img" aria-label="球形地球足迹">
        <defs>
          <radialGradient id="globeSurface" cx="34%" cy="24%" r="72%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="45%" stopColor="#155e75" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="1.7" />
          </filter>
        </defs>
        <circle cx="50" cy="50" r="40.5" fill="url(#globeSurface)" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="#bae6fd" strokeOpacity="0.35" />
        {[18, 30, 42, 58, 70, 82].map((cy) => (
          <ellipse
            cx="50"
            cy={cy}
            key={cy}
            rx={Math.sqrt(Math.max(0, 40 * 40 - (cy - 50) * (cy - 50)))}
            ry="3.8"
            fill="none"
            stroke="#e0f2fe"
            strokeOpacity="0.14"
            strokeWidth="0.45"
          />
        ))}
        {[-45, -20, 20, 45].map((angle) => (
          <ellipse
            cx="50"
            cy="50"
            key={angle}
            rx="11"
            ry="40"
            fill="none"
            stroke="#e0f2fe"
            strokeOpacity="0.16"
            strokeWidth="0.45"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
        {projected.filter((point) => point.visible).map((point) => (
          <g key={point.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.size + 1.7}
              fill="#f97316"
              filter="url(#softGlow)"
              opacity={point.opacity * 0.32}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={point.size}
              fill="#fff7ed"
              opacity={point.opacity}
            />
          </g>
        ))}
      </svg>
    </article>
  );
}

function projectFlatWorld(point) {
  return {
    x: ((point.lng + 180) / 360) * 1000,
    y: ((84 - point.lat) / 142) * 500,
  };
}

function arcPath(start, end) {
  const a = projectFlatWorld(start);
  const b = projectFlatWorld(end);
  const dx = b.x - a.x;
  const distance = Math.hypot(dx, b.y - a.y);
  const lift = Math.min(130, Math.max(30, distance * 0.2));
  const cx = (a.x + b.x) / 2;
  const cy = Math.min(a.y, b.y) - lift;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function DotWorldJourneyMap({ arcs, points, worldDots }) {
  return (
    <article className="journey-card dot-map-card">
      <div>
        <p className="eyebrow">World Dots</p>
        <h3>点阵轨迹</h3>
        <span>{arcs.length} 条轨迹</span>
      </div>
      <svg className="dot-world-map" viewBox="0 0 1000 500" role="img" aria-label="点阵世界地图轨迹">
        <defs>
          <linearGradient id="routeGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <rect width="1000" height="500" rx="20" fill="#f8fafc" />
        {worldDots.map((dot) => {
          const projected = projectFlatWorld(dot);
          return (
            <circle
              cx={projected.x}
              cy={projected.y}
              fill="#cbd5e1"
              key={dot.id}
              opacity="0.58"
              r="1.15"
            />
          );
        })}
        {arcs.map((arc, index) => (
          <path
            d={arcPath(arc.start, arc.end)}
            fill="none"
            key={arc.id}
            opacity={0.18 + (index % 4) * 0.08}
            stroke="url(#routeGradient)"
            strokeDasharray="7 10"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        ))}
        {points.slice(0, 180).map((point) => {
          const projected = projectFlatWorld(point);
          return (
            <g key={point.id}>
              <circle cx={projected.x} cy={projected.y} fill="#f97316" opacity="0.22" r="6" />
              <circle cx={projected.x} cy={projected.y} fill="#0f766e" r="2.5" />
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function Metric({ detail, icon, label, popover, value }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
      {popover && popover}
    </article>
  );
}

function ComparisonMetric({ icon, label, popover, rows }) {
  return (
    <article className="metric comparison-metric">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <div className="metric-comparison-rows">
          {rows.map((row) => (
            <strong key={row.label}>
              <span>{row.label}</span>
              <em>{row.value}</em>
              {row.detail && <small>{row.detail}</small>}
            </strong>
          ))}
        </div>
      </div>
      {popover && popover}
    </article>
  );
}

function ComparisonDiffPopover({ diff, leftLabel, rightLabel, type }) {
  const renderItems = (items) => {
    if (!items.length) return <small>无</small>;
    return (
      <div className={type === "country" ? "diff-flag-list" : "diff-text-list"}>
        {items.map((place) =>
          type === "country" ? (
            <span key={place.id} title={displayPlaceName(place)}>
              <FlagIcon place={place} />
            </span>
          ) : (
            <span key={place.id}>{displayPlaceName(place)}</span>
          ),
        )}
      </div>
    );
  };

  return (
    <div className="comparison-diff-popover">
      <strong>{leftLabel} 多去</strong>
      {renderItems(diff.leftOnly)}
      <strong>{rightLabel} 多去</strong>
      {renderItems(diff.rightOnly)}
    </div>
  );
}

function countryTooltipLatLng(feature) {
  const props = feature?.properties || {};
  const id = props.id || props.countryCode;
  if (COUNTRY_LABEL_CENTERS[id]) return L.latLng(COUNTRY_LABEL_CENTERS[id]);
  const [lon, lat] = props.center || [];
  if (Number.isFinite(lon) && Number.isFinite(lat)) return L.latLng(lat, lon);
  return null;
}

function countryFeatureLabel(feature) {
  const props = feature?.properties || {};
  return countryNameZh(
    props.id || props.countryCode,
    props.isoA2,
    props.localName || props.name,
  );
}

function MapView({
  activeLevel,
  activeProfile,
  countryPlaces,
  displayPlaces,
  mapStatus,
  mapTheme,
  mapThemes,
  placeLookup,
  profiles,
  regionPlaces,
  selectedPlaceId,
  setMapThemeId,
  setSelectedPlaceId,
  onCountryOpen,
  visitedByLevel,
  visitedByCountry,
  visitedCityVisits,
  visitedPlaces,
  onPlaceFocus,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const lastLevelRef = useRef(null);
  const [activeVisitPreview, setActiveVisitPreview] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [18, 20],
      zoom: 2,
      minZoom: 1,
      maxZoom: 12,
      scrollWheelZoom: true,
      worldCopyJump: true,
      zoomControl: false,
    });
    map.setMaxBounds([
      [-64, -540],
      [84, 540],
    ]);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    map.on("click", () => setActiveVisitPreview(null));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapTheme) return;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    tileLayerRef.current = L.tileLayer(mapTheme.tile, {
      attribution: MAP_TILE_ATTRIBUTION,
      maxZoom: 20,
      noWrap: false,
      keepBuffer: 4,
      subdomains: "abcd",
    }).addTo(map);
  }, [mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || countryPlaces.length === 0) return;

    if (layerRef.current) {
      layerRef.current.remove();
    }

    const layer = L.featureGroup().addTo(map);
    const countryLayer = L.geoJSON(
      {
        type: "FeatureCollection",
        features: placesToMapFeatures(countryPlaces, activeLevel === "country"),
      },
      {
        style: (feature) => {
          const id = feature.properties.id;
          const visitInfo = visitedByCountry.get(id);
          const tone = visitTone(visitInfo, profiles, mapTheme, activeProfile);
          const isSelected = selectedPlaceId === id;
          const isSubLevelCountryBase = activeLevel !== "country" && id === "CHN" && visitInfo;
          return {
            color: isSelected
              ? mapTheme.selectedStroke
              : tone
                ? tone.stroke
                : mapTheme.emptyStroke,
            weight: isSelected ? 1.5 : 0.65,
            opacity: 0.95,
            fillColor: tone
              ? isSubLevelCountryBase
                ? mapTheme.countryBaseFill || mapTheme.visitedFill
                : tone.fill
              : mapTheme.emptyFill,
            fillOpacity: tone ? (isSubLevelCountryBase ? 0.34 : 0.72) : activeLevel === "country" ? 0.46 : 0.26,
          };
        },
        onEachFeature: (feature, leafletLayer) => {
          leafletLayer.bindTooltip(countryFeatureLabel(feature), {
            sticky: true,
          });
          leafletLayer.on("click", () => {
            setSelectedPlaceId(feature.properties.id);
            onCountryOpen(feature.properties.id);
          });
        },
      },
    ).addTo(layer);

    if (activeLevel !== "country" && displayPlaces.length > 0) {
      L.geoJSON(
        {
          type: "FeatureCollection",
          features: displayPlaces.map(placeToFeature),
        },
        {
          style: (feature) => {
            const id = feature.properties.id;
            const visitInfo = visitedByLevel.get(id);
            const tone = visitTone(visitInfo, profiles, mapTheme, activeProfile);
            const isSelected = selectedPlaceId === id;
            return {
              color: isSelected
                ? mapTheme.selectedStroke
                : tone
                  ? tone.stroke
                  : "#9aacbd",
              weight: isSelected ? 1.4 : activeLevel === "city" ? 0.5 : 0.7,
              opacity: 0.9,
              fillColor: tone ? tone.fill : "#ffffff",
              fillOpacity: tone ? 0.7 : 0.08,
            };
          },
          onEachFeature: (feature, leafletLayer) => {
            leafletLayer.bindTooltip(feature.properties.localName || feature.properties.name, {
              sticky: true,
            });
            leafletLayer.on("click", () => setSelectedPlaceId(feature.properties.id));
          },
        },
      ).addTo(layer);
    }

    if (activeLevel === "city" && regionPlaces.length > 0) {
      L.geoJSON(
        {
          type: "FeatureCollection",
          features: regionPlaces.map(placeToFeature),
        },
        {
          interactive: false,
          style: {
            color: "#536579",
            weight: 1.25,
            opacity: 0.9,
            fillOpacity: 0,
          },
        },
      ).addTo(layer);
    }

    const markerPlaces =
      activeLevel === "city"
        ? visitedPlaces.filter((place) => place.level === "city")
        : visitedPlaces.filter((place) => place.level === "city");
    const markerOffsets = activeLevel === "country" ? WORLD_WRAP_OFFSETS : [0];
    for (const city of markerPlaces) {
      const id = city.mapId || city.id;
      const cityMapId = resolveMapIdForLevel(id, "city", placeLookup);
      const visitInfo =
        visitedCityVisits.get(cityMapId) ||
        visitedCityVisits.get(canonicalPlaceId(city.id)) ||
        [];
      const markerInfo = {
        count: visitInfo.length,
        profileIds: new Set(visitInfo.map((visit) => visit.profileId)),
      };
      const tone = visitTone(markerInfo, profiles, mapTheme, activeProfile);
      const [lon, lat] = city.center;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      for (const offset of markerOffsets) {
        L.circleMarker([lat, lon + offset], {
          radius: activeLevel === "city" ? 5 : 3.5,
          color: mapTheme.markerStroke,
          weight: 1.5,
          fillColor: tone ? tone.marker : mapTheme.emptyStroke,
          fillOpacity: visitInfo.length > 0 ? 0.9 : 0.45,
          bubblingMouseEvents: false,
        })
          .bindTooltip(city.localName, { sticky: true })
          .on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            onPlaceFocus?.(canonicalPlaceId(city.mapId || city.id));
            setActiveVisitPreview({ place: city, visits: visitInfo });
          })
          .addTo(layer);
      }
    }

    layerRef.current = layer;

    const bounds =
      activeLevel === "country"
        ? L.latLngBounds(WORLD_BOUNDS)
        : L.latLngBounds(CHINA_BOUNDS);
    if (bounds.isValid() && lastLevelRef.current !== activeLevel) {
      resetMapViewport(map, activeLevel);
      lastLevelRef.current = activeLevel;
    }
  }, [
    activeLevel,
    activeProfile,
    displayPlaces,
    placeLookup,
    profiles,
    countryPlaces,
    regionPlaces,
    selectedPlaceId,
    setSelectedPlaceId,
    onCountryOpen,
    onPlaceFocus,
    mapTheme,
    visitedByLevel,
    visitedByCountry,
    visitedCityVisits,
    visitedPlaces,
  ]);

  return (
    <div
      className="map-surface"
      onClick={(event) => {
        if (event.target === event.currentTarget) setActiveVisitPreview(null);
      }}
      style={{ "--map-bg": mapTheme.background }}
    >
      <div className="map-head">
        <div>
          <p className="eyebrow">Layer</p>
          <h2>{placeLevels.find((level) => level.id === activeLevel)?.label}层级</h2>
        </div>
        <p>{mapStatus}</p>
      </div>
      <MapThemePicker
        activeThemeId={mapTheme.id}
        onChange={setMapThemeId}
        themes={mapThemes}
      />
      <div className="leaflet-map" ref={containerRef} />
      <button
        aria-label="复原地图视角"
        className="map-reset-button"
        onClick={() => resetMapViewport(mapRef.current, activeLevel)}
        title="复原地图视角"
        type="button"
      >
        <RotateCcw size={18} />
      </button>
      {activeVisitPreview && (
        <VisitPhotoOverlay
          onClose={() => setActiveVisitPreview(null)}
          place={activeVisitPreview.place}
          profiles={profiles}
          visits={activeVisitPreview.visits}
        />
      )}
    </div>
  );
}

function MapThemePicker({ activeThemeId, onChange, themes }) {
  return (
    <div className="map-theme-picker" aria-label="地图配色方案">
      {themes.map((theme) => (
        <button
          aria-label={`切换到${theme.label}配色`}
          className={activeThemeId === theme.id ? "active" : ""}
          key={theme.id}
          onClick={() => onChange(theme.id)}
          title={theme.label}
          type="button"
        >
          <span
            style={{
              "--swatch-a": theme.swatches[0],
              "--swatch-b": theme.swatches[1],
            }}
          />
        </button>
      ))}
    </div>
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVisitPopup(place, visits = [], profiles = []) {
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const photos = visits.flatMap((visit) =>
    (visit.photos || []).map((photo) => ({
      ...photo,
      visitedAt: visit.visitedAt,
    })),
  );
  const visitRows = visits.length
    ? visits
        .map((visit) => {
          const rating = Number(visit.rating) || 0;
          return `<li><strong>${escapeHtml(profileNames.get(visit.profileId) || "足迹")}</strong><span>${escapeHtml(displayVisitDate(visit) || "未填写日期")}</span><span>${escapeHtml(visit.type || "旅行")}</span><em>${rating ? `${rating}/10 ★` : "未评分"}</em></li>`;
        })
        .join("")
    : "<li><strong>暂无记录</strong><span>这个点位还没有足迹详情</span></li>";
  const photoBlock = photos.length
    ? `<div class="popup-photo-strip">${photos
        .map(
          (photo, index) =>
            `<figure><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || displayPlaceName(place))}" loading="lazy" /><figcaption>${index + 1}/${photos.length}</figcaption></figure>`,
        )
        .join("")}</div>`
    : `<div class="popup-empty-photo"><strong>暂无照片</strong><span>可以在足迹编辑里上传这座城市的照片。</span></div>`;

  return `
    <article class="visit-popup-card">
      <header>
        <strong>${escapeHtml(displayPlaceName(place))}</strong>
        <span>${escapeHtml(displayCountryName({ id: place.countryCode, isoA2: place.isoA2, localName: place.countryName }))}</span>
      </header>
      <ul>${visitRows}</ul>
      ${photoBlock}
    </article>
  `;
}

function VisitPhotoOverlay({ onClose, place, profiles = [], visits = [] }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!overlayRef.current || overlayRef.current.contains(event.target)) return;
      onClose?.();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  if (!place) return null;
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.name]));
  const photos = visits.flatMap((visit) =>
    (visit.photos || []).map((photo) => ({
      ...photo,
      profileName: profileNames.get(visit.profileId),
      visitedAt: visit.visitedAt,
    })),
  );

  return (
    <aside className="visit-photo-overlay" onClick={(event) => event.stopPropagation()} ref={overlayRef}>
      <header>
        <div>
          <strong>{displayPlaceName(place)}</strong>
          <span>
            {displayCountryName({
              id: place.countryCode,
              isoA2: place.isoA2,
              localName: place.countryName,
            })}
          </span>
        </div>
        <button aria-label="关闭照片预览" className="icon-button" onClick={onClose} type="button">
          <X size={17} />
        </button>
      </header>
      <ul className="visit-photo-meta">
        {visits.length > 0 ? (
          visits.map((visit) => {
            const rating = Number(visit.rating) || 0;
            return (
              <li key={visit.id}>
                <strong>{profileNames.get(visit.profileId) || "足迹"}</strong>
                <span>{displayVisitDate(visit) || "未填写日期"}</span>
                <span>{visit.type || "旅行"}</span>
                <em>{rating ? `${rating}/10 ★` : "未评分"}</em>
              </li>
            );
          })
        ) : (
          <li>
            <strong>暂无记录</strong>
            <span>这个点位还没有足迹详情</span>
          </li>
        )}
      </ul>
      {photos.length > 0 ? (
        <div className="visit-photo-carousel">
          {photos.map((photo, index) => (
            <figure key={`${photo.id || photo.url}-${index}`}>
              <img
                alt={photo.name || displayPlaceName(place)}
                loading="lazy"
                src={photo.url}
              />
              <figcaption>{index + 1}/{photos.length}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="visit-photo-empty">
          <strong>暂无照片</strong>
          <span>可以在足迹编辑里上传这座城市的照片。</span>
        </div>
      )}
    </aside>
  );
}

function QuickAddDock({
  activeProfile,
  addPlace,
  authMessage,
  isEditor,
  isSaving,
  onEditVisit,
  onSignIn,
  onSignOut,
  profiles,
  searchPlaces,
  session,
  visitedPlaceIds,
  visits,
  onDeleteVisit,
  focusRequest,
  onFocusConsumed,
}) {
  return (
    <aside className="quick-add-dock" aria-label="快速添加足迹">
      <div className="dock-handle">
        <Plus size={18} />
      </div>
      <PlaceSearchPanel
        activeProfile={activeProfile}
        addPlace={addPlace}
        authMessage={authMessage}
        isEditor={isEditor}
        isSaving={isSaving}
        onEditVisit={onEditVisit}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        places={searchPlaces}
        profiles={profiles}
        session={session}
        title="添加足迹"
        visitedPlaceIds={visitedPlaceIds}
        visits={visits}
        onDeleteVisit={onDeleteVisit}
        focusRequest={focusRequest}
        onFocusConsumed={onFocusConsumed}
      />
    </aside>
  );
}

function FlagIcon({ place }) {
  const iso = isoA2ForPlace(place);
  if (!iso || iso.length !== 2) {
    return <span className="flag fallback-flag">{place?.flag || "◇"}</span>;
  }
  return (
    <span className="flag">
      <img
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.parentElement?.classList.add("fallback-flag");
          event.currentTarget.replaceWith(document.createTextNode(flagEmoji(iso)));
        }}
        src={`https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${iso}.svg`}
      />
    </span>
  );
}

function CountryModal({
  activeProfile,
  addPlace,
  authMessage,
  cityPlaces,
  country,
  countryPlaces,
  isEditor,
  isSaving,
  onClose,
  onDeleteVisit,
  onEditVisit,
  placeLookup,
  profiles,
  regionPlaces,
  session,
  visits,
  visitedByLevel,
  visitedPlaceIds,
}) {
  const [modalMapLevel, setModalMapLevel] = useState(country.id === "CHN" ? "region" : "city");
  const [showMapLabels, setShowMapLabels] = useState(true);
  const [showLockedPlaces, setShowLockedPlaces] = useState(false);
  const [focusedModalPlaceRequest, setFocusedModalPlaceRequest] = useState(null);
  const visitedRegions = new Set();
  const visitedCities = new Set();
  for (const visit of visits) {
    const regionId = resolveMapIdForLevel(visit.placeId, "region", placeLookup);
    const cityId = resolveMapIdForLevel(visit.placeId, "city", placeLookup);
    if (regionId && regionId !== country.id) visitedRegions.add(regionId);
    if (cityId) visitedCities.add(cityId);
  }
  const regionTotal = country.id === "CHN"
    ? countryPlaces.filter((place) => place.level === "region").length
    : 0;
  const cityTotal = country.id === "CHN" ? cityPlaces.length : null;
  const grouped = useMemo(
    () =>
      buildCountryGroups(visits, placeLookup, country, {
        cityPlaces,
        regionPlaces,
        showLockedPlaces,
      }),
    [cityPlaces, country, placeLookup, regionPlaces, showLockedPlaces, visits],
  );
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const modalVisitedPlaceIds = useMemo(
    () => new Set(visits.map((visit) => canonicalPlaceId(visit.placeId))),
    [visits],
  );
  const modalVisitedPlaces = useMemo(
    () => countryPlaces.filter((place) => modalVisitedPlaceIds.has(canonicalPlaceId(place.id))),
    [countryPlaces, modalVisitedPlaceIds],
  );
  const handleModalPlaceFocus = useCallback((placeId) => {
    setFocusedModalPlaceRequest({ placeId, token: Date.now() });
  }, []);
  const modalVisitedByLevel = useMemo(() => {
    const result = new Map();
    const add = (id, profileId) => {
      if (!id) return;
      const current = result.get(id) || { count: 0, profileIds: new Set() };
      current.count += 1;
      if (profileId) current.profileIds.add(profileId);
      result.set(id, current);
    };
    for (const visit of visits) {
      add(country.id, visit.profileId);
      const regionId = resolveMapIdForLevel(visit.placeId, "region", placeLookup);
      const cityId = resolveMapIdForLevel(visit.placeId, "city", placeLookup);
      if (regionId && regionId !== country.id) add(regionId, visit.profileId);
      if (cityId) add(cityId, visit.profileId);
    }
    return result;
  }, [country.id, placeLookup, visits]);

  const modalVisitedCityVisits = useMemo(() => {
    const result = new Map();
    for (const visit of visits) {
      const cityId = resolveMapIdForLevel(visit.placeId, "city", placeLookup);
      if (!cityId) continue;
      const current = result.get(cityId) ?? [];
      current.push(visit);
      result.set(cityId, current);
    }
    return result;
  }, [placeLookup, visits]);

  useEffect(() => {
    setModalMapLevel(country.id === "CHN" ? "region" : "city");
  }, [country.id]);

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [country.id]);

  function toggleGroup(groupId) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggleAllGroups(targetGroups = grouped) {
    const targetIds = targetGroups.map((group) => group.id);
    setExpandedGroups((current) => {
      const allTargetOpen = targetIds.length > 0 && targetIds.every((id) => current.has(id));
      if (allTargetOpen) {
        const next = new Set(current);
        targetIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...current, ...targetIds]);
    });
  }

  const regionProgress = regionTotal ? Math.min(100, (visitedRegions.size / regionTotal) * 100) : 0;
  const cityProgress = cityTotal ? Math.min(100, (visitedCities.size / cityTotal) * 100) : 0;
  const coveredRegionText = regionTotal
    ? `覆盖 ${visitedRegions.size} 省 / 自治区`
    : country.id === "CHN"
      ? "尚未覆盖省 / 自治区"
      : `覆盖 ${grouped.length || 0} 个分组`;

  const comparisonMode = activeProfile === "all" && profiles.length >= 2;
  const comparisonGroupOrder = useMemo(() => {
    if (!comparisonMode) return null;
    return buildCountryGroups(visits, placeLookup, country, {
      cityPlaces,
      regionPlaces,
      showLockedPlaces,
    }).map((group) => group.id);
  }, [cityPlaces, comparisonMode, country, placeLookup, regionPlaces, showLockedPlaces, visits]);

  function summarizeCountryVisits(targetVisits) {
    const targetRegions = new Set();
    const targetCities = new Set();
    for (const visit of targetVisits) {
      const regionId = resolveMapIdForLevel(visit.placeId, "region", placeLookup);
      const cityId = resolveMapIdForLevel(visit.placeId, "city", placeLookup);
      if (regionId && regionId !== country.id) targetRegions.add(regionId);
      if (cityId) targetCities.add(cityId);
    }
    const targetGrouped = buildCountryGroups(targetVisits, placeLookup, country, {
      cityPlaces,
      groupOrder: comparisonGroupOrder,
      regionPlaces,
      showLockedPlaces,
    });
    const targetRegionProgress = regionTotal ? Math.min(100, (targetRegions.size / regionTotal) * 100) : 0;
    const targetCityProgress = cityTotal ? Math.min(100, (targetCities.size / cityTotal) * 100) : 0;
    return {
      coveredRegionText: regionTotal
        ? `覆盖 ${targetRegions.size} 省 / 自治区`
        : country.id === "CHN"
          ? "尚未覆盖省 / 自治区"
          : `覆盖 ${targetGrouped.length || 0} 个分组`,
      grouped: targetGrouped,
      regionProgress: targetRegionProgress,
      cityProgress: targetCityProgress,
      visitedCities: targetCities,
      visitedRegions: targetRegions,
    };
  }

  const profileModalSummaries = useMemo(
    () =>
      profiles.slice(0, 2).map((profile) => ({
        profile,
        ...summarizeCountryVisits(visits.filter((visit) => visit.profileId === profile.id)),
      })),
    [cityPlaces, comparisonGroupOrder, country, placeLookup, profiles, regionPlaces, showLockedPlaces, visits],
  );

  function renderSummaryPanel(summary = null, profile = null) {
    const targetGroups = summary?.grouped || grouped;
    const targetVisitedRegions = summary?.visitedRegions || visitedRegions;
    const targetVisitedCities = summary?.visitedCities || visitedCities;
    const targetRegionProgress = summary?.regionProgress ?? regionProgress;
    const targetCityProgress = summary?.cityProgress ?? cityProgress;
    const allGroupsOpen = targetGroups.length > 0 && targetGroups.every((group) => expandedGroups.has(group.id));
    return (
      <aside className={comparisonMode ? "modal-summary comparison-profile-summary" : "modal-summary"}>
        {profile && <div className="modal-profile-title">{profile.name}</div>}
        <div className="modal-stat-cards">
          <article className="modal-stat-card">
            <p>州 / 省 / 行政区</p>
            <strong>
              {regionTotal ? targetVisitedRegions.size : targetGroups.length || "-"}
              {regionTotal && <span> / {regionTotal}</span>}
            </strong>
            <div className="modal-progress">
              <span style={{ width: `${targetRegionProgress}%` }} />
            </div>
            <small>
              {regionTotal
                ? `已点亮 ${targetVisitedRegions.size} 省 / 自治区 · ${targetRegionProgress.toFixed(1)}%`
                : "当前国家暂无省级边界数据"}
            </small>
          </article>
          <article className="modal-stat-card">
            <p>打卡城市</p>
            <strong>
              {cityTotal ? targetVisitedCities.size : targetVisitedCities.size}
              {cityTotal && <span> / {cityTotal}</span>}
            </strong>
            {cityTotal && (
              <div className="modal-progress">
                <span style={{ width: `${targetCityProgress}%` }} />
              </div>
            )}
            <small>
              共 {targetVisitedCities.size} 座城市
              {cityTotal ? ` · ${targetCityProgress.toFixed(1)}%` : ""}
            </small>
          </article>
        </div>
        <div className="modal-summary-title">
          <h3>足迹记录</h3>
          <button onClick={() => setShowLockedPlaces((value) => !value)} type="button">
            {showLockedPlaces ? "隐藏未解锁" : "显示未解锁"}
          </button>
          {targetGroups.length > 0 && (
            <button onClick={() => toggleAllGroups(targetGroups)} type="button">
              {allGroupsOpen ? "全部收起 -" : "全部展开 +"}
            </button>
          )}
        </div>
        {targetGroups.length === 0 && <p className="empty">尚未标记地点。</p>}
        {targetGroups.map((group) => (
          <div className="admin-group modal-group" key={group.id}>
            <button onClick={() => toggleGroup(group.id)} type="button">
              <strong>{group.name}</strong>
              <span>
                {group.total ? `${group.count} / ${group.total} 城市` : `${group.count} 城市 / 地点`} {expandedGroups.has(group.id) ? "-" : "+"}
              </span>
            </button>
            {expandedGroups.has(group.id) && (
              <div className="modal-city-list">
                {group.cities.map((city) => (
                  <span className={city.visited ? "" : "locked"} key={city.id || city.name}>
                    {city.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="country-modal" role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <p className="eyebrow">Country</p>
            <h2>
              <FlagIcon place={country} />
              {displayPlaceName(country)}
            </h2>
            <span>{country.name}</span>
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <div className={comparisonMode ? "modal-grid comparison-modal-grid" : "modal-grid"}>
          {comparisonMode ? (
            renderSummaryPanel(profileModalSummaries[0], profileModalSummaries[0]?.profile)
          ) : (
            <PlaceSearchPanel
              activeProfile={activeProfile}
              addPlace={addPlace}
              authMessage={authMessage}
              compact
              isEditor={isEditor}
              isSaving={isSaving}
              onEditVisit={onEditVisit}
              onDeleteVisit={onDeleteVisit}
              places={countryPlaces}
              profiles={profiles}
              session={session}
              title={`添加 ${country.localName || country.name} 的地点`}
              visitedPlaceIds={modalVisitedPlaceIds}
              visits={visits}
              focusRequest={focusedModalPlaceRequest}
              onFocusConsumed={() => setFocusedModalPlaceRequest(null)}
            />
          )}
          <div className="modal-map-wrap">
            <div className="modal-map-toolbar">
              <button
                className={modalMapLevel === "region" ? "active" : ""}
                disabled={country.id !== "CHN"}
                onClick={() => setModalMapLevel("region")}
                type="button"
              >
                省级
              </button>
              <button
                className={modalMapLevel === "city" ? "active" : ""}
                onClick={() => setModalMapLevel("city")}
                type="button"
              >
                市级
              </button>
              <button
                className={showMapLabels ? "active" : ""}
                onClick={() => setShowMapLabels((value) => !value)}
                type="button"
              >
                注记
              </button>
            </div>
            <MiniCountryMap
              activeProfile={activeProfile}
              cityPlaces={cityPlaces}
              country={country}
              detailLevel={modalMapLevel}
              profiles={profiles}
              regionPlaces={regionPlaces}
              showLabels={showMapLabels}
              visitedByLevel={modalVisitedByLevel}
              visitedCityVisits={modalVisitedCityVisits}
              visitedPlaces={modalVisitedPlaces}
              onPlaceFocus={handleModalPlaceFocus}
            />
          </div>
          {comparisonMode ? (
            renderSummaryPanel(profileModalSummaries[1], profileModalSummaries[1]?.profile)
          ) : (
          <aside className="modal-summary">
            <div className="modal-stat-cards">
              <article className="modal-stat-card">
                <p>州 / 省 / 行政区</p>
                <strong>
                  {regionTotal ? visitedRegions.size : grouped.length || "-"}
                  {regionTotal && <span> / {regionTotal}</span>}
                </strong>
                <div className="modal-progress">
                  <span style={{ width: `${regionProgress}%` }} />
                </div>
                <small>
                  {regionTotal
                    ? `已点亮 ${visitedRegions.size} 省 / 自治区 · ${regionProgress.toFixed(1)}%`
                    : "当前国家暂无省级边界数据"}
                </small>
              </article>
              <article className="modal-stat-card">
                <p>打卡城市</p>
                <strong>
                  {cityTotal ? visitedCities.size : visitedCities.size}
                  {cityTotal && <span> / {cityTotal}</span>}
                </strong>
                {cityTotal && (
                  <div className="modal-progress">
                    <span style={{ width: `${cityProgress}%` }} />
                  </div>
                )}
                <small>
                  共 {visitedCities.size} 座城市
                  {cityTotal ? ` · ${cityProgress.toFixed(1)}%` : ""}
                </small>
              </article>
            </div>
            <div className="modal-summary-title">
              <h3>足迹记录</h3>
              <button onClick={() => setShowLockedPlaces((value) => !value)} type="button">
                {showLockedPlaces ? "隐藏未解锁" : "显示未解锁"}
              </button>
              {grouped.length > 0 && (
                <button onClick={toggleAllGroups} type="button">
                  {expandedGroups.size === grouped.length ? "全部收起 -" : "全部展开 +"}
                </button>
              )}
            </div>
            {grouped.length === 0 && <p className="empty">尚未标记地点。</p>}
            {grouped.map((group) => (
              <div className="admin-group modal-group" key={group.id}>
                <button onClick={() => toggleGroup(group.id)} type="button">
                  <strong>{group.name}</strong>
                  <span>
                    {group.total ? `${group.count} / ${group.total} 城市` : `${group.count} 城市 / 地点`} {expandedGroups.has(group.id) ? "-" : "+"}
                  </span>
                </button>
                {expandedGroups.has(group.id) && (
                  <div className="modal-city-list">
                    {group.cities.map((city) => (
                      <span className={city.visited ? "" : "locked"} key={city.id || city.name}>
                        {city.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </aside>
          )}
        </div>
      </section>
    </div>
  );
}

function buildCountryGroups(visits, placeLookup, country, options = {}) {
  const { cityPlaces = [], groupOrder = null, regionPlaces = [], showLockedPlaces = false } = options;
  const orderIndex = groupOrder
    ? new Map(groupOrder.map((id, index) => [id, index]))
    : null;
  const compareGroups = (a, b) => {
    if (orderIndex) {
      const aOrder = orderIndex.has(a.id) ? orderIndex.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bOrder = orderIndex.has(b.id) ? orderIndex.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    return b.count - a.count || a.name.localeCompare(b.name, "zh-CN");
  };
  const groups = new Map();
  const countryId = country?.id;

  if (countryId === "CHN") {
    const { chinaRegions, citiesByRegionId } = buildChinaRegionCityIndex(regionPlaces, cityPlaces);

    for (const visit of visits) {
      const city = resolvePlaceForLevel(visit.placeId, "city", placeLookup);
      const region = resolvePlaceForLevel(visit.placeId, "region", placeLookup);
      if (!region || region.id === countryId) continue;
      if (!groups.has(region.id)) {
        const allCities = citiesByRegionId.get(region.id) ?? [];
        groups.set(region.id, {
          id: region.id,
          name: displayPlaceName(region),
          total: allCities.length || 1,
          allCities,
          visitedCities: new Map(),
        });
      }
      const group = groups.get(region.id);
      const cityPlace = city && city.level === "city" ? city : null;
      const cityId = cityPlace?.id || visit.placeId;
      group.visitedCities.set(cityId, {
        id: cityId,
        name: displayPlaceName(cityPlace || findPlace(visit.placeId, placeLookup)),
        visited: true,
      });
    }

    if (showLockedPlaces) {
      for (const region of chinaRegions) {
        if (!groups.has(region.id)) {
          const allCities = citiesByRegionId.get(region.id) ?? [];
          groups.set(region.id, {
            id: region.id,
            name: displayPlaceName(region),
            total: allCities.length || 1,
            allCities,
            visitedCities: new Map(),
          });
        }
      }
    }

    return Array.from(groups.values())
      .map((group) => {
        const visitedCityIds = new Set(group.visitedCities.keys());
        const lockedCities = showLockedPlaces
          ? (group.allCities.length ? group.allCities : [{ id: group.id, localName: group.name }])
              .filter((city) => !visitedCityIds.has(city.id))
              .map((city) => ({ id: city.id, name: displayPlaceName(city), visited: false }))
          : [];
        const cities = [
          ...Array.from(group.visitedCities.values()),
          ...lockedCities,
        ].sort((a, b) => Number(b.visited) - Number(a.visited) || a.name.localeCompare(b.name, "zh-CN"));
        return {
          id: group.id,
          name: group.name,
          count: group.visitedCities.size,
          total: group.total,
          cities,
        };
      })
      .filter((group) => showLockedPlaces || group.count > 0)
      .sort(compareGroups);
  }

  for (const visit of visits) {
    const place = findPlace(visit.placeId, placeLookup);
    const region = resolvePlaceForLevel(visit.placeId, "region", placeLookup);
    const key = region?.id || place?.province || countryId || "other";
    const city = resolvePlaceForLevel(visit.placeId, "city", placeLookup);
    const cityName = displayPlaceName(city || place);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        name: region?.id === countryId
          ? displayCountryName(country)
          : region?.localName || place?.province || displayCountryName(country) || "其他地点",
        visitedCities: new Map(),
      });
    }
    const group = groups.get(key);
    const cityId = city?.id || visit.placeId;
    if (cityName) group.visitedCities.set(cityId, { id: cityId, name: cityName, visited: true });
  }
  return Array.from(groups.values())
    .map((group) => ({
      id: group.id,
      name: group.name,
      count: group.visitedCities.size,
      total: null,
      cities: Array.from(group.visitedCities.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    }))
    .sort(compareGroups);
}

function fitMiniCountryMap(map, country, layer) {
  if (!map || !country) return;
  if (country.id === "CHN") {
    map.fitBounds(L.latLngBounds(CHINA_MODAL_BOUNDS), {
      padding: [18, 18],
      animate: false,
    });
    return;
  }
  const bounds = layer?.getBounds?.();
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding: [18, 18], animate: false });
  } else if (country.center) {
    map.setView([country.center[1], country.center[0]], 5, { animate: false });
  }
}

function MiniCountryMap({
  activeProfile,
  cityPlaces,
  country,
  detailLevel,
  profiles,
  regionPlaces,
  showLabels,
  visitedByLevel,
  visitedCityVisits,
  visitedPlaces,
  onPlaceFocus,
}) {
  const miniRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastFitCountryRef = useRef(null);
  const [activeVisitPreview, setActiveVisitPreview] = useState(null);

  useEffect(() => {
    if (!miniRef.current || mapRef.current) return;
    const map = L.map(miniRef.current, {
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    map.on("click", () => setActiveVisitPreview(null));
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !country) return;
    if (layerRef.current) layerRef.current.remove();

    const layer = L.featureGroup().addTo(map);
    const { citiesByRegionId } = buildChinaRegionCityIndex(regionPlaces, cityPlaces);
    const noCityRegions = regionPlaces.filter(
      (place) =>
        place.countryCode === "CHN" &&
        (citiesByRegionId.get(place.id)?.length || 0) === 0,
    );
    const boundaryPlaces =
      country.id === "CHN"
        ? detailLevel === "city"
          ? [...cityPlaces, ...noCityRegions]
          : regionPlaces
        : country.geometry
          ? [country]
          : [];
    if (boundaryPlaces.length > 0) {
      const boundaryLayer = L.geoJSON(
        {
          type: "FeatureCollection",
          features: boundaryPlaces.map(placeToFeature),
        },
        {
          onEachFeature: (feature, leafletLayer) => {
            const id = feature.properties.id;
            const shouldLabel = visitedByLevel.get(id) || (country.id !== "CHN" && id === country.id);
            const isCountryFeature = feature.properties.level === "country";
            const label = isCountryFeature
              ? countryFeatureLabel(feature)
              : feature.properties.localName || feature.properties.name;
            if (showLabels && shouldLabel) {
              if (!isCountryFeature) {
                leafletLayer.bindTooltip(label, {
                  className: "mini-map-label",
                  direction: "center",
                  permanent: true,
                });
              }
              return;
            }
            leafletLayer.bindTooltip(label, {
              className: "mini-map-hover-label",
              sticky: true,
            });
          },
          style: (feature) => {
            const id = feature.properties.id;
            const visitInfo = visitedByLevel.get(id);
            const countryVisited = country.id !== "CHN" && visitedByLevel.get(country.id);
            const tone = visitTone(visitInfo || countryVisited, profiles, {
              visitedFill: "#76d69a",
              visitedStroke: "#19a35b",
              markerFill: "#16361f",
            }, activeProfile);
            return {
              color: tone ? tone.stroke : "#9aacbd",
              weight: tone ? 1.2 : 0.55,
              fillColor: tone ? tone.fill : "#edf2f7",
              fillOpacity: tone ? 0.72 : 0.46,
            };
          },
        },
      );
      boundaryLayer.addTo(layer);
      if (country.id !== "CHN" && showLabels) {
        const feature = placeToFeature(country);
        const latLng = countryTooltipLatLng(feature);
        if (latLng) {
          L.marker(latLng, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "mini-map-fixed-label",
              html: `<span>${escapeHtml(countryFeatureLabel(feature))}</span>`,
              iconAnchor: [0, 0],
              iconSize: [0, 0],
            }),
          }).addTo(layer);
        }
      }
    }

    if (country.id === "CHN" && detailLevel === "city" && regionPlaces.length > 0) {
      L.geoJSON(
        {
          type: "FeatureCollection",
          features: regionPlaces.map(placeToFeature),
        },
        {
          interactive: false,
          style: {
            color: "#64748b",
            weight: 1.25,
            opacity: 0.9,
            fillOpacity: 0,
          },
        },
      ).addTo(layer);
    }

    for (const place of visitedPlaces.filter((item) => item.level === "city")) {
      const [lon, lat] = place.center || [];
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const visitInfo = visitedCityVisits?.get(place.mapId || place.id) ?? visitedCityVisits?.get(place.id) ?? [];
      const markerInfo = {
        count: visitInfo.length,
        profileIds: new Set(visitInfo.map((visit) => visit.profileId)),
      };
      const tone = visitTone(markerInfo, profiles, {
        visitedFill: "#76d69a",
        visitedStroke: "#19a35b",
        markerFill: "#16361f",
      }, activeProfile);
      L.circleMarker([lat, lon], {
        radius: 4,
        color: "#fff",
        weight: 1.2,
        fillColor: tone ? tone.marker : "#16361f",
        fillOpacity: 0.92,
        bubblingMouseEvents: false,
      })
        .bindTooltip(place.localName || place.name, {
          className: "mini-map-label",
          permanent: false,
          sticky: true,
        })
        .on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          onPlaceFocus?.(canonicalPlaceId(place.mapId || place.id));
          setActiveVisitPreview({ place, visits: visitInfo });
        })
        .addTo(layer);
    }

    layerRef.current = layer;
    window.setTimeout(() => {
      map.invalidateSize();
      const fitKey = country.id;
      if (lastFitCountryRef.current === fitKey) return;
      fitMiniCountryMap(map, country, layer);
      lastFitCountryRef.current = fitKey;
    }, 60);
  }, [activeProfile, cityPlaces, country, detailLevel, onPlaceFocus, profiles, regionPlaces, showLabels, visitedByLevel, visitedCityVisits, visitedPlaces]);

  return (
    <div
      className="mini-country-map-shell"
      onClick={(event) => {
        if (event.target === event.currentTarget) setActiveVisitPreview(null);
      }}
    >
      <div className="mini-country-map" ref={miniRef} />
      <button
        aria-label="恢复初始视野"
        className="mini-map-reset-button"
        onClick={() => fitMiniCountryMap(mapRef.current, country, layerRef.current)}
        title="恢复初始视野"
        type="button"
      >
        <RotateCcw size={16} />
      </button>
      {activeVisitPreview && (
        <VisitPhotoOverlay
          onClose={() => setActiveVisitPreview(null)}
          place={activeVisitPreview.place}
          profiles={profiles}
          visits={activeVisitPreview.visits}
        />
      )}
    </div>
  );
}

function CountryPanel({
  addPlace,
  authMessage,
  country,
  countryPlaces,
  isEditor,
  isSaving,
  profiles,
  selectedVisits,
  session,
  visits,
  visitedPlaceIds,
}) {
  const provinceCount = new Set(
    visits
      .map((visit) => countryPlaces.find((place) => place.id === visit.placeId)?.parentId)
      .filter(Boolean),
  ).size;
  const cityCount = new Set(visits.map((visit) => visit.placeId)).size;
  const regionTotal = country.id === "CHN"
    ? countryPlaces.filter((place) => place.level === "region").length
    : 0;

  return (
    <aside className="country-panel">
      <div className="country-panel-head">
        <div>
          <p className="eyebrow">Selected Country</p>
          <h2>{displayPlaceName(country)}</h2>
        </div>
        <X size={18} aria-hidden="true" />
      </div>

      <div className="country-metrics">
        <span>
          <strong>{regionTotal ? provinceCount : "-"}</strong>
          {regionTotal ? ` / ${regionTotal} 省级单位` : "省级统计暂仅支持中国"}
        </span>
        <span>
          <strong>{cityCount}</strong>
          打卡城市/地点
        </span>
      </div>

      <div className="country-records">
        <h3>当前选区记录</h3>
        <p className="empty">点击地图上的国家会打开完整添加弹窗。</p>
        {selectedVisits.length === 0 && <p className="empty">还没有符合当前筛选的足迹。</p>}
        {selectedVisits.slice(0, 6).map((visit) => (
          <p key={visit.id}>
            <span>{displayVisitDate(visit) || "未填写日期"}</span>
            {visit.type}
          </p>
        ))}
      </div>
    </aside>
  );
}

function PlaceSearchPanel({
  activeProfile,
  addPlace,
  authMessage,
  compact = false,
  isEditor,
  isSaving,
  onEditVisit,
  places,
  profiles,
  session,
  title,
  visitedPlaceIds,
  visits,
  focusRequest,
  onFocusConsumed,
  onDeleteVisit,
  onSignIn,
  onSignOut,
}) {
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [visitedAt, setVisitedAt] = useState("");
  const [type, setType] = useState("旅行");
  const [visitChoice, setVisitChoice] = useState(null);
  const addedItemRefs = useRef(new Map());
  const addedListRef = useRef(null);

  useEffect(() => {
    const validIds = new Set(profiles.map((profile) => profile.id));
    if (activeProfile && activeProfile !== "all" && validIds.has(activeProfile)) {
      setProfileId(activeProfile);
    } else if ((!profileId || !validIds.has(profileId)) && profiles[0]) {
      setProfileId(profiles[0].id);
    }
  }, [activeProfile, profileId, profiles]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return places
      .filter((place) => placeSearchText(place).includes(needle))
      .sort((a, b) => {
        const aName = displayPlaceName(a).toLowerCase();
        const bName = displayPlaceName(b).toLowerCase();
        const aExact = aName === needle || (a.name || "").toLowerCase() === needle;
        const bExact = bName === needle || (b.name || "").toLowerCase() === needle;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = aName.startsWith(needle) || (a.name || "").toLowerCase().startsWith(needle);
        const bStarts = bName.startsWith(needle) || (b.name || "").toLowerCase().startsWith(needle);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return displayPlaceName(a).localeCompare(displayPlaceName(b), "zh-CN");
      })
      .slice(0, 80);
  }, [compact, places, query]);

  const addedPlaces = useMemo(() => {
    const byPlace = new Map();
    visits
      .map((visit) => {
        const canonicalId = canonicalPlaceId(visit.placeId);
        const place = places.find((item) => item.id === canonicalId || item.id === visit.placeId);
        return place ? { place, visit } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.visit.visitedAt || "").localeCompare(a.visit.visitedAt || ""))
      .forEach((item) => {
        const placeKey = canonicalPlaceId(item.place.mapId || item.place.id);
        const key = activeProfile === "all" ? placeKey : `${item.visit.profileId}:${placeKey}`;
        const existing = byPlace.get(key);
        if (existing) {
          existing.visits.push(item.visit);
          existing.visits.sort(
            (a, b) =>
              (PROFILE_ID_ORDER.get(a.profileId) ?? 99) - (PROFILE_ID_ORDER.get(b.profileId) ?? 99) ||
              (b.visitedAt || "").localeCompare(a.visitedAt || ""),
          );
        } else {
          byPlace.set(key, { ...item, visits: [item.visit] });
        }
      });
    return Array.from(byPlace.values());
  }, [activeProfile, compact, places, visits]);

  useEffect(() => {
    const targetId = typeof focusRequest === "string" ? focusRequest : focusRequest?.placeId;
    if (!targetId) return;
    window.setTimeout(() => {
      const node = addedItemRefs.current.get(canonicalPlaceId(targetId));
      const list = addedListRef.current;
      if (node && list) {
        const nodeTop = node.offsetTop - list.offsetTop;
        list.scrollTo({ top: Math.max(0, nodeTop), behavior: "smooth" });
      }
      onFocusConsumed?.();
    }, 0);
  }, [focusRequest, onFocusConsumed]);

  async function handleAdd(place) {
    const existing = addedPlaces.find(
      (item) =>
        item.visit.profileId === profileId &&
        canonicalPlaceId(item.place.mapId || item.place.id) === canonicalPlaceId(place.mapId || place.id),
    );
    if (existing) {
      onEditVisit?.(existing.visit);
      return;
    }
    const ok = await addPlace(place, { profileId, type, visitedAt });
    if (ok) setQuery("");
  }

  function profileLabel(profileIdValue) {
    return profiles.find((profile) => profile.id === profileIdValue)?.name || profileIdValue;
  }

  function chooseVisitAction(item, action) {
    const itemVisits = item.visits?.length ? item.visits : [item.visit];
    if (activeProfile === "all" && itemVisits.length > 1) {
      setVisitChoice({ action, place: item.place, visits: itemVisits });
      return;
    }
    const visit = itemVisits.find((entry) => entry.profileId === profileId) || itemVisits[0];
    if (action === "delete") onDeleteVisit?.(visit.id);
    else onEditVisit?.(visit);
  }

  function runVisitChoice(visit) {
    if (!visitChoice) return;
    if (visitChoice.action === "delete") onDeleteVisit?.(visit.id);
    else onEditVisit?.(visit);
    setVisitChoice(null);
  }

  return (
    <div className={compact ? "place-search compact" : "place-search"}>
      <div className="place-search-title">
        <h3>{title}</h3>
        <span>已添加 {addedPlaces.length}</span>
      </div>
      <div className="mini-form">
        <select
          disabled={!session || !isEditor}
          onChange={(event) => setProfileId(event.target.value)}
          value={profileId}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        <select
          disabled={!session || !isEditor}
          onChange={(event) => setType(event.target.value)}
          value={type}
        >
          {tripTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <DatePrecisionInput
          disabled={!session || !isEditor}
          onChange={setVisitedAt}
          value={visitedAt}
        />
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          disabled={!session || !isEditor}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索国家、城市或省份"
          value={query}
        />
      </label>
      <div className="search-results">
        {query.trim() && results.length === 0 && (
          <p className="empty">没有找到匹配地点。</p>
        )}
        {results.map((place) => (
          <button
            disabled={!session || !isEditor || isSaving}
            key={place.id}
            onClick={() => handleAdd(place)}
            type="button"
          >
            <FlagIcon place={place} />
            <span>
              <strong>{displayPlaceName(place)}</strong>
              <small>
                {displayCountryName({ id: place.countryCode, isoA2: place.isoA2, localName: place.countryName })}
                {place.province ? ` · ${place.province}` : ""}
              </small>
            </span>
            <em>{visitedPlaceIds.has(canonicalPlaceId(place.id)) ? "已去过" : "+"}</em>
          </button>
        ))}
      </div>
      {authMessage && session && <p className="dock-message">{authMessage}</p>}
      <div className="added-list" ref={addedListRef}>
        <p>{activeProfile === "all" ? "去过的地方" : "你去过的地方"}</p>
        {addedPlaces.length === 0 && <small>尚未标记地点。</small>}
        {addedPlaces.map((item) => {
          const { place, visit } = item;
          const itemVisits = item.visits?.length ? item.visits : [visit];
          return (
          <div
            key={visit.id}
            ref={(node) => {
              const key = canonicalPlaceId(place.mapId || place.id);
              if (node) addedItemRefs.current.set(key, node);
              else addedItemRefs.current.delete(key);
            }}
          >
            <FlagIcon place={place} />
            <span>
              <strong>{displayPlaceName(place)}</strong>
              <small>
                {displayCountryName({ id: place.countryCode, isoA2: place.isoA2, localName: place.countryName })}
              </small>
            </span>
            <span className="visit-actions">
              {onEditVisit && (
                <button
                  aria-label={`编辑 ${displayPlaceName(place)}`}
                  disabled={isSaving}
                  onClick={() => chooseVisitAction(item, "edit")}
                  title="编辑"
                  type="button"
                >
                  <Pencil size={14} />
                </button>
              )}
              {onDeleteVisit && (
                <button
                  aria-label={`删除 ${displayPlaceName(place)}`}
                  disabled={isSaving}
                  onClick={() => chooseVisitAction(item, "delete")}
                  title="删除"
                  type="button"
                >
                  <X size={15} />
                </button>
              )}
            </span>
          </div>
          );
        })}
      </div>
      {visitChoice && (
        <div className="visit-choice-popover" role="dialog" aria-modal="false">
          <div>
            <strong>{visitChoice.action === "delete" ? "选择要删除的记录" : "选择要编辑的记录"}</strong>
            <small>{displayPlaceName(visitChoice.place)}</small>
          </div>
          {visitChoice.visits.map((visit) => (
            <button key={visit.id} onClick={() => runVisitChoice(visit)} type="button">
              <span>{profileLabel(visit.profileId)}</span>
              <small>
                {displayVisitDate(visit) || "未填写日期"} · {visit.type || "旅行"}
              </small>
            </button>
          ))}
          <button className="ghost" onClick={() => setVisitChoice(null)} type="button">
            取消
          </button>
        </div>
      )}
    </div>
  );
}

function AuthDialog({ authMessage, isEditor, onClose, onSignIn, onSignOut, session }) {
  return (
    <div className="modal-backdrop auth-dialog-backdrop" role="dialog" aria-label="Supabase 登录">
      <section className="auth-dialog">
        <header>
          <div>
            <p className="eyebrow">Supabase</p>
            <h2>{session ? "编辑账号" : "登录编辑账号"}</h2>
          </div>
          <button aria-label="关闭" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <AuthMiniPanel
          authMessage={authMessage}
          isEditor={isEditor}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          session={session}
        />
      </section>
    </div>
  );
}

function AuthMiniPanel({ authMessage, isEditor, onSignIn, onSignOut, session }) {
  if (!onSignIn) return null;
  if (session) {
    return (
      <div className="auth-mini signed-in">
        <span>{isEditor ? "编辑账号已连接" : "账号无编辑权限"}</span>
        <small>{session.user.email}</small>
        <button onClick={onSignOut} type="button">退出</button>
      </div>
    );
  }
  return (
    <form className="auth-mini" onSubmit={onSignIn}>
      <input name="email" placeholder="Supabase 邮箱" required type="email" />
      <input name="password" placeholder="密码" required type="password" />
      <button type="submit">
        <LogIn size={15} />
        登录
      </button>
      {authMessage && <small>{authMessage}</small>}
    </form>
  );
}

function VisitEditDialog({
  authMessage,
  isSaving,
  onClose,
  onDeleteVisit,
  onUpdateVisit,
  place,
  visit,
}) {
  const [visitedAt, setVisitedAt] = useState(displayVisitDate(visit));
  const [type, setType] = useState(visit.type || "旅行");
  const [rating, setRating] = useState(visit.rating || 0);

  useEffect(() => {
    setVisitedAt(displayVisitDate(visit));
    setType(visit.type || "旅行");
    setRating(visit.rating || 0);
  }, [visit.id, visit.rating, visit.type, visit.visitedAt]);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onUpdateVisit(visit.id, {
      file: form.get("photo"),
      rating,
      type,
      visitedAt,
    });
  }

  async function handleDelete() {
    const ok = await onDeleteVisit(visit.id);
    if (ok) onClose();
  }

  return (
    <div className="edit-dialog-backdrop" role="presentation">
      <form className="visit-edit-dialog" onSubmit={handleSubmit}>
        <div className="visit-edit-head">
          <div>
            <p className="eyebrow">Edit Visit</p>
            <h3>{displayPlaceName(place)}</h3>
            <span>{displayCountryName({ id: place?.countryCode, isoA2: place?.isoA2, localName: place?.countryName })}</span>
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <label>
          日期
          <DatePrecisionInput onChange={setVisitedAt} value={visitedAt || ""} />
        </label>
        <label>
          类型
          <select onChange={(event) => setType(event.target.value)} value={type}>
            {tripTypes.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="rating-row" aria-label="评分">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              aria-label={`${value} 星`}
              className={rating >= value ? "active" : ""}
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              <Star size={18} />
            </button>
          ))}
        </div>
        <label>
          上传照片
          <input name="photo" type="file" />
        </label>
        {authMessage && <p className="dock-message">{authMessage}</p>}
        <div className="visit-edit-actions">
          <button className="secondary-action" disabled={isSaving} onClick={handleDelete} type="button">
            <Trash2 size={16} />
            删除
          </button>
          <button className="primary-action" disabled={isSaving} type="submit">
            保存修改
          </button>
        </div>
      </form>
    </div>
  );
}

function DetailPanel({ placeLookup, profiles, selectedPlaceId, visits }) {
  const place = placeLookup.get(selectedPlaceId);
  if (!place) return null;

  return (
    <aside className="detail-panel">
      <p className="eyebrow">Selected</p>
      <h2>{place.localName}</h2>
      <p className="place-path">{formatPath(place.id, placeLookup)}</p>
      <div className="detail-stats">
        <span>{visits.length} 次记录</span>
        <span>{place.level}</span>
      </div>
      <div className="visit-stack">
        {visits.length === 0 && <p className="empty">还没有符合当前筛选的足迹。</p>}
        {visits.map((visit) => (
          <article className="visit-item" key={visit.id}>
            <div>
              <strong>{profiles.find((profile) => profile.id === visit.profileId)?.name}</strong>
              <span>{displayVisitDate(visit) || "未填写日期"}</span>
            </div>
            <p>{visit.note}</p>
            <small>{visit.type}</small>
            {visit.photos.length > 0 && (
              <img alt={visit.photos[0].name} src={visit.photos[0].url} />
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}

function VisitList({ placeLookup, profiles, visits }) {
  return (
    <section className="list-view">
      <div className="section-title">
        <p className="eyebrow">Records</p>
        <h2>足迹列表</h2>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <span>人物</span>
          <span>地点</span>
          <span>日期</span>
          <span>类型</span>
          <span>备注</span>
        </div>
        {visits.map((visit) => (
          <div className="table-row" key={visit.id}>
            <span>{profiles.find((profile) => profile.id === visit.profileId)?.name}</span>
            <span>{formatPath(visit.placeId, placeLookup)}</span>
            <span>{displayVisitDate(visit) || "未填写日期"}</span>
            <span>{visit.type}</span>
            <span>{visit.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TravelOverview({ activeProfile, continentSummary, profileSummaries = [] }) {
  const defaultContinents = ["亚洲", "欧洲", "北美洲", "南美洲", "非洲", "大洋洲", "南极洲"];
  const [expandedCountries, setExpandedCountries] = useState(new Set());

  function renderContinentTitle(label) {
    const imagePath = CONTINENT_ICON_IMAGES[label];
    return (
      <span className="continent-title">
        {label}
        <span className="continent-icon" aria-hidden="true">
          {imagePath ? (
            <img
              alt=""
              src={`${import.meta.env.BASE_URL}${imagePath}`}
            />
          ) : (
            <svg viewBox="0 0 64 50" focusable="false">
              <path d={CONTINENT_SHAPES[label] || "M10 18 L24 8 L38 18 L24 30 Z"} />
            </svg>
          )}
        </span>
      </span>
    );
  }

  function normalizeSummary(summary) {
    const existing = new Set(summary.map((item) => item.label));
    return [
      ...summary,
      ...defaultContinents
        .filter((label) => !existing.has(label))
        .map((label) => ({ label, count: 0, cityCount: 0, countryCount: 0, countryTotal: label === "南极洲" ? 0 : 0, countries: [] })),
    ].sort((a, b) => {
      const aHasVisits = (a.cityCount || 0) > 0 || (a.countryCount || 0) > 0;
      const bHasVisits = (b.cityCount || 0) > 0 || (b.countryCount || 0) > 0;
      if (aHasVisits !== bHasVisits) return aHasVisits ? -1 : 1;
      return defaultContinents.indexOf(a.label) - defaultContinents.indexOf(b.label);
    });
  }

  function toggleCountry(countryId) {
    setExpandedCountries((current) => {
      const next = new Set(current);
      if (next.has(countryId)) next.delete(countryId);
      else next.add(countryId);
      return next;
    });
  }

  function alignIds(leftItems, rightItems, weightGetter = (item) => item?.visits || 0) {
    const leftMap = new Map(leftItems.map((item) => [item.id, item]));
    const rightMap = new Map(rightItems.map((item) => [item.id, item]));
    const leftIds = new Set(leftMap.keys());
    const rightIds = new Set(rightMap.keys());
    const sorter = (a, b) => {
      const weight =
        (weightGetter(leftMap.get(b)) + weightGetter(rightMap.get(b))) -
        (weightGetter(leftMap.get(a)) + weightGetter(rightMap.get(a)));
      if (weight !== 0) return weight;
      const aName = leftMap.get(a)?.name || rightMap.get(a)?.name || a;
      const bName = leftMap.get(b)?.name || rightMap.get(b)?.name || b;
      return aName.localeCompare(bName, "zh-CN");
    };
    const common = Array.from(leftIds).filter((id) => rightIds.has(id)).sort(sorter);
    const leftOnly = Array.from(leftIds).filter((id) => !rightIds.has(id)).sort(sorter);
    const rightOnly = Array.from(rightIds).filter((id) => !leftIds.has(id)).sort(sorter);
    return [...common, ...leftOnly, ...rightOnly];
  }

  function detailOrderForPair(leftCountry, rightCountry) {
    if (!leftCountry && !rightCountry) return null;
    return alignIds(leftCountry?.detailGroups || [], rightCountry?.detailGroups || [], (group) => group?.cities?.length || 0);
  }

  function renderContinentBody(
    continent,
    countryOrder = null,
    detailOrders = new Map(),
    detailMeta = new Map(),
    countryMeta = new Map(),
    sideIndex = null,
    chipMeta = new Map(),
  ) {
    const countryById = new Map(continent.countries.map((country) => [country.id, country]));
    const countries = countryOrder
      ? countryOrder.map((countryId) => countryById.get(countryId) || {
          id: countryId,
          placeholder: true,
        })
      : continent.countries;

    return (
      <div className="continent-body">
        {countries.length === 0 && <p className="empty">尚未标记地点。</p>}
        {countries.map((country) => {
          if (country.placeholder) {
            return (
              <div className="country-summary country-summary-placeholder" key={country.id} aria-hidden="true">
                <div className="country-summary-main">
                  <span />
                  <span>{countryMeta.get(country.id)?.name || " "}</span>
                </div>
              </div>
            );
          }
          const expanded = expandedCountries.has(country.id);
          const rawDetailGroups = country.detailGroups.length > 0
            ? country.detailGroups
            : [
                {
                  id: country.id + "-cities",
                  name: "城市 / 地点",
                  cities: Array.from(country.cityNames).sort((a, b) => a.localeCompare(b, "zh-CN")),
                },
              ].filter((group) => group.cities.length > 0);
          const detailOrder = detailOrders.get(country.id);
          const groupMeta = detailMeta.get(country.id) || new Map();
          const detailGroups = detailOrder
            ? detailOrder
                .map((groupId) => rawDetailGroups.find((group) => group.id === groupId) || {
                  id: groupId,
                  name: groupMeta.get(groupId)?.name || "",
                  cities: [],
                  placeholder: true,
                })
            : rawDetailGroups;
          const regionLabel = country.regions.size
            ? country.regions.size + " " + (country.id === "CHN" ? "省份" : "省州") + "，"
            : "";
          return (
            <div
              className="country-summary"
              key={country.id}
              style={{ "--country-dot": countryDotColor(country.id) }}
            >
              <button
                aria-expanded={expanded}
                aria-label={(expanded ? "收起" : "展开") + country.name}
                className="country-summary-main"
                onClick={() => toggleCountry(country.id)}
                type="button"
              >
                <span className="country-dot" aria-hidden="true" />
                <span className="country-name-wrap">
                  <FlagIcon place={country.place} />
                  <strong>{country.name}</strong>
                </span>
                <span className="country-count">
                  {regionLabel}
                  {country.cities.size || country.visits} 城市 / 地点
                </span>
                <span className="country-chevron" aria-hidden="true">
                  {expanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                </span>
              </button>
              {expanded && detailGroups.length > 0 && (
                <div className="country-summary-detail">
                  {detailGroups.map((group) => (
                    <div
                      className={[
                        "country-detail-group",
                        group.placeholder ? "detail-placeholder" : "",
                        country.regions.size > 0 ? "aligned-detail-group" : "",
                      ].filter(Boolean).join(" ")}
                      key={group.id}
                      style={{ "--detail-rows": groupMeta.get(group.id)?.rows || Math.max(1, Math.ceil(group.cities.length / 6)) }}
                    >
                      {country.regions.size > 0 && (
                        <div className="country-detail-head">
                          <strong>{group.name}</strong>
                          <span>{group.cities.length} 城市 / 地点</span>
                        </div>
                      )}
                      <div className="city-chip-list">
                        {group.cities.map((cityName) => {
                          const chipState = chipMeta.get(`${country.id}::${group.id}::${cityName}`);
                          const chipClass = [
                            "city-chip",
                            sideIndex === 0 && chipState === "left-only" ? "chip-left-only" : "",
                            sideIndex === 1 && chipState === "right-only" ? "chip-right-only" : "",
                            chipState === "shared" ? "chip-shared" : "",
                          ].filter(Boolean).join(" ");
                          return (
                            <span className={chipClass} key={cityName}>
                              {cityName}
                              <MapPin size={15} />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (activeProfile === "all" && profileSummaries.length >= 2) {
    const normalized = profileSummaries.map((item) => ({ ...item, summary: normalizeSummary(item.summary) }));
    const labels = defaultContinents
      .filter((label) => normalized.some((item) => item.summary.some((continent) => continent.label === label)))
      .sort((a, b) => {
        const aHasVisits = normalized.some(({ summary }) => {
          const continent = summary.find((item) => item.label === a);
          return (continent?.cityCount || continent?.count || continent?.countryCount || 0) > 0;
        });
        const bHasVisits = normalized.some(({ summary }) => {
          const continent = summary.find((item) => item.label === b);
          return (continent?.cityCount || continent?.count || continent?.countryCount || 0) > 0;
        });
        if (aHasVisits !== bHasVisits) return aHasVisits ? -1 : 1;
        return defaultContinents.indexOf(a) - defaultContinents.indexOf(b);
      });
    return (
      <section className="overview-section comparison-overview" aria-label="足迹对比总览">
        <div className="section-title">
          <p className="eyebrow">Overview</p>
          <h2>按大洲对比足迹</h2>
        </div>
        <div className="comparison-head">
          {normalized.slice(0, 2).map(({ profile }) => (
            <strong key={profile.id}>{profile.name}</strong>
          ))}
        </div>
        <div className="comparison-continent-stack">
          {labels.map((label) => {
            const pairedContinents = normalized.slice(0, 2).map(({ summary }) =>
              summary.find((item) => item.label === label) || { label, cityCount: 0, countryCount: 0, countryTotal: label === "南极洲" ? 0 : 0, countries: [] },
            );
            const countryOrder = alignIds(pairedContinents[0].countries, pairedContinents[1].countries);
            const leftCountryMap = new Map(pairedContinents[0].countries.map((country) => [country.id, country]));
            const rightCountryMap = new Map(pairedContinents[1].countries.map((country) => [country.id, country]));
            const countryMeta = new Map(
              countryOrder.map((countryId) => {
                const country = leftCountryMap.get(countryId) || rightCountryMap.get(countryId);
                return [countryId, { name: country?.name || "" }];
              }),
            );
            const detailOrders = new Map(
              countryOrder.map((countryId) => [
                countryId,
                detailOrderForPair(leftCountryMap.get(countryId), rightCountryMap.get(countryId)),
              ]),
            );
            const detailMeta = new Map(
              countryOrder.map((countryId) => {
                const groupOrder = detailOrders.get(countryId) || [];
                const leftGroups = new Map((leftCountryMap.get(countryId)?.detailGroups || []).map((group) => [group.id, group]));
                const rightGroups = new Map((rightCountryMap.get(countryId)?.detailGroups || []).map((group) => [group.id, group]));
                return [
                  countryId,
                  new Map(
                    groupOrder.map((groupId) => {
                      const group = leftGroups.get(groupId) || rightGroups.get(groupId);
                      const maxCities = Math.max(
                        leftGroups.get(groupId)?.cities?.length || 0,
                        rightGroups.get(groupId)?.cities?.length || 0,
                      );
                      return [
                        groupId,
                        {
                          name: group?.name || "",
                          rows: Math.max(1, Math.ceil(maxCities / 6)),
                        },
                      ];
                    }),
                  ),
                ];
              }),
            );
            const chipMeta = new Map();
            for (const countryId of countryOrder) {
              const groupOrder = detailOrders.get(countryId) || [];
              const leftGroups = new Map((leftCountryMap.get(countryId)?.detailGroups || []).map((group) => [group.id, group]));
              const rightGroups = new Map((rightCountryMap.get(countryId)?.detailGroups || []).map((group) => [group.id, group]));
              for (const groupId of groupOrder) {
                const leftCities = new Set(leftGroups.get(groupId)?.cities || []);
                const rightCities = new Set(rightGroups.get(groupId)?.cities || []);
                for (const cityName of new Set([...leftCities, ...rightCities])) {
                  const key = `${countryId}::${groupId}::${cityName}`;
                  if (leftCities.has(cityName) && rightCities.has(cityName)) chipMeta.set(key, "shared");
                  else if (leftCities.has(cityName)) chipMeta.set(key, "left-only");
                  else if (rightCities.has(cityName)) chipMeta.set(key, "right-only");
                }
              }
            }
            return (
              <article className="comparison-continent-row" key={label} style={{ "--continent-accent": CONTINENT_ACCENTS[label] || "#2563eb" }}>
                <header>
                  <h3>{renderContinentTitle(label)}</h3>
                </header>
                <div className="comparison-columns">
                  {normalized.slice(0, 2).map(({ profile }, index) => {
                    const continent = pairedContinents[index];
                    return (
                      <div className="comparison-column" key={profile.id}>
                        <div className="continent-mini-stat">
                          <strong>{continent.countryCount || 0}/{continent.countryTotal || 0} 国家</strong>
                          <span>{continent.cityCount || continent.count || 0} 城市</span>
                        </div>
                        {renderContinentBody(continent, countryOrder, detailOrders, detailMeta, countryMeta, index, chipMeta)}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const items = normalizeSummary(continentSummary);
  return (
    <section className="overview-section" aria-label="足迹总览">
      <div className="section-title">
        <p className="eyebrow">Overview</p>
        <h2>按大洲浏览足迹</h2>
      </div>
      <div className="continent-stack">
        {items.map((continent) => (
          <article
            className="continent-block"
            key={continent.label}
            style={{ "--continent-accent": CONTINENT_ACCENTS[continent.label] || "#2563eb" }}
          >
            <header>
              <h3>{renderContinentTitle(continent.label)}</h3>
              <div className="continent-stat">
                <strong>{continent.countryCount || 0}/{continent.countryTotal || 0} 国家</strong>
                <span>{continent.cityCount || continent.count || 0} 城市</span>
              </div>
            </header>
            {renderContinentBody(continent)}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminForm({
  addVisit,
  authMessage,
  isEditor,
  isSaving,
  onSignIn,
  onSignOut,
  placeLookup,
  profiles,
  session,
}) {
  if (!session) {
    return (
      <section className="admin-view">
        <div className="section-title">
          <p className="eyebrow">Editor Login</p>
          <h2>登录后编辑足迹</h2>
        </div>
        <form className="editor-form auth-form" onSubmit={onSignIn}>
          <label>
            Supabase 邮箱
            <input name="email" required type="email" />
          </label>
          <label>
            密码
            <input name="password" required type="password" />
          </label>
          <button className="primary-action" type="submit">
            <ShieldCheck size={18} />
            登录
          </button>
          {authMessage && <p className="form-message wide">{authMessage}</p>}
        </form>
      </section>
    );
  }

  if (!isEditor) {
    return (
      <section className="admin-view">
        <div className="section-title">
          <p className="eyebrow">Editor Permission</p>
          <h2>当前账号没有编辑权限</h2>
        </div>
        <p className="form-message">
          已登录 {session.user.email}，但它不在 app_editors 表里。
        </p>
        <button className="primary-action inline-action" onClick={onSignOut} type="button">
          退出登录
        </button>
      </section>
    );
  }

  return (
    <section className="admin-view">
      <div className="section-title">
        <p className="eyebrow">Editor Account</p>
        <h2>编辑账号已连接</h2>
        <p className="editor-account">已登录 {session.user.email}</p>
      </div>
      <p className="form-message">
        回到地图页，把鼠标移到最左侧即可展开添加面板；点击某个国家后，右侧国家面板也可以只搜索该国家内的地点。
      </p>
      <button className="primary-action inline-action" onClick={onSignOut} type="button">
        退出登录
      </button>
    </section>
  );
}

export default App;
