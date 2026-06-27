import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CalendarDays,
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
const CHINA_BOUNDS = [
  [18, 73],
  [54, 135],
];
const WORLD_BOUNDS = [
  [-56, -170],
  [81, 179],
];
const WORLD_DEFAULT_VIEW = {
  center: [10, 20],
  zoom: 1.75,
};
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
    fill: "#f4c15d",
    stroke: "#a45c12",
    marker: "#c76a1e",
  },
  {
    fill: "#6aa6d9",
    stroke: "#2463a8",
    marker: "#2563eb",
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
  [CONTINENT_LABELS.Asia]: "M6 17 L12 10 L20 8 L28 11 L35 8 L45 12 L55 19 L51 27 L43 28 L39 34 L31 31 L27 39 L21 33 L14 31 L9 25 Z M42 27 L50 32 L47 39 L40 34 Z",
  [CONTINENT_LABELS.Europe]: "M8 18 L14 13 L22 10 L30 12 L37 10 L46 15 L50 22 L43 25 L37 22 L32 30 L25 26 L17 29 L12 24 Z M21 8 L25 4 L31 8 L25 10 Z",
  [CONTINENT_LABELS.Africa]: "M28 5 L40 12 L45 23 L40 33 L34 42 L26 39 L20 31 L14 22 L18 11 Z M42 24 L50 25 L47 30 L42 29 Z",
  [CONTINENT_LABELS.Oceania]: "M8 27 L18 22 L30 24 L40 30 L35 37 L23 36 L13 32 Z M43 18 L53 20 L57 25 L51 29 L44 25 Z M50 34 L58 36 L55 40 L49 38 Z",
  [CONTINENT_LABELS["North America"]]: "M6 13 L16 7 L29 8 L42 14 L55 22 L49 32 L38 31 L30 24 L21 26 L13 21 Z M29 25 L36 34 L31 41 L25 31 Z",
  [CONTINENT_LABELS["South America"]]: "M28 4 L39 12 L37 23 L32 32 L27 42 L21 36 L19 26 L16 16 L22 9 Z",
  [CONTINENT_LABELS.Antarctica]: "M4 28 L15 22 L27 25 L38 21 L51 24 L60 29 L52 35 L38 37 L25 34 L12 36 Z",
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
  VAT: "梵蒂冈",
  PSE: "巴勒斯坦",
  ATA: "南极洲",
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

function featureToPlace(feature) {
  const props = feature.properties;
  const localName = countryNameZh(
    props.code || props.countryCode || props.id,
    props.isoA2,
    props.localName || props.name,
  );
  return {
    ...props,
    id: props.id,
    level: props.level,
    name: props.name,
    localName,
    parentId: props.parentId,
    countryCode: props.countryCode || props.code || props.id,
    countryName: props.country || localName || props.name,
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
  return next;
}

function normalizeProvinceName(value) {
  return String(value || "")
    .replace(/\[[^\]]+\]/g, "")
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
    },
    geometry: Array.isArray(place.geometry)
      ? { type: "Polygon", coordinates: [place.geometry] }
      : place.geometry,
  };
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

function parseVisitMeta(note) {
  if (!note) return { rating: 0, text: "", datePrecision: "day", dateDisplay: "" };
  try {
    const parsed = JSON.parse(note);
    if (parsed && typeof parsed === "object") {
      return {
        rating: Number(parsed.rating) || 0,
        text: parsed.text || "",
        datePrecision: parsed.datePrecision || "day",
        dateDisplay: parsed.dateDisplay || "",
      };
    }
  } catch {
    // Existing plain-text notes are preserved as text.
  }
  return { rating: 0, text: note, datePrecision: "day", dateDisplay: "" };
}

function buildVisitNote({ dateDisplay = "", datePrecision = "day", rating = 0, text = "" } = {}) {
  const normalizedRating = Math.max(0, Math.min(10, Number(rating) || 0));
  if (!normalizedRating && !text && !dateDisplay) return "";
  return JSON.stringify({ dateDisplay, datePrecision, rating: normalizedRating, text });
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
  const [selectedPlaceId, setSelectedPlaceId] = useState("CHN");
  const [countryModalId, setCountryModalId] = useState(null);
  const [mapPlaces, setMapPlaces] = useState({ country: [], region: [], city: [] });
  const [searchPlaces, setSearchPlaces] = useState([]);
  const [mapStatus, setMapStatus] = useState("正在加载真实边界");
  const [dataStatus, setDataStatus] = useState("正在连接 Supabase");
  const [session, setSession] = useState(null);
  const [isEditor, setIsEditor] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);

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

      const nextProfiles = profilesResult.data.map(mapProfile);
      setAppProfiles(nextProfiles.length > 0 ? nextProfiles : profiles);
      setVisits(visitsResult.data.map(mapVisit));
      setDataStatus("Supabase 已连接");
    } catch (error) {
      console.error(error);
      setAppProfiles(profiles);
      setVisits(initialVisits);
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
          const countryPlaces = countries.features.map((feature) => normalizePlace(featureToPlace(feature)));
          const regionPlaces = states.features.map((feature) => normalizePlace(featureToPlace(feature)));
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TravelMapX</p>
          <h1>足迹地图</h1>
        </div>
        <div className="status-strip" aria-label="项目状态">
          <span>
            <Database size={16} /> {dataStatus}
          </span>
          <span>
            <ShieldCheck size={16} /> {session ? "已登录编辑账号" : "公开只读"}
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
        />
        <MapView
          activeLevel={activeLevel}
          activeProfile={activeProfile}
          cityPlaces={cityPlaces}
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
          visitedPlaces={searchPlaces.filter((place) => visibleVisitedPlaceIds.has(canonicalPlaceId(place.id)))}
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
          onClose={() => setCountryModalId(null)}
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
    </main>
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

function MapView({
  activeLevel,
  activeProfile,
  cityPlaces,
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
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const lastLevelRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [18, 20],
      zoom: 2,
      minZoom: 1,
      maxZoom: 12,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      scrollWheelZoom: true,
      worldCopyJump: false,
      zoomControl: false,
    });
    map.setMaxBounds([
      [-64, -180],
      [84, 180],
    ]);
    L.control.zoom({ position: "bottomleft" }).addTo(map);

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
        features: countryPlaces.map(placeToFeature),
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
        leafletLayer.bindTooltip(feature.properties.localName || feature.properties.name, {
          sticky: true,
        });
        leafletLayer.on("click", () => {
          setSelectedPlaceId(feature.properties.id);
          onCountryOpen(feature.properties.id);
        });
        leafletLayer.on("mouseover", () => {
          setSelectedPlaceId(feature.properties.id);
        });
      },
    }).addTo(layer);

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
      L.circleMarker([lat, lon], {
        radius: activeLevel === "city" ? 5 : 3.5,
        color: mapTheme.markerStroke,
        weight: 1.5,
        fillColor: tone ? tone.marker : mapTheme.emptyStroke,
        fillOpacity: visitInfo.length > 0 ? 0.9 : 0.45,
      })
        .bindTooltip(city.localName, { sticky: true })
        .bindPopup(renderVisitPopup(city, visitInfo, profiles), {
          className: "visit-popup",
          autoPanPaddingBottomRight: [128, 48],
          autoPanPaddingTopLeft: [32, 32],
          maxWidth: 560,
          minWidth: 360,
        })
        .addTo(layer);
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
    cityPlaces,
    displayPlaces,
    placeLookup,
    profiles,
    countryPlaces,
    regionPlaces,
    selectedPlaceId,
    setSelectedPlaceId,
    onCountryOpen,
    mapTheme,
    visitedByLevel,
    visitedByCountry,
    visitedCityVisits,
    visitedPlaces,
  ]);

  return (
    <div className="map-surface" style={{ "--map-bg": mapTheme.background }}>
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
    [cityPlaces, country, placeLookup, profiles, regionPlaces, showLockedPlaces, visits],
  );

  function renderSummaryPanel(summary = null, profile = null) {
    const targetGroups = summary?.grouped || grouped;
    const targetVisitedRegions = summary?.visitedRegions || visitedRegions;
    const targetVisitedCities = summary?.visitedCities || visitedCities;
    const targetRegionProgress = summary?.regionProgress ?? regionProgress;
    const targetCityProgress = summary?.cityProgress ?? cityProgress;
    const targetCoveredRegionText = summary?.coveredRegionText || coveredRegionText;
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
                ? `地图上已点亮 ${targetVisitedRegions.size} / ${regionTotal} 省 / 自治区 · ${targetRegionProgress.toFixed(1)}%`
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
              共 {targetVisitedCities.size} 座城市 · {targetCoveredRegionText}
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
              visitedPlaces={countryPlaces.filter((place) => modalVisitedPlaceIds.has(canonicalPlaceId(place.id)))}
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
                    ? `地图上已点亮 ${visitedRegions.size} / ${regionTotal} 省 / 自治区 · ${regionProgress.toFixed(1)}%`
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
                  共 {visitedCities.size} 座城市 · {coveredRegionText}
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
  const { cityPlaces = [], regionPlaces = [], showLockedPlaces = false } = options;
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
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
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
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
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
}) {
  const miniRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lastFitCountryRef = useRef(null);

  useEffect(() => {
    if (!miniRef.current || mapRef.current) return;
    const map = L.map(miniRef.current, {
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomleft" }).addTo(map);
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
            const label = feature.properties.localName || feature.properties.name;
            if (showLabels && shouldLabel) {
              leafletLayer.bindTooltip(label, {
                className: "mini-map-label",
                direction: "center",
                permanent: true,
              });
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
      })
        .bindTooltip(place.localName || place.name, {
          className: "mini-map-label",
          permanent: false,
          sticky: true,
        })
        .bindPopup(renderVisitPopup(place, visitInfo, profiles), {
          className: "visit-popup",
          autoPanPaddingBottomRight: [128, 48],
          autoPanPaddingTopLeft: [32, 32],
          maxWidth: 560,
          minWidth: 360,
        })
        .addTo(layer);
    }

    layerRef.current = layer;
    window.setTimeout(() => {
      map.invalidateSize();
      if (lastFitCountryRef.current === country.id) return;
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [16, 16], animate: false });
        lastFitCountryRef.current = country.id;
      } else if (country.center) {
        map.setView([country.center[1], country.center[0]], country.id === "CHN" ? 4 : 5);
        lastFitCountryRef.current = country.id;
      }
    }, 60);
  }, [activeProfile, cityPlaces, country, detailLevel, profiles, regionPlaces, showLabels, visitedByLevel, visitedCityVisits, visitedPlaces]);

  return <div className="mini-country-map" ref={miniRef} />;
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
  onDeleteVisit,
  onSignIn,
  onSignOut,
}) {
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [visitedAt, setVisitedAt] = useState("");
  const [type, setType] = useState("旅行");

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
        const key = `${item.visit.profileId}:${canonicalPlaceId(item.place.mapId || item.place.id)}`;
        if (!byPlace.has(key)) byPlace.set(key, item);
      });
    return Array.from(byPlace.values());
  }, [compact, places, visits]);

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

  return (
    <div className={compact ? "place-search compact" : "place-search"}>
      <div className="place-search-title">
        <h3>{title}</h3>
        <span>已添加 {addedPlaces.length}</span>
      </div>
      <AuthMiniPanel
        authMessage={authMessage}
        isEditor={isEditor}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        session={session}
      />
      {!session && <p className="empty">当前未登录编辑账号，登录状态恢复后可直接添加或删除。</p>}
      {session && !isEditor && <p className="empty">当前账号没有编辑权限。</p>}
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
        <input
          disabled={!session || !isEditor}
          onChange={(event) => setVisitedAt(event.target.value)}
          placeholder="YYYY / YYYY-MM / YYYY-MM-DD"
          type="text"
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
      <div className="added-list">
        <p>你去过的地方</p>
        {addedPlaces.length === 0 && <small>尚未标记地点。</small>}
        {addedPlaces.map(({ place, visit }) => (
          <div key={visit.id}>
            <FlagIcon place={place} />
            <span>
              <strong>{displayPlaceName(place)}</strong>
              <small>{displayCountryName({ id: place.countryCode, isoA2: place.isoA2, localName: place.countryName })}</small>
            </span>
            <span className="visit-actions">
              {onEditVisit && (
                <button
                  aria-label={`编辑 ${displayPlaceName(place)}`}
                  disabled={isSaving}
                  onClick={() => onEditVisit(visit)}
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
                  onClick={() => onDeleteVisit(visit.id)}
                  title="删除"
                  type="button"
                >
                  <X size={15} />
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
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
          <input
            onChange={(event) => setVisitedAt(event.target.value)}
            placeholder="YYYY / YYYY-MM / YYYY-MM-DD"
            type="text"
            value={visitedAt || ""}
          />
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
    return (
      <span className="continent-title">
        {label}
        <span className="continent-icon" aria-hidden="true">
          <svg viewBox="0 0 64 44" focusable="false">
            <path d={CONTINENT_SHAPES[label] || "M10 16 L24 6 L38 16 L24 26 Z"} />
          </svg>
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
