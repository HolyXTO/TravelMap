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
  User,
  X,
  Users,
  Calendar,
  Map as MapIcon,
} from "lucide-react";
import {
  initialVisits,
  placeLevels,
  places,
  profiles,
  tripTypes,
} from "./data/mockData";
import countryGalleryImages from "./data/countryGallery";
import provinceGalleryImages from "./data/provinceGallery";
import { supabase } from "./lib/supabase";
import { defaultTravelNotes } from "./data/defaultNotes";


const staticVisits = initialVisits.map((v) => {
  return {
    id: v.id,
    profileId: v.profileId || v.profile_id,
    placeId: v.placeId || v.place_id,
    visitedAt: v.visitedAt || v.visited_at,
    dateDisplay: v.dateDisplay || v.visitedAt || v.visited_at,
    datePrecision: v.datePrecision || "day",
    type: v.type || v.trip_type,
    note: v.note || "",
    rating: v.rating || 10,
    photos: v.photos || [],
  };
});

const PHOTO_BUCKET = "travel-photos";
const ASSET_BASE_URL = import.meta.env.BASE_URL || "/";

function handleImageLoadError(e) {
  const img = e.target;
  const maxRetries = 6;
  if (!img.dataset.retryCount) {
    img.dataset.retryCount = "0";
  }
  let count = parseInt(img.dataset.retryCount, 10);
  if (count < maxRetries) {
    count++;
    img.dataset.retryCount = String(count);
    const originalSrc = img.src.split("?")[0];
    setTimeout(() => {
      img.src = `${originalSrc}?r=${count}-${Date.now()}`;
    }, 1500 * count);
  }
}

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

const outOfChina = (lat, lng) => {
  if (lng < 72.004 || lng > 137.8347) return true;
  if (lat < 18.0 || lat > 55.8271) return true;
  return false;
};

const withTimeout = (promise, ms = 4000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Supabase 连接超时，可能是由于未开启代理加速器或网络限制。"));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const isNoteDomestic = (note) => {
  if (!note) return false;
  if (note.center) {
    return !outOfChina(note.center[0], note.center[1]);
  }
  if (note.addresses && note.addresses.length > 0) {
    const first = note.addresses[0];
    if (first.coordinates) {
      return !outOfChina(first.coordinates.lat, first.coordinates.lng);
    }
  }
  return false;
};

const wgs84ToGcj02 = (lat, lng) => {
  if (outOfChina(lat, lng)) {
    return [lat, lng];
  }

  const pi = 3.1415926535897932384626;
  const a = 6378245.0;
  const ee = 0.00669342162296594323;

  const transformLat = (x, y) => {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * pi) + 40.0 * Math.sin(y / 3.0 * pi)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * pi) + 320 * Math.sin(y * pi / 30.0)) * 2.0 / 3.0;
    return ret;
  };

  const transformLng = (x, y) => {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * pi) + 40.0 * Math.sin(x / 3.0 * pi)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * pi) + 300.0 * Math.sin(x / 30.0 * pi)) * 2.0 / 3.0;
    return ret;
  };

  const dLat = transformLat(lng - 105.0, lat - 35.0);
  const dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * pi;
  let magic = Math.sin(radLat);
  magic = 1.0 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const transformDLat = (dLat * 180.0) / ((a * (1.0 - ee)) / (magic * sqrtMagic) * pi);
  const transformDLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * pi);
  
  return [lat + transformDLat, lng + transformDLng];
};

const adjustCoords = (coords, tileSource) => {
  if (!coords) return coords;
  const lat = coords.lat ?? coords[0];
  const lng = coords.lng ?? coords[1];
  
  if (tileSource === "amap") {
    const [adjLat, adjLng] = wgs84ToGcj02(lat, lng);
    return Array.isArray(coords) ? [adjLat, adjLng] : { lat: adjLat, lng: adjLng };
  }
  return coords;
};

const TIANDITU_KEY = "68a2c44c031deb6991a26247553e0dbe";

const getTileLayersConfigs = (tileSource, type, themeId = "") => {
  if (tileSource === "tianditu") {
    // 天地图 (China's official national map platform with full Chinese labels globally)
    if (type === "dark" || themeId === "ink") {
      return [
        {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
        }
      ];
    }
    if (type === "light" || themeId === "ocean" || themeId === "copper") {
      return [
        {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
        }
      ];
    }
    return [
      {
        url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
        attribution: "&copy; 国家地理信息公共服务平台 (天地图)",
        subdomains: "01234567"
      },
      {
        url: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
        attribution: "&copy; 国家地理信息公共服务平台 (天地图)",
        subdomains: "01234567"
      }
    ];
  }

  if (tileSource === "amap") {
    // 高德地图 (AutoNavi - Full Chinese labels, works fast inside China, but only inside China borders for street zoom levels)
    if (type === "dark" || themeId === "ink") {
      return [
        {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
        }
      ];
    }
    if (type === "light" || themeId === "ocean" || themeId === "copper") {
      return [
        {
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
        }
      ];
    }
    return [
      {
        url: "https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7",
        attribution: "&copy; 高德地图 (AutoNavi)",
        subdomains: "1234"
      }
    ];
  }

  // Default to Esri/ArcGIS Online (direct)
  if (type === "dark" || themeId === "ink") {
    return [
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
      }
    ];
  }
  if (type === "light" || themeId === "ocean" || themeId === "copper") {
    return [
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
      }
    ];
  }
  return [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom"
    }
  ];
};

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
        if (entry.isIntersecting) {
          setIsNear(true);
          // 锁定为加载状态后，立即注销对该元素的观察，降低浏览器开销
          observer.unobserve(node);
        }
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

const CONTINENT_ENGLISH_LABELS = {
  亚洲: "Asia",
  欧洲: "Europe",
  非洲: "Africa",
  大洋洲: "Oceania",
  北美洲: "North America",
  南美洲: "South America",
  南极洲: "Antarctica",
};

const COUNTRY_GALLERY_ALIASES = {
  阿拉伯联合酋长国: "阿联酋",
  波斯尼亚和黑塞哥维那: "波黑",
  捷克共和国: "捷克",
  大韩民国: "韩国",
  俄罗斯联邦: "俄罗斯",
  梵蒂冈城国: "梵蒂冈",
  教廷: "梵蒂冈",
  黑山共和国: "黑山",
  朝鲜民主主义人民共和国: "朝鲜",
  大不列颠及北爱尔兰联合王国: "英国",
  联合王国: "英国",
  密克罗尼西亚联邦: "密克罗尼西亚",
  北马其顿共和国: "北马其顿",
  巴勒斯坦国: "巴勒斯坦",
  伊朗伊斯兰共和国: "伊朗",
  阿富汗伊斯兰酋长国: "阿富汗",
  阿拉伯叙利亚共和国: "叙利亚",
  沙特阿拉伯王国: "沙特阿拉伯",
  特立尼达和多巴哥共和国: "特立尼达和多巴哥",
  摩尔多瓦共和国: "摩尔多瓦",
  巴布亚新几内亚独立国: "巴布亚新几内亚",
  圣马力诺共和国: "圣马力诺",
  斯洛伐克共和国: "斯洛伐克",
};

const COUNTRY_GALLERY_META = {
  中国: { english: "China", native: "中国" },
  丹麦: { english: "Denmark", native: "Danmark" },
  保加利亚: { english: "Bulgaria", native: "България" },
  克罗地亚: { english: "Croatia", native: "Hrvatska" },
  冰岛: { english: "Iceland", native: "Ísland" },
  列支敦士登: { english: "Liechtenstein", native: "Liechtenstein" },
  匈牙利: { english: "Hungary", native: "Magyarország" },
  南非: { english: "South Africa", native: "South Africa" },
  卡塔尔: { english: "Qatar", native: "قطر" },
  卢森堡: { english: "Luxembourg", native: "Lëtzebuerg" },
  圣马力诺: { english: "San Marino", native: "San Marino" },
  塞尔维亚: { english: "Serbia", native: "Србија" },
  塞浦路斯: { english: "Cyprus", native: "Κύπρος" },
  奥地利: { english: "Austria", native: "Österreich" },
  安道尔: { english: "Andorra", native: "Andorra" },
  希腊: { english: "Greece", native: "Ελλάδα" },
  德国: { english: "Germany", native: "Deutschland" },
  意大利: { english: "Italy", native: "Italia" },
  拉脱维亚: { english: "Latvia", native: "Latvija" },
  挪威: { english: "Norway", native: "Norge" },
  捷克: { english: "Czechia", native: "Česko" },
  摩纳哥: { english: "Monaco", native: "Monaco" },
  斯洛伐克: { english: "Slovakia", native: "Slovensko" },
  斯洛文尼亚: { english: "Slovenia", native: "Slovenija" },
  新加坡: { english: "Singapore", native: "Singapore" },
  新西兰: { english: "New Zealand", native: "Aotearoa" },
  梵蒂冈: { english: "Vatican City", native: "Città del Vaticano" },
  比利时: { english: "Belgium", native: "België" },
  波兰: { english: "Poland", native: "Polska" },
  法国: { english: "France", native: "France" },
  瑞典: { english: "Sweden", native: "Sverige" },
  瑞士: { english: "Switzerland", native: "Schweiz" },
  爱沙尼亚: { english: "Estonia", native: "Eesti" },
  罗马尼亚: { english: "Romania", native: "România" },
  芬兰: { english: "Finland", native: "Suomi" },
  荷兰: { english: "Netherlands", native: "Nederland" },
  葡萄牙: { english: "Portugal", native: "Portugal" },
  西班牙: { english: "Spain", native: "España" },
  马耳他: { english: "Malta", native: "Malta" },
  阿尔巴尼亚: { english: "Albania", native: "Shqipëria" },
  阿联酋: { english: "United Arab Emirates", native: "الإمارات العربية المتحدة" },
  波黑: { english: "Bosnia and Herzegovina", native: "Bosna i Hercegovina" },
  黑山: { english: "Montenegro", native: "Crna Gora" },
  韩国: { english: "South Korea", native: "한국" },
  立陶宛: { english: "Lithuania", native: "Lietuva" },
  乌克兰: { english: "Ukraine", native: "Україна" },
  也门: { english: "Yemen", native: "اليمن" },
  以色列: { english: "Israel", native: "ישראל" },
  伊拉克: { english: "Iraq", native: "العراق" },
  伊朗: { english: "Iran", native: "ایران" },
  俄罗斯: { english: "Russia", native: "Россия" },
  北马其顿: { english: "North Macedonia", native: "Северна Македонија" },
  印度: { english: "India", native: "भारत" },
  印度尼西亚: { english: "Indonesia", native: "Indonesia" },
  叙利亚: { english: "Syria", native: "سوريا" },
  土耳其: { english: "Turkey", native: "Türkiye" },
  圣文森特和格林纳丁斯: { english: "Saint Vincent and the Grenadines", native: "Saint Vincent" },
  埃及: { english: "Egypt", native: "مصر" },
  墨西哥: { english: "Mexico", native: "México" },
  密克罗尼西亚: { english: "Micronesia", native: "Micronesia" },
  巴勒斯坦: { english: "Palestine", native: "فلسطين" },
  巴基斯坦: { english: "Pakistan", native: "پاکستان" },
  巴巴多斯: { english: "Barbados", native: "Barbados" },
  巴布亚新几内亚: { english: "Papua New Guinea", native: "Papua New Guinea" },
  巴林: { english: "Bahrain", native: "البحرين" },
  摩尔多瓦: { english: "Moldova", native: "Moldova" },
  斐济: { english: "Fiji", native: "Fiji" },
  斯里兰卡: { english: "Sri Lanka", native: "ශ්‍රී ලංකාව" },
  日本: { english: "Japan", native: "日本" },
  朝鲜: { english: "North Korea", native: "조선" },
  沙特阿拉伯: { english: "Saudi Arabia", native: "السعودية" },
  澳大利亚: { english: "Australia", native: "Australia" },
  爱尔兰: { english: "Ireland", native: "Éire" },
  特立尼达和多巴哥: { english: "Trinidad and Tobago", native: "Trinidad and Tobago" },
  白俄罗斯: { english: "Belarus", native: "Беларусь" },
  科威特: { english: "Kuwait", native: "الكويت" },
  约旦: { english: "Jordan", native: "الأردن" },
  英国: { english: "United Kingdom", native: "United Kingdom" },
  菲律宾: { english: "Philippines", native: "Pilipinas" },
  蒙古: { english: "Mongolia", native: "Монгол" },
  阿富汗: { english: "Afghanistan", native: "افغانستان" },
  阿曼: { english: "Oman", native: "عمان" },
  阿根廷: { english: "Argentina", native: "Argentina" },
  马尔代夫: { english: "Maldives", native: "ދިވެހި" },
  马来西亚: { english: "Malaysia", native: "Malaysia" },
  黎巴嫩: { english: "Lebanon", native: "لبنان" },
  阿尔及利亚: { english: "Algeria", native: "الجزائر" },
  阿塞拜疆: { english: "Azerbaijan", native: "Azərbaycan" },
  埃塞俄比亚: { english: "Ethiopia", native: "ኢትዮጵያ" },
  安哥拉: { english: "Angola", native: "Angola" },
  安提瓜和巴布达: { english: "Antigua and Barbuda", native: "Antigua and Barbuda" },
  巴哈马: { english: "Bahamas", native: "The Bahamas" },
  巴拉圭: { english: "Paraguay", native: "Paraguái" },
  巴拿马: { english: "Panama", native: "Panamá" },
  巴西: { english: "Brazil", native: "Brasil" },
  贝宁: { english: "Benin", native: "Bénin" },
  玻利维亚: { english: "Bolivia", native: "Bolivia" },
  伯利兹: { english: "Belize", native: "Belize" },
  博茨瓦纳: { english: "Botswana", native: "Botswana" },
  不丹: { english: "Bhutan", native: "འབྲུག་ཡུལ" },
  布基纳法索: { english: "Burkina Faso", native: "Burkina Faso" },
  布隆迪: { english: "Burundi", native: "Burundi" },
  赤道几内亚: { english: "Equatorial Guinea", native: "Guinea Ecuatorial" },
  东帝汶: { english: "Timor-Leste", native: "Timor-Leste" },
  多哥: { english: "Togo", native: "Togo" },
  多米尼加: { english: "Dominican Republic", native: "República Dominicana" },
  多米尼克: { english: "Dominica", native: "Dominica" },
  厄瓜多尔: { english: "Ecuador", native: "Ecuador" },
  厄立特里亚: { english: "Eritrea", native: "ኤርትራ" },
  佛得角: { english: "Cabo Verde", native: "Cabo Verde" },
  冈比亚: { english: "The Gambia", native: "The Gambia" },
  "刚果(布)": { english: "Republic of the Congo", native: "République du Congo" },
  "刚果(金)": { english: "Democratic Republic of the Congo", native: "République démocratique du Congo" },
  哥伦比亚: { english: "Colombia", native: "Colombia" },
  哥斯达黎加: { english: "Costa Rica", native: "Costa Rica" },
  格林纳达: { english: "Grenada", native: "Grenada" },
  格鲁吉亚: { english: "Georgia", native: "საქართველო" },
  古巴: { english: "Cuba", native: "Cuba" },
  圭亚那: { english: "Guyana", native: "Guyana" },
  哈萨克斯坦: { english: "Kazakhstan", native: "Қазақстан" },
  海地: { english: "Haiti", native: "Haïti" },
  洪都拉斯: { english: "Honduras", native: "Honduras" },
  基里巴斯: { english: "Kiribati", native: "Kiribati" },
  吉布提: { english: "Djibouti", native: "Djibouti" },
  吉尔吉斯斯坦: { english: "Kyrgyzstan", native: "Кыргызстан" },
  几内亚: { english: "Guinea", native: "Guinée" },
  几内亚比绍: { english: "Guinea-Bissau", native: "Guiné-Bissau" },
  加拿大: { english: "Canada", native: "Canada" },
  加纳: { english: "Ghana", native: "Ghana" },
  加蓬: { english: "Gabon", native: "Gabon" },
  柬埔寨: { english: "Cambodia", native: "កម្ពុជា" },
  津巴布韦: { english: "Zimbabwe", native: "Zimbabwe" },
  喀麦隆: { english: "Cameroon", native: "Cameroun" },
  科摩罗: { english: "Comoros", native: "Comores" },
  科特迪瓦: { english: "Cote d'Ivoire", native: "Côte d'Ivoire" },
  肯尼亚: { english: "Kenya", native: "Kenya" },
  莱索托: { english: "Lesotho", native: "Lesotho" },
  老挝: { english: "Laos", native: "ລາວ" },
  利比里亚: { english: "Liberia", native: "Liberia" },
  利比亚: { english: "Libya", native: "ليبيا" },
  卢旺达: { english: "Rwanda", native: "Rwanda" },
  马达加斯加: { english: "Madagascar", native: "Madagasikara" },
  马拉维: { english: "Malawi", native: "Malawi" },
  马里: { english: "Mali", native: "Mali" },
  马绍尔群岛: { english: "Marshall Islands", native: "Aelōn̄ in M̧ajeļ" },
  毛里求斯: { english: "Mauritius", native: "Moris" },
  毛里塔尼亚: { english: "Mauritania", native: "موريتانيا" },
  美国: { english: "United States", native: "United States" },
  孟加拉国: { english: "Bangladesh", native: "বাংলাদেশ" },
  秘鲁: { english: "Peru", native: "Perú" },
  缅甸: { english: "Myanmar", native: "မြန်မာ" },
  摩洛哥: { english: "Morocco", native: "المغرب" },
  莫桑比克: { english: "Mozambique", native: "Moçambique" },
  纳米比亚: { english: "Namibia", native: "Namibia" },
  南苏丹: { english: "South Sudan", native: "South Sudan" },
  瑙鲁: { english: "Nauru", native: "Naoero" },
  尼加拉瓜: { english: "Nicaragua", native: "Nicaragua" },
  尼泊尔: { english: "Nepal", native: "नेपाल" },
  尼日尔: { english: "Niger", native: "Niger" },
  尼日利亚: { english: "Nigeria", native: "Nigeria" },
  帕劳: { english: "Palau", native: "Belau" },
  萨尔瓦多: { english: "El Salvador", native: "El Salvador" },
  萨摩亚: { english: "Samoa", native: "Sāmoa" },
  塞拉利昂: { english: "Sierra Leone", native: "Sierra Leone" },
  塞内加尔: { english: "Senegal", native: "Sénégal" },
  塞舌尔: { english: "Seychelles", native: "Sesel" },
  圣多美和普林西比: { english: "Sao Tome and Principe", native: "São Tomé e Príncipe" },
  圣基茨和尼维斯: { english: "Saint Kitts and Nevis", native: "Saint Kitts and Nevis" },
  圣卢西亚: { english: "Saint Lucia", native: "Saint Lucia" },
  斯威士兰: { english: "Eswatini", native: "Eswatini" },
  苏丹: { english: "Sudan", native: "السودان" },
  苏里南: { english: "Suriname", native: "Suriname" },
  所罗门群岛: { english: "Solomon Islands", native: "Solomon Islands" },
  索马里: { english: "Somalia", native: "Soomaaliya" },
  塔吉克斯坦: { english: "Tajikistan", native: "Тоҷикистон" },
  泰国: { english: "Thailand", native: "ประเทศไทย" },
  坦桑尼亚: { english: "Tanzania", native: "Tanzania" },
  汤加: { english: "Tonga", native: "Tonga" },
  突尼斯: { english: "Tunisia", native: "تونس" },
  图瓦卢: { english: "Tuvalu", native: "Tuvalu" },
  土库曼斯坦: { english: "Turkmenistan", native: "Türkmenistan" },
  瓦努阿图: { english: "Vanuatu", native: "Vanuatu" },
  危地马拉: { english: "Guatemala", native: "Guatemala" },
  委内瑞拉: { english: "Venezuela", native: "Venezuela" },
  文莱: { english: "Brunei", native: "Brunei" },
  乌干达: { english: "Uganda", native: "Uganda" },
  乌拉圭: { english: "Uruguay", native: "Uruguay" },
  乌兹别克斯坦: { english: "Uzbekistan", native: "Oʻzbekiston" },
  牙买加: { english: "Jamaica", native: "Jamaica" },
  亚美尼亚: { english: "Armenia", native: "Հայաստան" },
  越南: { english: "Vietnam", native: "Việt Nam" },
  赞比亚: { english: "Zambia", native: "Zambia" },
  乍得: { english: "Chad", native: "Tchad" },
  智利: { english: "Chile", native: "Chile" },
  中非: { english: "Central African Republic", native: "République centrafricaine" },
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

const CIRCLE_FLAG_ICON_ALIASES = {
  ARE: ["阿联酋"],
  BIH: ["波斯尼亚和黑塞哥维那"],
  CAF: ["中非"],
  COD: ["刚果(金)"],
  COG: ["刚果(布)"],
  CZE: ["捷克共和国"],
  DOM: ["多米尼加"],
  FSM: ["密克罗尼西亚联邦"],
  MKD: ["马其顿"],
  VAT: ["梵蒂冈"],
};

const COUNTRY_LABEL_CENTERS = {
  PRK: [40.25, 127.35],
  KOR: [36.35, 127.85],
  JPN: [38.1, 138.15],
};

const COUNTRY_GLOBE_ANCHORS = {
  // Country display anchors are [lng, lat]. Denmark's country geometry includes
  // Greenland, so the automatic representative point lands far from Denmark proper.
  AUS: [134.5, -25.6],
  CAN: [-96.8, 55.2],
  DNK: [10.0, 56.15],
  MYS: [102.25, 4.05],
  RUS: [90.0, 61.5],
};

function antarcticaGlobePoint() {
  const basePath = ASSET_BASE_URL;
  return {
    id: "ATA-SOUTH-POLE",
    lat: -90,
    lng: 0,
    name: "南极洲",
    flag: "AQ",
    flagIconUrls: [`${basePath}flags/circle-195/${encodeURIComponent("南极")}.png`],
    isoA2: "AQ",
    count: 0,
  };
}

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

function formatCoordinate(lat, lng) {
  if (lat === undefined || lng === undefined) return "";
  const latStr = lat >= 0 ? `${lat.toFixed(2)}° N` : `${Math.abs(lat).toFixed(2)}° S`;
  const lngStr = lng >= 0 ? `${lng.toFixed(2)}° E` : `${Math.abs(lng).toFixed(2)}° W`;
  return `${latStr}, ${lngStr}`;
}

function getExtremesForVisits(visitsList, placeLookup) {
  let extremes = {
    north: { country: null, city: null },
    south: { country: null, city: null },
    east: { country: null, city: null },
    west: { country: null, city: null },
  };

  const uniqueCountries = new Map();
  const uniqueCities = new Map();

  for (const visit of visitsList) {
    const country = resolvePlaceForLevel(visit.placeId, "country", placeLookup);
    const city = resolvePlaceForLevel(visit.placeId, "city", placeLookup);
    
    if (country) {
      const cKey = country.mapId || canonicalPlaceId(country.id);
      const latLng = placeLatLng(country);
      if (latLng) {
        uniqueCountries.set(cKey, { place: country, ...latLng });
      }
    }
    
    if (city && city.level === "city") {
      const cityKey = city.mapId || canonicalPlaceId(city.id);
      const latLng = placeLatLng(city);
      if (latLng) {
        uniqueCities.set(cityKey, { place: city, ...latLng });
      }
    }
  }

  const countriesArr = Array.from(uniqueCountries.values());
  const citiesArr = Array.from(uniqueCities.values());

  if (countriesArr.length > 0) {
    extremes.north.country = countriesArr.reduce((prev, curr) => (curr.lat > prev.lat ? curr : prev));
    extremes.south.country = countriesArr.reduce((prev, curr) => (curr.lat < prev.lat ? curr : prev));
    extremes.east.country = countriesArr.reduce((prev, curr) => (curr.lng > prev.lng ? curr : prev));
    extremes.west.country = countriesArr.reduce((prev, curr) => (curr.lng < prev.lng ? curr : prev));
  }

  if (citiesArr.length > 0) {
    extremes.north.city = citiesArr.reduce((prev, curr) => (curr.lat > prev.lat ? curr : prev));
    extremes.south.city = citiesArr.reduce((prev, curr) => (curr.lat < prev.lat ? curr : prev));
    extremes.east.city = citiesArr.reduce((prev, curr) => (curr.lng > prev.lng ? curr : prev));
    extremes.west.city = citiesArr.reduce((prev, curr) => (curr.lng < prev.lng ? curr : prev));
  }

  return extremes;
}

function countryGalleryNameVariants(name) {
  if (!name) return [];
  const clean = cleanPlaceName(name);
  const seeds = [
    name,
    clean,
    COUNTRY_GALLERY_ALIASES[name],
    COUNTRY_GALLERY_ALIASES[clean],
  ].filter(Boolean);
  const suffixes = [
    "伊斯兰酋长国",
    "伊斯兰共和国",
    "民主主义人民共和国",
    "独立国",
    "共和国",
    "王国",
    "联邦",
    "苏丹国",
    "城国",
    "国",
  ];
  const variants = new Set(seeds);
  seeds.forEach((seed) => {
    suffixes.forEach((suffix) => {
      if (seed.endsWith(suffix) && seed.length > suffix.length + 1) {
        variants.add(seed.slice(0, -suffix.length));
      }
    });
  });
  return Array.from(variants).filter(Boolean);
}

function countryGalleryKey(country) {
  const candidates = [
    country?.name,
    displayCountryName(country?.place),
    country?.place?.localName,
    country?.place?.countryName,
    country?.place?.name,
  ]
    .filter(Boolean)
    .flatMap((name) => countryGalleryNameVariants(name))
    .filter(Boolean);

  return candidates.find((name) => countryGalleryImages[name]) || null;
}

function countryGallerySubtitle(country, galleryKey) {
  const meta = COUNTRY_GALLERY_META[galleryKey] || {};
  const english = meta.english || country?.place?.name || country?.name || galleryKey;
  const native = meta.native;
  if (!native || native === english) return english;
  const full = `${english} · ${native}`;
  return full.length > 32 ? english : full;
}

function circularFlagIconUrls(country) {
  const basePath = ASSET_BASE_URL;
  const code = country?.id || country?.countryCode;
  const names = [
    displayCountryName(country),
    ...(CIRCLE_FLAG_ICON_ALIASES[code] || []),
    country?.localName,
    country?.countryName,
    country?.name,
    code,
    country?.isoA2,
  ]
    .filter(Boolean)
    .map((name) => cleanPlaceName(name))
    .filter(Boolean);
  return Array.from(new Set(names)).flatMap((name) => [
    `${basePath}flags/circle-195/${encodeURIComponent(name)}.png`,
    `${basePath}flags/circle/${encodeURIComponent(name)}.png`,
  ]);
}

function displayProfileName(name) {
  if (name === "Person A") return "Bobo";
  if (name === "Person B" || name === "Person") return "Yier";
  return name;
}

function profileStableIndex(profile) {
  const name = (profile?.name || "").trim().toLowerCase();
  if (name === "xiao") return 0;
  if (name === "tang") return 1;
  if (name === "bobo" || name === "person a") return 2;
  if (name === "yier" || name === "person b") return 3;

  if (PROFILE_ID_ORDER.has(profile?.id)) return PROFILE_ID_ORDER.get(profile.id) + 4;
  const colorIndex = PROFILE_COLOR_ORDER.get((profile?.color || "").toLowerCase());
  if (colorIndex !== undefined) return colorIndex + 10;
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
  return sortProfilesStable(items);
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

function polygonSignedArea(ring) {
  if (!ring?.length) return 0;
  let area = 0;
  for (let index = 0, prev = ring.length - 1; index < ring.length; prev = index, index += 1) {
    area += (ring[prev][0] * ring[index][1]) - (ring[index][0] * ring[prev][1]);
  }
  return area / 2;
}

function representativePointForGeometry(geometry, fallback) {
  const polygons = geometryPolygons(geometry)
    .filter((rings) => rings?.[0]?.length)
    .map((rings) => ({
      bounds: ringBounds(rings[0]),
      rings,
      area: Math.abs(polygonSignedArea(rings[0])),
    }))
    .sort((a, b) => b.area - a.area);
  if (polygons.length === 0) return fallback;

  const isInside = ([lng, lat], polygon) => isPointInPolygon(lng, lat, polygon);
  if (fallback && polygons.some((polygon) => isInside(fallback, polygon))) return fallback;

  for (const polygon of polygons) {
    const { bounds, rings } = polygon;
    const candidates = [
      [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2],
      [
        rings[0].reduce((sum, point) => sum + point[0], 0) / rings[0].length,
        rings[0].reduce((sum, point) => sum + point[1], 0) / rings[0].length,
      ],
      ...rings[0].filter((_, index) => index % Math.max(1, Math.floor(rings[0].length / 18)) === 0),
    ];
    const match = candidates.find((candidate) => isInside(candidate, polygon));
    if (match) return match;
  }

  return fallback || [
    (polygons[0].bounds.minLng + polygons[0].bounds.maxLng) / 2,
    (polygons[0].bounds.minLat + polygons[0].bounds.maxLat) / 2,
  ];
}

function buildCountryGlobePoints(targetVisits, placeLookup) {
  const countries = new Map();
  for (const visit of targetVisits) {
    const country = resolvePlaceForLevel(visit.placeId, "country", placeLookup);
    if (!country || country.id === "ATA") continue;
    const id = canonicalPlaceId(country.mapId || country.id);
    const fallback = country.center || null;
    const center =
      COUNTRY_GLOBE_ANCHORS[id] ||
      COUNTRY_GLOBE_ANCHORS[country.id] ||
      representativePointForGeometry(country.geometry, fallback);
    const latLng = placeLatLng({ center });
    if (!latLng) continue;
    const existing = countries.get(id);
    countries.set(id, {
      id,
      lat: latLng.lat,
      lng: latLng.lng,
      name: displayCountryName(country),
      flag: country.flag || flagEmoji(country.isoA2),
      flagIconUrls: circularFlagIconUrls(country),
      isoA2: country.isoA2,
      count: (existing?.count || 0) + 1,
    });
  }
  return Array.from(countries.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"),
  );
}

function buildAllCountryGlobePoints(countryPlaces = []) {
  return countryPlaces
    .filter((country) => country && country.id !== "ATA")
    .map((country) => {
      const id = canonicalPlaceId(country.mapId || country.id);
      const fallback = country.center || null;
      const center =
        COUNTRY_GLOBE_ANCHORS[id] ||
        COUNTRY_GLOBE_ANCHORS[country.id] ||
        representativePointForGeometry(country.geometry, fallback);
      const latLng = placeLatLng({ center });
      if (!latLng) return null;
      return {
        id,
        lat: latLng.lat,
        lng: latLng.lng,
        name: displayCountryName(country),
        flag: country.flag || flagEmoji(country.isoA2),
        flagIconUrls: circularFlagIconUrls(country),
        isoA2: country.isoA2,
        count: 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
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
    .filter(Boolean);
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

function getPhotoFilesFromForm(formElement, fieldName = "photo") {
  const input = formElement?.elements?.[fieldName];
  if (!input?.files) return [];
  return Array.from(input.files).filter((file) => file && file.size);
}

const googleFonts = {
  // Chinese
  "霞鹜文楷 (LXGW WenKai)": "LXGW+WenKai",
  "思源黑体 (Noto Sans SC)": "Noto+Sans+SC:wght@300;400;500;700",
  "思源宋体 (Noto Serif SC)": "Noto+Serif+SC:wght@300;400;700",
  "日式楷体 (Klee One)": "Klee+One",
  "站酷快乐体 (ZCOOL KuaiLe)": "ZCOOL+KuaiLe",
  "站酷黄油体 (ZCOOL HuangYou)": "ZCOOL+QingKe+HuangYou",
  "站酷小薇体 (ZCOOL XiaoWei)": "ZCOOL+XiaoWei",
  "芝麻星草书 (Zhi Mang Xing)": "Zhi+Mang+Xing",
  "龙仓手写体 (Long Cang)": "Long+Cang",
  "马善政毛笔楷书 (Ma Shan Zheng)": "Ma+Shan+Zheng",
  "刘建毛草书 (Liu Jian Mao Cao)": "Liu+Jian+Mao+Cao",
  
  // English / Numeric
  "Nunito": "Nunito:wght@400;600;700;800;900",
  "Ubuntu": "Ubuntu:wght@400;500;700",
  "Inter": "Inter:wght@300;400;500;700",
  "Roboto": "Roboto:wght@300;400;500;700",
  "Open Sans": "Open+Sans:wght@300;400;500;700",
  "Montserrat": "Montserrat:wght@300;400;500;700",
  "Poppins": "Poppins:wght@300;400;500;700",
  "Raleway": "Raleway:wght@300;400;500;700",
  "Lato": "Lato:wght@300;400;700",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,700;1,400",
  "Lora": "Lora:ital,wght@0,400;0,700;1,400",
  "Merriweather": "Merriweather:ital,wght@0,400;0,700;1,400",
  "PT Serif": "PT+Serif:ital,wght@0,400;0,700;1,400",
  "Cinzel": "Cinzel:wght@400;700",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,700;1,400",
  "JetBrains Mono": "JetBrains+Mono:wght@300;400;500;700",
  "Fira Code": "Fira+Code:wght@400;500;700",
  "Source Code Pro": "Source+Code+Pro:wght@400;500;700",
  "Oswald": "Oswald:wght@400;700",
  "Pacifico": "Pacifico",
  "Dancing Script": "Dancing+Script:wght@400;700"
};



const localFontFallbacks = {
  // English Local Fonts
  "sans-serif": ["Arial", "Helvetica", "Segoe UI"],
  "Arial": ["Arial", "Helvetica"],
  "Helvetica": ["Helvetica", "Arial"],
  "Georgia": ["Georgia", "Times New Roman"],
  "Times New Roman": ["Times New Roman", "Times"],
  "Courier New": ["Courier New", "Courier"],
  "Verdana": ["Verdana", "Geneva"],
  "Trebuchet MS": ["Trebuchet MS", "Arial"],
  "Impact": ["Impact", "Arial Black"],
  "Garamond": ["Garamond", "Adobe Garamond Pro", "EB Garamond", "Georgia"],
  "Palatino": ["Palatino Linotype", "Palatino", "Book Antiqua", "Georgia"],
  "Bookman": ["Bookman Old Style", "Bookman", "Georgia"],
  
  // Chinese Local Fonts
  "system-ui, sans-serif": ["Segoe UI", "Microsoft YaHei", "PingFang SC"],
  "Microsoft YaHei": ["Microsoft YaHei", "PingFang SC", "Heiti SC"],
  "PingFang SC": ["PingFang SC", "Microsoft YaHei", "Heiti SC"],
  "STHeiti": ["STHeiti", "Heiti SC", "Microsoft YaHei"],
  "SimHei": ["SimHei", "Heiti SC", "Microsoft YaHei"],
  "SimSun": ["SimSun", "Songti SC", "STSong"],
  "STZhongsong": ["STZhongsong", "SimSun", "Songti SC"],
  "STKaiti": ["STKaiti", "Kaiti SC", "KaiTi"],
  "FangSong": ["FangSong", "STFangsong", "FangSong SC"],
  "YouYuan": ["YouYuan", "Microsoft YaHei"],
  "LiSu": ["LiSu", "Microsoft YaHei"],
  "STXingkai": ["STXingkai", "Microsoft YaHei"],
  "STXinwei": ["STXinwei", "Microsoft YaHei"],
  "STLiti": ["STLiti", "Microsoft YaHei"],
  "FZShuTi": ["FZShuTi", "Microsoft YaHei"],
  "FZYaoTi": ["FZYaoTi", "Microsoft YaHei"]
};

async function fetchAndModifyFont(fontFamilyName, aliasName, unicodeRange) {
  const gfont = googleFonts[fontFamilyName];
  if (!gfont) {
    const fallbacks = localFontFallbacks[fontFamilyName] || [fontFamilyName];
    const srcList = fallbacks.map(f => `local('${f}')`).join(", ");
    let css = `
      @font-face {
        font-family: '${aliasName}';
        src: ${srcList};
    `;
    if (unicodeRange) {
      css += `\n  unicode-range: ${unicodeRange};`;
    }
    css += `\n}`;
    return css;
  }
  
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${gfont}&display=swap`);
    if (!res.ok) throw new Error("Fetch failed");
    const cssText = await res.text();
    let modifiedCss = cssText.replace(/font-family:\s*['"]?([^'"]+)['"]?;/g, `font-family: '${aliasName}';`);
    // Strip original unicode-range to avoid overrides
    modifiedCss = modifiedCss.replace(/unicode-range:\s*[^;]+;/g, "");
    if (unicodeRange) {
      modifiedCss = modifiedCss.replace(/src:\s*[^;]+;/g, (match) => {
        return `${match}\n  unicode-range: ${unicodeRange};`;
      });
    }
    return modifiedCss;
  } catch (err) {
    console.error("Failed to load font " + fontFamilyName, err);
    const fallbacks = localFontFallbacks[fontFamilyName] || [fontFamilyName];
    const srcList = fallbacks.map(f => `local('${f}')`).join(", ");
    let css = `
      @font-face {
        font-family: '${aliasName}';
        src: ${srcList};
    `;
    if (unicodeRange) {
      css += `\n  unicode-range: ${unicodeRange};`;
    }
    css += `\n}`;
    return css;
  }
}

function App() {
  const [dynamicCss, setDynamicCss] = useState("");

  useEffect(() => {
    let active = true;
    async function updateFonts() {
      const [enCss, upperEnCss, upperNumCss] = await Promise.all([
        fetchAndModifyFont("Poppins", "DynamicPanelEnglish", "U+0041-005A, U+0061-007A"),
        fetchAndModifyFont("Cinzel", "UpperEnglish", "U+0041-005A, U+0061-007A"),
        fetchAndModifyFont("Lato", "UpperNumeric", "U+0030-0039")
      ]);
      
      if (active) {
        setDynamicCss(`
          ${enCss}
          ${upperEnCss}
          ${upperNumCss}
          
          /* Upper section dynamic styles */
          .prophet-brand h1,
          .prophet-nav > button,
          .prophet-theme-nav > button,
          .prophet-status span,
          .segmented button,
          .metric p,
          .comparison-metric p,
          .metric strong,
          .metric-comparison-rows strong em,
          .metric-comparison-rows strong span,
          .metric-comparison-rows strong small,
          .metric small {
            font-family: 'UpperEnglish', 'UpperNumeric', var(--prophet-serif) !important;
          }
          
          .topbar .eyebrow {
            font-family: 'UpperEnglish', 'UpperNumeric', var(--prophet-code) !important;
          }
          
          /* Footprint panel & Map dynamic styles */
          .quick-add-dock,
          .quick-add-dock *,
          .leaflet-map,
          .leaflet-container,
          .leaflet-popup,
          .leaflet-tooltip,
          .leaflet-map *,
          .leaflet-container * {
            font-family: 'DynamicPanelEnglish', "Microsoft YaHei", sans-serif !important;
          }
          
          .map-surface .eyebrow {
            font-family: 'UpperEnglish', var(--prophet-code) !important;
          }
          
          /* Card eyebrows and counts typography overrides */
          .aceternity-globe-card .eyebrow,
          .aceternity-world-card .eyebrow {
            font-family: 'UpperEnglish', var(--prophet-code) !important;
            letter-spacing: 0.08em !important;
          }
          
          .globe-card-actions > span,
          .aceternity-world-card > div:first-child > span {
            font-family: 'UpperEnglish', 'UpperNumeric', var(--prophet-code) !important;
          }
        `);
      }
    }
    updateFonts();
    return () => {
      active = false;
    };
  }, []);

  const [activeProfile, setActiveProfile] = useState("all");
  const [activeLevel, setActiveLevel] = useState("country");
  const [yearFilter, setYearFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [activeMapThemeId, setActiveMapThemeId] = useState("copper");
  const [mapTileSource, setMapTileSource] = useState(() => {
    return localStorage.getItem("map_tile_source") || "direct"; // Default to "direct" (Esri) which works great in China without VPN
  });

  useEffect(() => {
    localStorage.setItem("map_tile_source", mapTileSource);
  }, [mapTileSource]);

  const [appProfiles, setAppProfiles] = useState(() => normalizeProfilesForDisplay(profiles));
  const [visits, setVisits] = useState(staticVisits);
  const [recentInteractions, setRecentInteractions] = useState([]);
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
      { id: "all", label: "X & T" },
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

  useEffect(() => {
    setRouteMessage("");
  }, [activeProfile]);

  const loadTravelData = async () => {
    try {
      setDataStatus("正在同步 Supabase 数据");
      const [profilesResult, visitsResult] = await withTimeout(Promise.all([
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
      ]), 3500);

      if (profilesResult.error) throw profilesResult.error;
      if (visitsResult.error) throw visitsResult.error;

      // 云端拉取的真实数据，直接覆盖更新 state，不再混入任何老旧的示例 mock 脏数据
      const dbProfiles = normalizeProfilesForDisplay(profilesResult.data.map(mapProfile));
      setAppProfiles(dbProfiles);

      const dbVisits = visitsResult.data.map(mapVisit);
      setVisits(dbVisits);

      const routesResult = await withTimeout(supabase
        .from("travel_routes")
        .select("id, profile_id, start_place_id, end_place_id, traveled_at, note, created_by, created_at")
        .order("created_at", { ascending: false }), 3500);
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
      console.warn("Supabase fetch failed or timed out:", error);
      // 超时或失败时，完全不污染 state，继续使用已初始化好的纯净本地固化数据
      setDataStatus("Supabase 暂不可用");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadMaps() {
      try {
        const base = ASSET_BASE_URL;
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
      // 默默地在后台拉取最新的云端足迹。如果网络通畅，就会平滑同步最新的改动（如新加的卡塔尔）
      try {
        loadTravelData();
      } catch (e) {
        console.warn("Silent background load failed:", e);
      }

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 1500);
        if (data && data.session) {
          if (!cancelled) setSession(data.session);
        }
      } catch (err) {
        console.warn("supabase auth session timed out:", err);
      }
    }

    boot();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage("");
      if (nextSession) {
        loadTravelData();
      }
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

  const countryGlobePoints = useMemo(
    () => buildCountryGlobePoints(filteredVisits, placeLookup),
    [filteredVisits, placeLookup],
  );

  const allCountryGlobePoints = useMemo(
    () => buildAllCountryGlobePoints(mapPlaces.country),
    [mapPlaces.country],
  );

  const journeyExtremes = useMemo(() => {
    if (activeProfile === "all") {
      const result = {};
      appProfiles.forEach((profile) => {
        const profileVisits = filteredVisits.filter((v) => v.profileId === profile.id);
        result[profile.id] = getExtremesForVisits(profileVisits, placeLookup);
      });
      return { type: "all", profiles: result };
    } else {
      return { type: "single", data: getExtremesForVisits(filteredVisits, placeLookup) };
    }
  }, [activeProfile, filteredVisits, placeLookup, appProfiles]);

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
  const [journeyVisualGateRef, isJourneyVisualsNear] = useNearViewport("900px");
  const [journeyVisualsLoaded, setJourneyVisualsLoaded] = useState(false);

  useEffect(() => {
    if (isJourneyVisualsNear) {
      setJourneyVisualsLoaded(true);
    }
  }, [isJourneyVisualsNear]);

  function changeLevel(levelId) {
    setActiveLevel(levelId);
    if (levelId === "region" || levelId === "city") {
      setSelectedPlaceId("CHN");
    }
  }

  async function uploadVisitPhotos(visitId, photoFiles = []) {
    for (const [index, file] of photoFiles.entries()) {
      const storagePath = `${session.user.id}/${visitId}/${Date.now()}-${index}-${safeStorageName(file.name)}`;
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
  }

  async function saveVisit({ file, files, placeId, profileId, resetTarget, type, visitedAt }) {
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

      const photoFiles = files?.length ? files : file && file.size ? [file] : [];
      await uploadVisitPhotos(createdVisit.id, photoFiles);

      await loadTravelData();
      const canonicalId = canonicalPlaceId(placeId);
      setRecentInteractions((prev) => [canonicalId, ...prev.filter((id) => id !== canonicalId)]);
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
      files: getPhotoFilesFromForm(formElement),
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

  async function updateVisit(visitId, { file, files, rating, type, visitedAt }) {
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

      const photoFiles = files?.length ? files : file && file.size ? [file] : [];
      await uploadVisitPhotos(visitId, photoFiles);

      await loadTravelData();
      const oldVisit = visits.find((v) => v.id === visitId);
      if (oldVisit) {
        const canonicalId = canonicalPlaceId(oldVisit.placeId);
        setRecentInteractions((prev) => [canonicalId, ...prev.filter((id) => id !== canonicalId)]);
      }
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

  function scrollToPageSection(sectionId) {
    if ((sectionId === "travel-notes-section" || sectionId === "visual-journey-section") && !journeyVisualsLoaded) {
      setJourneyVisualsLoaded(true);
      setTimeout(() => {
        const target = document.getElementById(sectionId);
        if (!target) return;
        const offset = 102;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }, 350);
      return;
    }

    const target = document.getElementById(sectionId);
    if (!target) return;
    const offset = 102;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function getProfileAccentColor(profile) {
    const name = (profile.name || "").toLowerCase();
    if (name === "xiao") return "#2563eb"; // Blue
    if (name === "tang") return "#db2777"; // Pink
    return profile.color || "#64748b";
  }

  function renderProfileTableCellCity(cityInfo, profile) {
    const isXiao = (profile.name || "").toLowerCase() === "xiao";
    const isTang = (profile.name || "").toLowerCase() === "tang";
    const badgeClass = isXiao ? "xiao" : (isTang ? "tang" : "");
    const accentColor = isXiao ? "#2563eb" : (isTang ? "#db2777" : profile.color);

    if (!cityInfo) {
      return (
        <div className="extreme-cell-city-info" key={profile.id}>
          <span className="place-name">
            <span className={`profile-pill-badge ${badgeClass}`} style={{ backgroundColor: accentColor }}>{profile.name}</span>
            <span className="no-record">暂无记录</span>
          </span>
        </div>
      );
    }

    return (
      <div className="extreme-cell-city-info" key={profile.id}>
        <span className="place-name">
          <span className={`profile-pill-badge ${badgeClass}`} style={{ backgroundColor: accentColor }}>{profile.name}</span>
          <FlagIcon place={cityInfo.place} />
          {displayCountryName(resolvePlaceForLevel(cityInfo.place.id, "country", placeLookup))} · {displayPlaceName(cityInfo.place)}
        </span>
        <span className="coordinates">
          {formatCoordinate(cityInfo.lat, cityInfo.lng)}
        </span>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <style dangerouslySetInnerHTML={{ __html: dynamicCss }} />
      <header className="topbar">
        <div className="prophet-brand">
          <span className="prophet-brand-icon" aria-hidden="true">
            <img src={`${ASSET_BASE_URL}brand/travelmap-icon.png`} alt="" />
          </span>
          <div>
            <h1>足迹地图</h1>
            <p className="eyebrow">TravelMap X</p>
          </div>
        </div>
        <nav className="prophet-nav" aria-label="页面导航">
          <button onClick={() => scrollToPageSection("map-section")} type="button">
            地图
          </button>
          <div className="prophet-dropdown-nav">
            <button type="button">图鉴</button>
            <div className="prophet-dropdown-menu">
              <button onClick={() => scrollToPageSection("country-gallery-section")} type="button">
                国家图鉴
              </button>
              <button onClick={() => scrollToPageSection("province-gallery-section")} type="button">
                省份图鉴
              </button>
            </div>
          </div>
          <button onClick={() => scrollToPageSection("overview-section")} type="button">
            统计数据
          </button>
          <button onClick={() => scrollToPageSection("visual-journey-section")} type="button">
            足迹可视化
          </button>
          <button onClick={() => scrollToPageSection("travel-notes-section")} type="button">
            旅行记录
          </button>
        </nav>
        
        <div className="topbar-right-controls">
          <div className="prophet-theme-nav">
            <button type="button">地图主题</button>
            <MapThemePicker
              activeThemeId={activeMapThemeId}
              onChange={setActiveMapThemeId}
              themes={ORDERED_MAP_THEMES}
              variant="nav"
            />
          </div>
          <div className="status-strip prophet-status"
            aria-label="项目状态"
            onClick={() => setAuthPanelOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setAuthPanelOpen(true);
            }}
            role="button"
            tabIndex={0}
          >
            <span className={session ? "db-connected" : "db-disconnected"}>
              <Database size={16} /> {session ? "数据库已连接" : "未登录"}
            </span>
          </div>
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
              {profile.id === "all" ? <Users size={16} /> : <User size={16} />}
              {profile.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {placeLevels.map((level) => {
            const LevelIcon = level.id === "country" ? Globe2 : level.id === "city" ? MapPinned : Layers3;
            return (
              <button
                className={activeLevel === level.id ? "active" : ""}
                key={level.id}
                onClick={() => changeLevel(level.id)}
                title={level.description}
                type="button"
              >
                <LevelIcon size={16} />
                {level.label}
              </button>
            );
          })}
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



      <section className="workspace" id="map-section">
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
          recentInteractions={recentInteractions}
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
          mapTileSource={mapTileSource}
        />
      </section>

      {/* 极点统计长展示框 */}
      <section className="journey-extremes-panel" aria-label="足迹四极统计">
        <div className="extremes-header-container">
          <div className="extremes-header">
            <p className="eyebrow">Extremes</p>
            <h3>足迹四极</h3>
          </div>
        </div>
        <div 
          className="extremes-table-layout"
          style={{ gridTemplateRows: activeProfile === "all" ? "38px 54px 54px" : "38px 54px" }}
        >
          {/* Left Column Labels (Xiao / Tang) */}
          {(activeProfile === "all" ? appProfiles : appProfiles.filter(p => p.id === activeProfile)).map((profile, index) => {
            const accentColor = getProfileAccentColor(profile);
            const isXiao = (profile.name || "").toLowerCase() === "xiao";
            const isTang = (profile.name || "").toLowerCase() === "tang";
            const profileClass = isXiao ? "xiao" : (isTang ? "tang" : "");
            
            // In dynamic alignment: row 2 and row 3 are Xiao and Tang respectively (desktop)
            const gridRow = index + 2; 

            return (
              <div 
                className={`profile-row-label ${profileClass}`} 
                key={profile.id}
                style={{ gridColumn: 1, gridRow }}
              >
                <span className={`profile-row-dot ${profileClass}`} style={{ backgroundColor: accentColor }} />
                <span>{profile.name}</span>
                <span className={`profile-row-bar ${profileClass}`} style={{ backgroundColor: accentColor }} />
              </div>
            );
          })}

          {/* Unified Column Cards */}
          {/* Card 1: 最北 */}
          <div className="extreme-column-card north" style={{ gridColumn: 2, gridRow: activeProfile === "all" ? "1 / span 3" : "1 / span 2" }}>
            <div className="column-card-header north">
              <span className="direction-badge north">N</span>
              <h4>最北 · Northernmost</h4>
            </div>
            {(activeProfile === "all" ? appProfiles : appProfiles.filter(p => p.id === activeProfile)).map((profile) => {
              const extremes = activeProfile === "all" 
                ? journeyExtremes.profiles[profile.id] || {} 
                : journeyExtremes.data;
              return (
                <div className="column-card-data-row" key={profile.id}>
                  {renderProfileTableCellCity(extremes.north?.city, profile)}
                </div>
              );
            })}
          </div>

          {/* Card 2: 最南 */}
          <div className="extreme-column-card south" style={{ gridColumn: 3, gridRow: activeProfile === "all" ? "1 / span 3" : "1 / span 2" }}>
            <div className="column-card-header south">
              <span className="direction-badge south">S</span>
              <h4>最南 · Southernmost</h4>
            </div>
            {(activeProfile === "all" ? appProfiles : appProfiles.filter(p => p.id === activeProfile)).map((profile) => {
              const extremes = activeProfile === "all" 
                ? journeyExtremes.profiles[profile.id] || {} 
                : journeyExtremes.data;
              return (
                <div className="column-card-data-row" key={profile.id}>
                  {renderProfileTableCellCity(extremes.south?.city, profile)}
                </div>
              );
            })}
          </div>

          {/* Card 3: 最东 */}
          <div className="extreme-column-card east" style={{ gridColumn: 4, gridRow: activeProfile === "all" ? "1 / span 3" : "1 / span 2" }}>
            <div className="column-card-header east">
              <span className="direction-badge east">E</span>
              <h4>最东 · Easternmost</h4>
            </div>
            {(activeProfile === "all" ? appProfiles : appProfiles.filter(p => p.id === activeProfile)).map((profile) => {
              const extremes = activeProfile === "all" 
                ? journeyExtremes.profiles[profile.id] || {} 
                : journeyExtremes.data;
              return (
                <div className="column-card-data-row" key={profile.id}>
                  {renderProfileTableCellCity(extremes.east?.city, profile)}
                </div>
              );
            })}
          </div>

          {/* Card 4: 最西 */}
          <div className="extreme-column-card west" style={{ gridColumn: 5, gridRow: activeProfile === "all" ? "1 / span 3" : "1 / span 2" }}>
            <div className="column-card-header west">
              <span className="direction-badge west">W</span>
              <h4>最西 · Westernmost</h4>
            </div>
            {(activeProfile === "all" ? appProfiles : appProfiles.filter(p => p.id === activeProfile)).map((profile) => {
              const extremes = activeProfile === "all" 
                ? journeyExtremes.profiles[profile.id] || {} 
                : journeyExtremes.data;
              return (
                <div className="column-card-data-row" key={profile.id}>
                  {renderProfileTableCellCity(extremes.west?.city, profile)}
                </div>
              );
            })}
          </div>
        </div>
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

      <CountryGallery continentSummary={continentSummary} countryPlaces={mapPlaces.country} />

      <ProvinceGallery regionPlaces={mapPlaces.region} filteredVisits={filteredVisits} placeLookup={placeLookup} />

      <TravelOverview
        activeProfile={activeProfile}
        continentSummary={continentSummary}
        placeLookup={placeLookup}
        profileSummaries={profileContinentSummaries}
      />
      <div
        className={`journey-visual-gate ${journeyVisualsLoaded ? "active" : "idle"}`}
        id="visual-journey-section"
        ref={journeyVisualGateRef}
      >
        {journeyVisualsLoaded ? (
          <JourneyVisuals
            activeProfile={activeProfile}
            arcs={journeyVisuals.arcs}
            allCountryPoints={allCountryGlobePoints}
            countryPoints={countryGlobePoints}
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
            <div className="section-title overview-title journey-title">
              <h2>
                足迹可视化·<span className="major-title-en">Visual Journey</span>
              </h2>
            </div>
            <span>继续向下滚动时加载球形足迹与点阵轨迹</span>
          </section>
        )}
      </div>
      
      {/* 旅行记录 */}
      <TravelNotesSection
        isEditor={isEditor}
        session={session}
        activeProfile={activeProfile}
        profiles={appProfiles}
        mapTileSource={mapTileSource}
        setMapTileSource={setMapTileSource}
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
  activeProfile,
  allCountryPoints,
  arcs,
  countryPoints,
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
      <div className="section-title overview-title journey-title">
        <h2>
          足迹可视化·<span className="major-title-en">Visual Journey</span>
        </h2>
      </div>
      <div className="journey-visual-grid">
        <AceternityStyleGlobeV2
          activeProfile={activeProfile}
          allCountryPoints={allCountryPoints}
          arcs={arcs}
          countryPoints={countryPoints}
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
  activeProfile,
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
  const preferredProfileId =
    activeProfile && activeProfile !== "all" && profiles.some((profile) => profile.id === activeProfile)
      ? activeProfile
      : profiles[0]?.id || "";

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
    if (preferredProfileId && profileId !== preferredProfileId) setProfileId(preferredProfileId);
    if (!preferredProfileId && !profileId && profiles[0]) setProfileId(profiles[0].id);
  }, [preferredProfileId, profileId, profiles]);

  useEffect(() => {
    resetForm();
  }, [activeProfile]);

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

function AceternityStyleGlobeV2({
  activeProfile,
  allCountryPoints = [],
  countryPoints = [],
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
}) {
  const [speedIndex, setSpeedIndex] = useState(2);
  const [resetTick, setResetTick] = useState(0);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [cardRef, isVisualActive] = useNearViewport("420px");
  const speed = GLOBE_SPEEDS[speedIndex];
  const displayedCountryPoints = useMemo(() => {
    const source = showAllCountries ? allCountryPoints : countryPoints;
    const withoutAntarctica = source.filter((point) => point.id !== "ATA" && point.id !== "ATA-SOUTH-POLE");
    return [...withoutAntarctica, antarcticaGlobePoint()];
  }, [allCountryPoints, countryPoints, showAllCountries]);

  function changeSpeed(direction) {
    setSpeedIndex((value) => Math.max(0, Math.min(GLOBE_SPEEDS.length - 1, value + direction)));
  }

  function resetGlobes() {
    setSpeedIndex(2);
    setResetTick((value) => value + 1);
  }

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
        activeProfile={activeProfile}
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
        <div className="country-globe-stage">
          <SatellitePinGlobe
          active={isVisualActive}
          ariaLabel="国家国旗地球足迹"
          markerMode="flag"
          points={displayedCountryPoints}
          resetTick={resetTick}
          speed={speed}
          />
        </div>
        <SatellitePinGlobe
          active={isVisualActive}
          ariaLabel="城市图钉地球足迹"
          markerMode="pin"
          points={points}
          resetTick={resetTick}
          speed={speed}
        />
      </div>
      <button
        className={`country-globe-toggle ${showAllCountries ? "active" : ""}`}
        onClick={() => setShowAllCountries((value) => !value)}
        type="button"
      >
        {showAllCountries ? "只看去过国家" : "显示全部国家"}
      </button>
    </article>
  );
}

function AceternityStyleGlobe({
  activeProfile,
  arcs,
  countryPoints,
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
  const [speedIndex, setSpeedIndex] = useState(2);
  const [resetTick, setResetTick] = useState(0);
  const [cardRef, isVisualActive] = useNearViewport("420px");
  const speed = GLOBE_SPEEDS[speedIndex];

  function changeSpeed(direction) {
    setSpeedIndex((value) => Math.max(0, Math.min(GLOBE_SPEEDS.length - 1, value + direction)));
  }

  function resetGlobes() {
    setSpeedIndex(2);
    setResetTick((value) => value + 1);
  }

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

function createFlagTexture(flag, fallbackLabel) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(15, 23, 42, 0.28)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 5;
  context.fillStyle = "rgba(255,255,255,0.96)";
  context.beginPath();
  context.arc(64, 64, 41, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 3;
  context.strokeStyle = "rgba(203, 213, 225, 0.92)";
  context.stroke();
  context.font = "54px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(flag || fallbackLabel?.slice(0, 2) || "•", 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFlagBadgeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(15, 23, 42, 0.28)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 5;
  context.fillStyle = "rgba(255,255,255,0.96)";
  context.beginPath();
  context.arc(64, 64, 42, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 3;
  context.strokeStyle = "rgba(203, 213, 225, 0.92)";
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadTextureFromCandidates(loader, urls, onLoad, onFail) {
  const candidates = Array.from(new Set((urls || []).filter(Boolean)));
  let index = 0;
  const tryNext = () => {
    if (index >= candidates.length) {
      onFail?.();
      return;
    }
    const url = candidates[index];
    index += 1;
    loader.load(url, onLoad, undefined, tryNext);
  };
  tryNext();
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

function SatellitePinGlobe({ active, ariaLabel = "真实纹理 3D 地球足迹", markerMode = "pin", points = [], resetTick, speed }) {
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
    const tooltip = document.createElement("div");
    tooltip.className = "globe-flag-tooltip";
    mount.appendChild(tooltip);

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

    const basePath = ASSET_BASE_URL;
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    let earthTexture = null;
    let bumpTexture = null;

    const initialEarthTexture = textureLoader.load(`${basePath}textures/earth-dark.jpg`);
    initialEarthTexture.colorSpace = THREE.SRGBColorSpace;

    const globeRoot = new THREE.Group();
    globeRoot.rotation.y = THREE.MathUtils.degToRad(-110);
    scene.add(globeRoot);

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: initialEarthTexture,
      roughness: 0.7,
      metalness: 0,
    });

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(2, 96, 96),
      earthMaterial
    );
    globeRoot.add(earth);

    const loadTextureWithRetry = (url, type, maxRetries = 5, attempt = 0) => {
      textureLoader.load(
        url,
        (loadedTexture) => {
          if (type === "map") {
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.anisotropy = 16;
            earthTexture = loadedTexture;
            earthMaterial.map = loadedTexture;
            earthMaterial.needsUpdate = true;
          } else if (type === "bump") {
            loadedTexture.anisotropy = 8;
            bumpTexture = loadedTexture;
            earthMaterial.bumpMap = loadedTexture;
            earthMaterial.bumpScale = 0.05;
            earthMaterial.needsUpdate = true;
          }
        },
        undefined,
        (err) => {
          console.warn(`Globe texture (${type}) load failed on attempt ${attempt + 1}:`, err);
          if (attempt < maxRetries) {
            setTimeout(() => {
              const retryUrl = `${url.split("?")[0]}?retry=${attempt}-${Date.now()}`;
              loadTextureWithRetry(retryUrl, type, maxRetries, attempt + 1);
            }, 1500 * (attempt + 1));
          }
        }
      );
    };

    loadTextureWithRetry(`${basePath}textures/earth-blue-marble.jpg`, "map");
    loadTextureWithRetry(`${basePath}textures/earth-topology.png`, "bump");

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
    const isFlagMode = markerMode === "flag";
    const pinHeadGeometry = new THREE.SphereGeometry(0.026, 18, 18);
    const pinStemGeometry = new THREE.CylinderGeometry(0.0032, 0.0032, 0.08, 8);
    const flagStemGeometry = new THREE.CylinderGeometry(0.0024, 0.0024, 0.26, 8);
    const flagBadgeTexture = createFlagBadgeTexture();
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
    const flagTextures = [];
    const flagMaterials = [];
    const flagBadgeMaterials = [];
    const flagSprites = [];
    const localUp = new THREE.Vector3(0, 1, 0);
    const worldNormal = new THREE.Vector3();
    const worldSurface = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    const screenPosition = new THREE.Vector3();
    let disposed = false;
    points.forEach((point) => {
      const normal = latLngToVector3(point.lat, point.lng, 1).normalize();
      const pin = new THREE.Group();
      pin.quaternion.setFromUnitVectors(localUp, normal);
      pin.userData.normal = normal;
      pin.userData.surfacePosition = normal.clone().multiplyScalar(2);

      if (isFlagMode) {
        const stem = new THREE.Mesh(flagStemGeometry, pinStemMaterial);
        stem.position.set(0, 2.13, 0);
        const badgeMaterial = new THREE.SpriteMaterial({
          depthTest: false,
          depthWrite: false,
          map: flagBadgeTexture,
          opacity: 0.82,
          transparent: true,
        });
        flagBadgeMaterials.push(badgeMaterial);
        const badge = new THREE.Sprite(badgeMaterial);
        badge.position.set(0, 2.31, -0.006);
        badge.scale.set(0.18, 0.18, 1);
        badge.renderOrder = 20;
        const flagMaterial = new THREE.SpriteMaterial({
          depthTest: false,
          depthWrite: false,
          opacity: 0,
          transparent: true,
        });
        flagMaterials.push(flagMaterial);
        const sprite = new THREE.Sprite(flagMaterial);
        sprite.position.set(0, 2.31, 0.012);
        sprite.scale.set(0.18, 0.18, 1);
        sprite.renderOrder = 30;
        sprite.userData.label = point.name || point.country || point.id || "";
        sprite.userData.pin = pin;
        flagSprites.push(sprite);
        loadTextureFromCandidates(textureLoader, point.flagIconUrls, (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 16;
          flagTextures.push(texture);
          flagMaterial.map = texture;
          flagMaterial.opacity = 1;
          flagMaterial.needsUpdate = true;
          badgeMaterial.opacity = 0;
          badgeMaterial.needsUpdate = true;
        });
        pin.add(stem, badge, sprite);
      } else {
        const stem = new THREE.Mesh(pinStemGeometry, pinStemMaterial);
        stem.position.set(0, 2.05, 0);
        const head = new THREE.Mesh(pinHeadGeometry, pinHeadMaterial);
        head.position.set(0, 2.11, 0);
        pin.add(stem, head);
      }
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
    const hideTooltip = () => {
      tooltip.classList.remove("visible");
    };
    const isPinFacingCamera = (pin) => {
      if (!pin?.userData?.normal || !pin.userData.surfacePosition) return false;
      worldNormal.copy(pin.userData.normal).applyQuaternion(globeRoot.quaternion);
      worldSurface.copy(pin.userData.surfacePosition).applyQuaternion(globeRoot.quaternion);
      toCamera.copy(camera.position).sub(worldSurface).normalize();
      return worldNormal.dot(toCamera) > 0.08;
    };
    const handlePointerMove = (event) => {
      if (!isFlagMode || flagSprites.length === 0) return;
      controls.update();
      globeRoot.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const rect = renderer.domElement.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const hitRadius = 18 * satelliteZoomRef.current;
      let closest = null;
      flagSprites.forEach((sprite) => {
        const pin = sprite.userData.pin;
        if (
          !pin ||
          !pin.visible ||
          !sprite.visible ||
          sprite.material.opacity <= 0.05 ||
          !isPinFacingCamera(pin)
        ) {
          return;
        }
        sprite.getWorldPosition(screenPosition);
        screenPosition.project(camera);
        if (screenPosition.z < -1 || screenPosition.z > 1) return;
        const x = (screenPosition.x * 0.5 + 0.5) * rect.width;
        const y = (-screenPosition.y * 0.5 + 0.5) * rect.height;
        const distance = Math.hypot(pointerX - x, pointerY - y);
        if (distance <= hitRadius && (!closest || distance < closest.distance)) {
          closest = { sprite, distance };
        }
      });
      if (!closest) {
        hideTooltip();
        return;
      }
      const mountRect = mount.getBoundingClientRect();
      tooltip.textContent = closest.sprite.userData.label;
      tooltip.style.left = `${event.clientX - mountRect.left + 14}px`;
      tooltip.style.top = `${event.clientY - mountRect.top + 14}px`;
      tooltip.classList.add("visible");
    };
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", hideTooltip);

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
    const renderScene = () => {
      controls.update();
      markerGroup.children.forEach((pin) => {
        const visible = isPinFacingCamera(pin);
        pin.visible = visible;
        if (isFlagMode) {
          pin.children.forEach((child) => {
            if (child.isSprite) child.visible = visible;
          });
        }
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
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", hideTooltip);
      controls.dispose();
      earth.geometry.dispose();
      earth.material.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      pinHeadGeometry.dispose();
      pinStemGeometry.dispose();
      flagStemGeometry.dispose();
      pinHeadMaterial.dispose();
      pinStemMaterial.dispose();
      flagBadgeTexture.dispose();
      flagBadgeMaterials.forEach((material) => material.dispose());
      flagTextures.forEach((texture) => texture.dispose());
      flagMaterials.forEach((material) => material.dispose());
      if (initialEarthTexture) initialEarthTexture.dispose();
      if (earthTexture) earthTexture.dispose();
      if (bumpTexture) bumpTexture.dispose();
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [markerMode, points]);

  return (
    <div
      aria-label={ariaLabel}
      className={`satellite-globe satellite-globe-mount ${markerMode === "flag" ? "flag-globe" : "pin-globe"}`}
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
  const [view, setView] = useState({ scale: 1.12, x: -48, y: -24 });
  const svgRef = useRef(null);
  const dragRef = useRef({ active: false, x: 0, y: 0 });

  function clampWorldView(next) {
    const scale = Math.max(1, Math.min(5, next.scale));
    const maxX = 800 * (scale - 1);
    const maxY = 400 * (scale - 1);
    return {
      scale,
      x: Math.max(-maxX, Math.min(0, next.x)),
      y: Math.max(-maxY, Math.min(0, next.y)),
    };
  }

  function zoomWorldMap(nextScale, origin = { x: 400, y: 200 }) {
    setView((current) => {
      const scale = Math.max(1, Math.min(5, nextScale));
      if (scale === current.scale) return current;
      const ratio = scale / current.scale;
      return clampWorldView({
        scale,
        x: origin.x - (origin.x - current.x) * ratio,
        y: origin.y - (origin.y - current.y) * ratio,
      });
    });
  }

  function handleWorldWheel(event) {
    event.preventDefault();
    event.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    const origin = rect
      ? {
          x: ((event.clientX - rect.left) / rect.width) * 800,
          y: ((event.clientY - rect.top) / rect.height) * 400,
        }
      : { x: 400, y: 200 };
    zoomWorldMap(view.scale * (event.deltaY < 0 ? 1.18 : 0.84), origin);
  }

  useEffect(() => {
    const svg = svgRef.current;
    const card = cardRef.current;
    if (!svg && !card) return undefined;
    card?.addEventListener("wheel", handleWorldWheel, { passive: false });
    svg?.addEventListener("wheel", handleWorldWheel, { passive: false });
    return () => {
      card?.removeEventListener("wheel", handleWorldWheel);
      svg?.removeEventListener("wheel", handleWorldWheel);
    };
  }, [view.scale, view.x, view.y]);

  function handleWorldPointerDown(event) {
    if (event.button !== 0) return;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleWorldPointerMove(event) {
    if (!dragRef.current.active) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((event.clientX - dragRef.current.x) / rect.width) * 800;
    const dy = ((event.clientY - dragRef.current.y) / rect.height) * 400;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    setView((current) => clampWorldView({ ...current, x: current.x + dx, y: current.y + dy }));
  }

  function handleWorldPointerUp(event) {
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <article
      className={`journey-card dot-map-card aceternity-world-card ${isVisualActive ? "visual-active" : "visual-paused"}`}
      ref={cardRef}
    >
      <div>
        <p className="eyebrow">World Map</p>
        <h3>点阵轨迹</h3>
        <span>{arcs.length} 条轨迹</span>
        <div className="world-map-actions" aria-label="调整点阵地图">
          <button onClick={() => zoomWorldMap(view.scale * 1.22)} type="button">+</button>
          <button onClick={() => zoomWorldMap(view.scale / 1.22)} type="button">−</button>
          <button onClick={() => setView({ scale: 1.12, x: -48, y: -24 })} type="button" aria-label="复位点阵地图">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <svg
        className="aceternity-world-map"
        onPointerCancel={handleWorldPointerUp}
        onPointerDown={handleWorldPointerDown}
        onPointerMove={handleWorldPointerMove}
        onPointerUp={handleWorldPointerUp}
        ref={svgRef}
        viewBox="0 0 800 400"
        role="img"
        aria-label="点阵世界地图轨迹"
      >
        <defs>
          <linearGradient id="aceternityRouteGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="8%" stopColor="#0ea5e9" stopOpacity="0.96" />
            <stop offset="92%" stopColor="#0ea5e9" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="aceternityWorldFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="4%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="96%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
          </linearGradient>
          <mask id="aceternityWorldMask">
            <rect width="800" height="400" fill="url(#aceternityWorldFade)" />
          </mask>
          <filter id="aceternityMapGlow">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        <rect width="800" height="400" rx="20" fill="#ffffff00" />
        <g transform={`translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.scale.toFixed(3)})`}>
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
        </g>
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
  mapTileSource,
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
      if (Array.isArray(tileLayerRef.current)) {
        tileLayerRef.current.forEach((layer) => layer.remove());
      } else {
        tileLayerRef.current.remove();
      }
      tileLayerRef.current = null;
    }

    const configs = getTileLayersConfigs(mapTileSource, "", mapTheme.id);
    if (configs.length > 1) {
      tileLayerRef.current = configs.map((cfg) => {
        return L.tileLayer(cfg.url, {
          attribution: cfg.attribution,
          maxZoom: 20,
          noWrap: false,
          keepBuffer: 4,
          subdomains: cfg.subdomains || "abc",
        }).addTo(map);
      });
    } else {
      const config = configs[0];
      tileLayerRef.current = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: 20,
        noWrap: false,
        keepBuffer: 4,
        subdomains: config.subdomains || "abc",
      }).addTo(map);
    }
  }, [mapTheme, mapTileSource]);

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
      </div>
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

function MapThemePicker({ activeThemeId, onChange, themes, variant = "map" }) {
  return (
    <div
      className={`map-theme-picker${variant === "nav" ? " nav-theme-picker" : ""}`}
      aria-label="地图配色方案"
    >
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
  recentInteractions = [],
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
        recentInteractions={recentInteractions}
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
      : "当前国家暂无省级边界数据";

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
          : "当前国家暂无省级边界数据",
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
              {regionTotal ? targetVisitedRegions.size : "-"}
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
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
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
              recentInteractions={recentInteractions}
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
              mapTileSource={mapTileSource}
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
                  {regionTotal ? visitedRegions.size : "-"}
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
  mapTileSource,
}) {
  const miniRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileLayerRef = useRef(null);
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
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      if (Array.isArray(tileLayerRef.current)) {
        tileLayerRef.current.forEach((layer) => layer.remove());
      } else {
        tileLayerRef.current.remove();
      }
      tileLayerRef.current = null;
    }
    const configs = getTileLayersConfigs(mapTileSource, "light");
    if (configs.length > 1) {
      tileLayerRef.current = configs.map((cfg) => {
        return L.tileLayer(cfg.url, {
          maxZoom: 20,
          attribution: cfg.attribution,
          subdomains: cfg.subdomains || "abc",
        }).addTo(map);
      });
    } else {
      const config = configs[0];
      tileLayerRef.current = L.tileLayer(config.url, {
        maxZoom: 20,
        attribution: config.attribution,
        subdomains: config.subdomains || "abc",
      }).addTo(map);
    }
  }, [mapTileSource]);

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
  recentInteractions = [],
}) {
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const [visitedAt, setVisitedAt] = useState("");
  const [type, setType] = useState("旅行");
  const [visitChoice, setVisitChoice] = useState(null);
  const addedItemRefs = useRef(new Map());
  const addedListRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!visitChoice) return;
    function handleOutsideClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setVisitChoice(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [visitChoice]);

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
    const finalPlaces = Array.from(byPlace.values());
    if (recentInteractions && recentInteractions.length > 0) {
      finalPlaces.sort((a, b) => {
        const aKey = canonicalPlaceId(a.place.mapId || a.place.id);
        const bKey = canonicalPlaceId(b.place.mapId || b.place.id);
        const aIdx = recentInteractions.indexOf(aKey);
        const bIdx = recentInteractions.indexOf(bKey);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    }
    return finalPlaces;
  }, [activeProfile, compact, places, visits, recentInteractions]);

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
    setVisitChoice({ action, place: item.place, visits: itemVisits });
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
        <div className="visit-choice-popover" ref={popoverRef} role="dialog" aria-modal="false">
          <div>
            <strong>{visitChoice.action === "delete" ? "选择要删除的记录" : "选择要编辑的记录"}</strong>
            <small>{displayPlaceName(visitChoice.place)}</small>
          </div>
          {visitChoice.visits.map((visit) => (
            <button key={visit.id} onClick={() => runVisitChoice(visit)} type="button">
              <span>{profileLabel(visit.profileId)}</span>
              <small>
                {displayVisitDate(visit) || "未填写日期"} · {visit.type || "旅行"} · {visit.rating ? `${visit.rating}/10 ★` : "未评分"}
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await onUpdateVisit(visit.id, {
      file: form.get("photo"),
      files: getPhotoFilesFromForm(formElement),
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
          <input accept="image/*" multiple name="photo" type="file" />
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

function CountryGalleryCard({ country }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [wasHovered, setWasHovered] = useState(false);
  const images = country.images || [];
  const basePath = ASSET_BASE_URL;

  function handlePhotoLeave() {
    if (!wasHovered || images.length <= 1) return;
    setActiveImageIndex((current) => (current + 1) % images.length);
    setWasHovered(false);
  }

  return (
    <article className={`country-gallery-card ${country.isVisited ? "" : "locked"}`}>
      <div className="country-gallery-card-copy">
        <strong className={country.name.length >= 9 ? "long-name" : ""}>
          <span>{country.name}</span>
          <FlagIcon place={country.place} />
        </strong>
        <small>{country.subtitle}</small>
      </div>
      <div
        className="country-gallery-photo-frame"
        onMouseEnter={() => setWasHovered(true)}
        onMouseLeave={handlePhotoLeave}
      >
        {images.map((src, index) => (
          <img
            alt={`${country.name} ${index + 1}`}
            className={index === activeImageIndex ? "active" : ""}
            decoding="async"
            draggable={false}
            key={src}
            loading="lazy"
            src={`${basePath}${src}`}
            onError={handleImageLoadError}
          />
        ))}
      </div>
    </article>
  );
}

function CountryGallery({ continentSummary = [], countryPlaces = [] }) {
  const [showLockedCountries, setShowLockedCountries] = useState(false);
  const { visitedGroups, lockedGroups, visitedCount, lockedCount } = useMemo(() => {
    const visitedIds = new Set();
    const visitedByContinent = new Map();

    function toGalleryCountry(country, isVisited) {
      const galleryKey = countryGalleryKey(country);
      const images = galleryKey ? countryGalleryImages[galleryKey] : null;
      if (!images?.length) return null;
      return {
        ...country,
        isVisited,
        galleryKey,
        images,
        subtitle: countryGallerySubtitle(country, galleryKey),
      };
    }

    continentSummary.forEach((continent) => {
      const countries = (continent.countries || [])
        .map((country) => {
          if (country.id) visitedIds.add(country.id);
          return toGalleryCountry(country, true);
        })
        .filter(Boolean);
      if (countries.length) {
        visitedByContinent.set(continent.label, countries);
      }
    });

    const lockedByContinent = new Map();
    countryPlaces.forEach((place) => {
      if (!place?.id || place.id === "ATA" || visitedIds.has(place.id)) return;
      const label = continentLabelForCountry(place);
      const country = {
        id: place.id,
        name: displayCountryName(place),
        place,
        visits: 0,
      };
      const galleryCountry = toGalleryCountry(country, false);
      if (!galleryCountry) return;
      const bucket = lockedByContinent.get(label) || [];
      bucket.push(galleryCountry);
      lockedByContinent.set(label, bucket);
    });

    lockedByContinent.forEach((countries) => {
      countries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    });

    const orderedLabels = [];
    continentSummary.forEach((continent) => {
      if (!orderedLabels.includes(continent.label)) orderedLabels.push(continent.label);
    });
    countryPlaces.forEach((place) => {
      const label = continentLabelForCountry(place);
      if (!orderedLabels.includes(label)) orderedLabels.push(label);
    });

    const buildGroups = (sourceMap) =>
      orderedLabels
        .map((label) => {
          const countries = sourceMap.get(label) || [];
          if (!countries.length) return null;
          const sourceContinent = continentSummary.find((continent) => continent.label === label) || {};
          return {
            ...sourceContinent,
            label,
            englishLabel: CONTINENT_ENGLISH_LABELS[label] || label,
            countries,
          };
        })
        .filter(Boolean);

    const unlockedGroups = buildGroups(visitedByContinent);
    const hiddenGroups = buildGroups(lockedByContinent);

    return {
      visitedGroups: unlockedGroups,
      lockedGroups: hiddenGroups,
      visitedCount: unlockedGroups.reduce((sum, continent) => sum + continent.countries.length, 0),
      lockedCount: hiddenGroups.reduce((sum, continent) => sum + continent.countries.length, 0),
    };
  }, [continentSummary, countryPlaces]);

  if (!visitedGroups.length && !lockedGroups.length) return null;

  return (
    <section className="country-gallery-section" id="country-gallery-section" aria-label="国家图鉴">
      <div className="country-gallery-title">
        <h2>
          国家图鉴·<span className="major-title-en">Unlocked Countries</span>·<span className="major-title-number">{visitedCount}</span>
        </h2>
        {lockedCount > 0 ? (
          <button
            className={`country-gallery-toggle ${showLockedCountries ? "active" : ""}`}
            onClick={() => setShowLockedCountries((current) => !current)}
            type="button"
          >
            {showLockedCountries ? "隐藏未解锁" : "显示未解锁"}
            <span>{lockedCount}</span>
          </button>
        ) : null}
      </div>
      <div className="country-gallery-stack">
        {visitedGroups.map((continent) => (
          <article className="country-gallery-continent" key={continent.label}>
            <div className="country-gallery-continent-heading">
              <h3>
                {continent.label} · {continent.englishLabel} · {continent.countries.length}
              </h3>
            </div>
            <div className="country-gallery-grid">
              {continent.countries.map((country) => (
                <CountryGalleryCard country={country} key={`${country.id}-${country.galleryKey}`} />
              ))}
            </div>
          </article>
        ))}
      </div>
      {showLockedCountries && lockedGroups.length > 0 ? (
        <div className="country-gallery-locked-block">
          <div className="country-gallery-title locked-title">
            <h2>
              未解锁国家·<span className="major-title-en">Locked Countries</span>·<span className="major-title-number">{lockedCount}</span>
            </h2>
          </div>
          <div className="country-gallery-stack">
            {lockedGroups.map((continent) => (
              <article className="country-gallery-continent" key={`locked-${continent.label}`}>
                <div className="country-gallery-continent-heading">
                  <h3>
                    {continent.label} · {continent.englishLabel} · {continent.countries.length}
                  </h3>
                </div>
                <div className="country-gallery-grid">
                  {continent.countries.map((country) => (
                    <CountryGalleryCard country={country} key={`locked-${country.id}-${country.galleryKey}`} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
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
              src={`${ASSET_BASE_URL}${imagePath}`}
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
      <section className="overview-section comparison-overview" id="overview-section" aria-label="足迹对比总览">
        <div className="section-title overview-title">
          <h2>
            统计数据·<span className="major-title-en">Overview</span>
          </h2>
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
    <section className="overview-section" id="overview-section" aria-label="足迹总览">
      <div className="section-title overview-title">
        <h2>
          统计数据·<span className="major-title-en">Overview</span>
        </h2>
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

const CHINA_REGION_GROUPS = {
  "上海": "华东", "江苏": "华东", "浙江": "华东", "安徽": "华东", "福建": "华东", "江西": "华东", "山东": "华东",
  "北京": "华北", "天津": "华北", "河北": "华北", "山西": "华北", "内蒙古": "华北",
  "河南": "华中", "湖北": "华中", "湖南": "华中",
  "广东": "华南", "广西": "华南", "海南": "华南",
  "重庆": "西南", "四川": "西南", "贵州": "西南", "云南": "西南", "西藏": "西南",
  "陕西": "西北", "甘肃": "西北", "青海": "西北", "宁夏": "西北", "新疆": "西北",
  "辽宁": "东北", "吉林": "东北", "黑龙江": "东北",
  "香港": "港澳台", "澳门": "港澳台", "台湾": "港澳台"
};

const CHINA_REGION_ENGLISH = {
  "华东": "East China",
  "华北": "North China",
  "华中": "Central China",
  "华南": "South China",
  "西南": "Southwest China",
  "西北": "Northwest China",
  "东北": "Northeast China",
  "港澳台": "Hong Kong, Macao & Taiwan"
};

const CHINA_REGION_ORDER = ["华北", "东北", "华东", "华中", "华南", "西南", "西北", "港澳台"];

function getProvinceShortName(place) {
  if (!place) return "";
  const name = place.localName || place.name || "";
  return name
    .replace("特别行政区", "")
    .replace("壮族自治区", "")
    .replace("回族自治区", "")
    .replace("维吾尔自治区", "")
    .replace("内蒙古自治区", "内蒙古")
    .replace("自治区", "")
    .replace("省", "")
    .replace("市", "");
}

function formatProvinceDisplayName(place) {
  if (!place) return "";
  const local = place.localName || "";
  const english = place.name || "";
  let chn = local;
  if (local.endsWith("特别行政区")) {
    chn = local.replace("特别行政区", "");
  } else if (local.endsWith("自治区")) {
    if (local === "内蒙古自治区") chn = "内蒙古";
    else if (local === "西藏自治区") chn = "西藏";
    else if (local === "新疆维吾尔自治区") chn = "新疆";
    else if (local === "广西壮族自治区") chn = "广西";
    else if (local === "宁夏回族自治区") chn = "宁夏";
  }
  return `${chn} · ${english}`;
}

function ProvinceGalleryCard({ province }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [wasHovered, setWasHovered] = useState(false);
  const images = province.images || [];
  const basePath = ASSET_BASE_URL;

  function handlePhotoLeave() {
    if (!wasHovered || images.length <= 1) return;
    setActiveImageIndex((current) => (current + 1) % images.length);
    setWasHovered(false);
  }

  return (
    <article className={`country-gallery-card ${province.isVisited ? "" : "locked"}`}>
      <div className="country-gallery-card-copy">
        <strong className="province-name" style={{ fontSize: "0.86rem", whiteSpace: "normal", display: "block", textAlign: "center" }}>
          <span>{province.name}</span>
        </strong>
      </div>
      <div
        className="country-gallery-photo-frame"
        onMouseEnter={() => setWasHovered(true)}
        onMouseLeave={handlePhotoLeave}
      >
        {images.map((src, index) => (
          <img
            alt={`${province.name} ${index + 1}`}
            className={index === activeImageIndex ? "active" : ""}
            decoding="async"
            draggable={false}
            key={src}
            loading="lazy"
            src={`${basePath}${src}`}
            onError={handleImageLoadError}
          />
        ))}
      </div>
    </article>
  );
}

function ProvinceGallery({ regionPlaces = [], filteredVisits = [], placeLookup }) {
  const [showLockedProvinces, setShowLockedProvinces] = useState(false);

  const { visitedProvinces, lockedProvinces, visitedCount, lockedCount } = useMemo(() => {
    const visitedRegionIds = new Set();
    for (const visit of filteredVisits) {
      const regionId = resolveMapIdForLevel(visit.placeId, "region", placeLookup);
      if (regionId) visitedRegionIds.add(regionId);
    }

    const galleryProvinces = regionPlaces
      .map((place) => {
        const isChina = place.parentId === "CHN" || place.countryCode === "CHN" || place.id.startsWith("CHN-") || ["CN-HK", "CN-MO", "CN-TW"].includes(place.id);
        if (!isChina) return null;

        const shortName = getProvinceShortName(place);
        const images = provinceGalleryImages[shortName] || [];
        if (!images.length) return null;

        const isVisited = visitedRegionIds.has(place.id);
        return {
          id: place.id,
          name: formatProvinceDisplayName(place),
          place,
          isVisited,
          images,
          shortName
        };
      })
      .filter(Boolean);

    const visited = galleryProvinces.filter(p => p.isVisited);
    const locked = galleryProvinces.filter(p => !p.isVisited);

    const priority = ["北京", "上海", "重庆", "天津"];
    const sortProvinces = (list) => {
      list.sort((a, b) => {
        const idxA = priority.indexOf(a.shortName);
        const idxB = priority.indexOf(b.shortName);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.shortName.localeCompare(b.shortName, "zh-CN");
      });
    };

    sortProvinces(visited);
    sortProvinces(locked);

    return {
      visitedProvinces: visited,
      lockedProvinces: locked,
      visitedCount: visited.length,
      lockedCount: locked.length,
    };
  }, [regionPlaces, filteredVisits, placeLookup]);

  if (!visitedProvinces.length && !lockedProvinces.length) return null;

  return (
    <section className="country-gallery-section" id="province-gallery-section" aria-label="省份图鉴" style={{ borderTop: "1px dashed #dbe4ee", paddingTop: "40px", marginTop: "40px" }}>
      <div className="country-gallery-title">
        <h2>
          省份图鉴·<span className="major-title-en">Unlocked Provinces</span>·<span className="major-title-number">{visitedCount}</span>
        </h2>
        {lockedCount > 0 ? (
          <button
            className={`country-gallery-toggle ${showLockedProvinces ? "active" : ""}`}
            onClick={() => setShowLockedProvinces((current) => !current)}
            type="button"
          >
            {showLockedProvinces ? "隐藏未解锁" : "显示未解锁"}
            <span>{lockedCount}</span>
          </button>
        ) : null}
      </div>
      
      <div className="country-gallery-grid" style={{ marginTop: "24px" }}>
        {visitedProvinces.map((prov) => (
          <ProvinceGalleryCard province={prov} key={prov.id} />
        ))}
      </div>
      {showLockedProvinces && lockedProvinces.length > 0 ? (
        <div className="country-gallery-locked-block" style={{ marginTop: "40px" }}>
          <div className="country-gallery-title locked-title">
            <h2>
              未解锁省份·<span className="major-title-en">Locked Provinces</span>·<span className="major-title-number">{lockedCount}</span>
            </h2>
          </div>
          <div className="country-gallery-grid" style={{ marginTop: "24px" }}>
            {lockedProvinces.map((prov) => (
              <ProvinceGalleryCard province={prov} key={`locked-${prov.id}`} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// -------------------------------------------------------------
// 旅行记录 (Travel Notes) 模块实现


function TravelNotesSection({ isEditor, session, activeProfile, profiles, mapTileSource, setMapTileSource }) {
  const canEdit = session ? isEditor : true;
  const [notes, setNotes] = useState(() => {
    let deletedIds = [];
    try {
      deletedIds = JSON.parse(localStorage.getItem("deleted_default_notes") || "[]");
    } catch (e) {
      console.error(e);
    }
    const initial = defaultTravelNotes.filter((n) => !deletedIds.includes(n.id));
    try {
      const order = JSON.parse(localStorage.getItem("travel_notes_order") || "[]");
      if (order.length > 0) {
        return initial.sort((a, b) => {
          const idxA = order.indexOf(a.id);
          const idxB = order.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
    } catch (e) {
      console.error(e);
    }
    return initial;
  });
  const [notesLoading, setNotesLoading] = useState(false);
  
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [activeDayFilter, setActiveDayFilter] = useState(null);
  const pendingZoomAddress = useRef(null);
  const isExpanding = useRef(false);
  const mapInstances = useRef({});

  const [activeZoomPhoto, setActiveZoomPhoto] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActiveZoomPhoto(null);
      }
    };
    if (activeZoomPhoto) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeZoomPhoto]);

  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragOverCardId, setDragOverCardId] = useState(null);

  const handleCardDragStart = (e, noteId) => {
    if (!session) return;
    setDraggedCardId(noteId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCardDragOver = (e, noteId) => {
    if (!session || draggedCardId === null) return;
    if (draggedCardId !== noteId) {
      e.preventDefault();
      setDragOverCardId(noteId);
    }
  };

  const handleCardDragLeave = () => {
    setDragOverCardId(null);
  };

  const handleCardDrop = (e, targetNoteId) => {
    if (!session || draggedCardId === null || draggedCardId === targetNoteId) return;
    e.preventDefault();
    setNotes((prev) => {
      const list = [...prev];
      const draggedIndex = list.findIndex((n) => n.id === draggedCardId);
      const targetIndex = list.findIndex((n) => n.id === targetNoteId);
      if (draggedIndex > -1 && targetIndex > -1) {
        const [moved] = list.splice(draggedIndex, 1);
        list.splice(targetIndex, 0, moved);
      }
      try {
        localStorage.setItem("travel_notes_order", JSON.stringify(list.map((n) => n.id)));
      } catch (err) {
        console.error(err);
      }
      return list;
    });
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  // 从 Supabase 云端加载旅行记录（仅在已登录的编辑者电脑上静默同步更新）
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const { data, error } = await withTimeout(supabase
          .from("travel_notes")
          .select("*")
          .order("created_at", { ascending: false }), 3500);
        if (error) {
          console.warn("Supabase travel_notes load failed:", error.message);
          return;
        }
        if (data) {
          const dbNotes = data.map((row) => ({
            id: row.id,
            city: row.city,
            coverImage: row.cover_image,
            startDate: row.start_date,
            endDate: row.end_date,
            rating: row.rating,
            summary: row.summary,
            center: row.center,
            addresses: row.addresses,
            coverImagePosition: row.cover_image_position || { x: 50, y: 50 },
            author: row.cover_image_position?.author || "Xiao",
          }));
          let deletedIds = [];
          try {
            deletedIds = JSON.parse(localStorage.getItem("deleted_default_notes") || "[]");
          } catch (e) {
            console.error(e);
          }
          const merged = dbNotes.filter((n) => !deletedIds.includes(n.id));

          const classicIds = ["note-1", "note-2", "note-3", "note-4", "note-5"];
          defaultTravelNotes.forEach((defNote) => {
            if (classicIds.includes(defNote.id)) {
              if (!deletedIds.includes(defNote.id)) {
                if (!merged.some((n) => n.id === defNote.id || n.city === defNote.city)) {
                  merged.push(defNote);
                }
              }
            }
          });
          let order = [];
          try {
            order = JSON.parse(localStorage.getItem("travel_notes_order") || "[]");
          } catch (e) {
            console.error(e);
          }
          if (order.length > 0) {
            merged.sort((a, b) => {
              const idxA = order.indexOf(a.id);
              const idxB = order.indexOf(b.id);
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
          }
          setNotes(merged);
        }
      } catch (e) {
        console.warn("Error loading travel notes from Supabase:", e);
      } finally {
        setNotesLoading(false);
      }
    };
    loadNotes();
  }, [session]);

  // 当切换卡片时重置天数过滤和挂起的地点，并管理展开过渡状态
  useEffect(() => {
    setActiveDayFilter(null);
    pendingZoomAddress.current = null;
    if (expandedNoteId) {
      isExpanding.current = true;
      const timer = setTimeout(() => {
        isExpanding.current = false;
      }, 450);
      return () => clearTimeout(timer);
    } else {
      isExpanding.current = false;
    }
  }, [expandedNoteId]);

  // 当展开卡片时，根据地点是国内还是国外，自动切换默认地图图源
  useEffect(() => {
    if (!expandedNoteId) return;
    const note = notes.find((n) => n.id === expandedNoteId);
    if (!note) return;
    
    const domestic = isNoteDomestic(note);
    if (domestic) {
      // 国内：如果当前使用的是国外专用的 Esri，则默认切换到天地图
      if (mapTileSource === "direct") {
        setMapTileSource("tianditu");
      }
    } else {
      // 国外：如果当前使用的是国内专用的天地图或高德，则强切换到 Esri (direct)
      if (mapTileSource === "tianditu" || mapTileSource === "amap") {
        setMapTileSource("direct");
      }
    }
  }, [expandedNoteId, notes, mapTileSource, setMapTileSource]);

  // 反应式初始化/重绘地图
  useEffect(() => {
    if (expandedNoteId) {
      const note = notes.find((n) => n.id === expandedNoteId);
      if (note) {
        const timer = setTimeout(() => {
          initMap(note.id, note.center, note.addresses, activeDayFilter);
        }, 400);
        return () => clearTimeout(timer);
      }
    } else {
      // 收起时清理所有实例
      Object.keys(mapInstances.current).forEach((key) => {
        try {
          mapInstances.current[key].remove();
        } catch (e) {
          console.error(e);
        }
      });
      mapInstances.current = {};
    }
  }, [expandedNoteId, activeDayFilter, notes, mapTileSource]);

  // 当展开卡片时，平滑滚动至其顶部
  useEffect(() => {
    if (expandedNoteId) {
      setTimeout(() => {
        const el = document.getElementById(`travel-note-card-${expandedNoteId}`);
        if (el) {
          const offset = 100;
          const top = el.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        }
      }, 100);
    }
  }, [expandedNoteId]);

  // 处理 Leaflet 地图初始化
  const initMap = (noteId, center, addresses, dayFilter) => {
    const containerId = `note-map-${noteId}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    let map = mapInstances.current[noteId];
    const configs = getTileLayersConfigs(mapTileSource, "street");

    if (!map) {
      map = L.map(containerId, { zoomControl: true }).setView(center || [48.8566, 2.3522], 12);
      map._tileLayers = configs.map((cfg) => {
        return L.tileLayer(cfg.url, {
          attribution: cfg.attribution,
          subdomains: cfg.subdomains || "abc"
        }).addTo(map);
      });
      mapInstances.current[noteId] = map;
    } else {
      if (map._tileLayers) {
        map._tileLayers.forEach((layer) => layer.remove());
      }
      map._tileLayers = configs.map((cfg) => {
        return L.tileLayer(cfg.url, {
          attribution: cfg.attribution,
          subdomains: cfg.subdomains || "abc"
        }).addTo(map);
      });
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          map.removeLayer(layer);
        }
      });
    }

    // 按天生成和管理轨迹与标记
    const dayColors = {
      1: "#3b82f6", // Blue
      2: "#ec4899", // Pink
      3: "#10b981", // Emerald
      4: "#f59e0b", // Amber
      5: "#8b5cf6", // Purple
      6: "#ef4444", // Red
      7: "#06b6d4"  // Cyan
    };
    const getDayColor = (d) => dayColors[d] || "#64748b";

    const uniqueDays = [...new Set(addresses.map((a) => a.day || 1))].sort((a, b) => a - b);
    uniqueDays.forEach((dayNum) => {
      // 如果开启了天数过滤，且不属于这一天，则直接跳过该路线和地点的绘制
      if (dayFilter !== null && dayFilter !== dayNum) return;

      const dayAddrs = addresses.filter((a) => (a.day || 1) === dayNum && a.coordinates && a.coordinates.lat && a.coordinates.lng);
      
      // 绘制连线
      if (dayAddrs.length >= 2) {
        const latlngs = dayAddrs.map((a) => {
          const coords = adjustCoords(a.coordinates, mapTileSource);
          return [coords.lat, coords.lng];
        });
        const polyline = L.polyline(latlngs, {
          color: getDayColor(dayNum),
          weight: 4,
          opacity: 0.85,
          dashArray: "6, 8"
        }).addTo(map);

        polyline.bindTooltip(`Day ${dayNum}`, {
          permanent: false,
          direction: "center",
          className: "day-route-tooltip"
        });
      }

      // 绘制带天数专属颜色和序号的 Marker
      dayAddrs.forEach((addr, idx) => {
        const customIcon = L.divIcon({
          className: "custom-numbered-marker-wrapper",
          html: `<div class="custom-numbered-marker" style="background-color: ${getDayColor(dayNum)}; box-shadow: 0 0 0 3px ${getDayColor(dayNum)}33;">${idx + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const coords = adjustCoords(addr.coordinates, mapTileSource);
        L.marker([coords.lat, coords.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(`<strong style="font-family: var(--prophet-serif); font-size: 0.88rem;">Day ${dayNum} - 第 ${idx + 1} 站: ${addr.name}</strong>`);
      });
    });

    // 检查是否有挂起的具体打卡点需要聚焦，如果有则直接聚焦
    // zoomToAddress 内部已经包含 invalidateSize + rAF 的精确时序，这里直接调用
    if (pendingZoomAddress.current) {
      const addr = pendingZoomAddress.current;
      pendingZoomAddress.current = null;
      zoomToAddress(noteId, addr);
    } else {
      // 缩放到当前过滤后的最佳视野范围
      // 先强制刷新容器尺寸，再用 rAF 等一帧，确保投影矩阵正确
      map.invalidateSize({ animate: false });
      requestAnimationFrame(() => {
        const filterPoints = addresses.filter((a) => {
          const isDayMatch = dayFilter === null || (a.day || 1) === dayFilter;
          return isDayMatch && a.coordinates && a.coordinates.lat && a.coordinates.lng;
        });

        if (filterPoints.length > 0) {
          const bounds = L.latLngBounds(filterPoints.map((a) => {
            const coords = adjustCoords(a.coordinates, mapTileSource);
            return [coords.lat, coords.lng];
          }));
          // 使用非对称 Padding：给右上角图例留出 120px，其余方向只需 50px 保证路线区域缩放到最饱满且合理的大小
          map.fitBounds(bounds, {
            paddingTopLeft: [50, 50],
            paddingBottomRight: [120, 50],
            animate: true,
            duration: 1.0
          });
        }
      });
    }

    mapInstances.current[noteId] = map;
  };

  const zoomToAddress = (noteId, addr) => {
    const map = mapInstances.current[noteId];
    if (map && addr && addr.coordinates) {
      const coords = adjustCoords(addr.coordinates, mapTileSource);
      const { lat, lng } = coords;
      // Step 1: force Leaflet to recalculate container dimensions
      map.invalidateSize({ animate: false });
      // Step 2: wait two animation frames so the projection matrix is fully updated
      // before calling setView — this fixes the "point not in center" bug
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          map.setView([lat, lng], 16, { animate: true, duration: 0.8 });
          // Step 3: open the popup after the pan completes
          setTimeout(() => {
            map.eachLayer((layer) => {
              if (layer instanceof L.Marker) {
                const latlng = layer.getLatLng();
                if (Math.abs(latlng.lat - lat) < 0.0001 && Math.abs(latlng.lng - lng) < 0.0001) {
                  layer.bindPopup(`<strong style="font-family: var(--prophet-serif); font-size: 0.88rem;">Day ${addr.day || 1} - ${addr.name}</strong>`).openPopup();
                }
              }
            });
          }, 900);
        });
      });
    }
  };

  const handleLinkClick = (noteId, addr) => {
    const targetDay = addr.day || 1;
    if (activeDayFilter !== targetDay) {
      // 先设置挂起地点，再切换天数，initMap 完成重绘后会读取并聚焦
      pendingZoomAddress.current = addr;
      setActiveDayFilter(targetDay);
    } else {
      // 同一天：直接聚焦，不需要 pending（避免残留影响后续操作）
      pendingZoomAddress.current = null;
      zoomToAddress(noteId, addr);
    }
  };

  const handleDayRouteClick = (noteId, dayNum) => {
    // 无论哪种情况，点击路线定位时都清除挂起地点，防止残留 pendingZoomAddress 干扰 fitBounds
    pendingZoomAddress.current = null;
    if (activeDayFilter === dayNum) {
      // 如果已经筛选了该天，手动触发镜头重置/定位
      const map = mapInstances.current[noteId];
      const note = notes.find((n) => n.id === noteId);
      if (map && note) {
        const dayAddrs = note.addresses.filter((a) => (a.day || 1) === dayNum && a.coordinates && a.coordinates.lat && a.coordinates.lng);
        if (dayAddrs.length > 0) {
          map.invalidateSize({ animate: false });
          requestAnimationFrame(() => {
            const bounds = L.latLngBounds(dayAddrs.map((a) => {
              const coords = adjustCoords(a.coordinates, mapTileSource);
              return [coords.lat, coords.lng];
            }));
            map.fitBounds(bounds, { paddingTopLeft: [50, 50], paddingBottomRight: [120, 50], animate: true, duration: 1.0 });
          });
        }
      }
    } else {
      setActiveDayFilter(dayNum);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("确定要删除这篇旅行记录吗？")) return;
    
    const isDefault = defaultTravelNotes.some((n) => n.id === id) || ["note-1", "note-2", "note-3", "note-4", "note-5"].includes(id);
    if (isDefault) {
      try {
        const deletedIds = JSON.parse(localStorage.getItem("deleted_default_notes") || "[]");
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          localStorage.setItem("deleted_default_notes", JSON.stringify(deletedIds));
        }
      } catch (err) {
        console.error("Failed to save deleted default note ID:", err);
      }
      
      // Try to delete it from Supabase as well in case it was modified and saved to the cloud,
      // but do not block or throw error if it fails (e.g. if not logged in or doesn't exist).
      try {
        if (session) {
          await supabase.from("travel_notes").delete().eq("id", id);
        }
      } catch (err) {
        console.warn("Failed to delete default note from Supabase (safe to ignore):", err);
      }
    } else {
      const { error } = await supabase.from("travel_notes").delete().eq("id", id);
      if (error) {
        alert("删除失败：" + error.message);
        return;
      }
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (expandedNoteId === id) setExpandedNoteId(null);
  };

  const handleEdit = (note, e) => {
    e.stopPropagation();
    setEditingNote(JSON.parse(JSON.stringify(note)));
  };

  const handleSaveNote = async (savedNote) => {
    // 辅助：Base64 转 Blob (使用 Fetch API 异步解析，完全避免 CPU 密集型循环以防止大图和多图造成的内存崩溃)
    const base64ToBlob = async (base64Str) => {
      try {
        const res = await fetch(base64Str);
        return await res.blob();
      } catch (e) {
        // Fallback for environment constraints
        const block = base64Str.split(';');
        const mime = block[0].split(':')[1] || 'image/jpeg';
        const realData = block.length > 1 ? block[1].split(',')[1] : base64Str;
        const byteString = atob(realData);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mime });
      }
    };

    // 辅助：上传 Base64 到 Supabase Storage 并返回公开 URL
    const uploadBase64 = async (base64Str, prefix) => {
      if (!base64Str || !base64Str.startsWith("data:")) return base64Str;
      try {
        const mime = base64Str.split(';')[0].split(':')[1];
        const ext = mime.split('/')[1] || 'jpg';
        const blob = await base64ToBlob(base64Str);
        const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const storagePath = `travel_notes/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, blob, {
            contentType: mime,
            upsert: true,
          });
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
        return data.publicUrl;
      } catch (e) {
        console.error("Upload base64 photo failed:", e);
        throw new Error("保存图片到云存储失败: " + e.message);
      }
    };

    try {
      const uploadPromises = [];

      // 1. 上传封面图（如果是 base64）
      let finalCover = savedNote.coverImage;
      if (finalCover && finalCover.startsWith("data:")) {
        uploadPromises.push(
          uploadBase64(finalCover, "cover").then((url) => {
            finalCover = url;
          })
        );
      }

      // 2. 收集所有足迹点配图的上传任务以并发执行
      const finalAddresses = savedNote.addresses.map((addr) => {
        const finalPhotos = [];
        // 如果没有 photos 属性，利用已有的 image 字段创建 fallback photo
        const addrPhotos = addr.photos || (addr.image ? [{ id: `ph-init-${Date.now()}`, dataUrl: addr.image, ratio: "4:3" }] : []);
        
        addrPhotos.forEach((photo) => {
          const photoObj = {
            id: photo.id,
            url: photo.url || null,
            ratio: photo.ratio || "4:3"
          };
          finalPhotos.push(photoObj);

          const finalPhotoUrl = photo.dataUrl || photo.url;
          if (finalPhotoUrl && finalPhotoUrl.startsWith("data:")) {
            const task = uploadBase64(finalPhotoUrl, `addr-photo-${addr.id}-${photo.id}`)
              .then((uploadedUrl) => {
                photoObj.url = uploadedUrl;
              });
            uploadPromises.push(task);
          } else {
            photoObj.url = finalPhotoUrl;
          }
        });

        return {
          ...addr,
          photos: finalPhotos,
          image: null // 稍后在 Promise.all 之后填充
        };
      });

      // 并发上传所有图片
      await Promise.all(uploadPromises);

      // 后置处理：为了保持向后兼容，将 photos 的第一张图的 url 挂载到 image 上
      finalAddresses.forEach((addr) => {
        addr.image = addr.photos.length > 0 ? addr.photos[0].url : null;
      });

      const noteToSave = {
        ...savedNote,
        coverImage: finalCover,
        addresses: finalAddresses,
        coverImagePosition: {
          ...(savedNote.coverImagePosition || { x: 50, y: 50 }),
          author: savedNote.author || "Xiao"
        }
      };

      // 3. 转换字段名：前端 camelCase → 数据库 snake_case
      const dbRecord = {
        id: noteToSave.id,
        city: noteToSave.city,
        cover_image: noteToSave.coverImage,
        cover_image_position: noteToSave.coverImagePosition || { x: 50, y: 50 },
        start_date: noteToSave.startDate,
        end_date: noteToSave.endDate,
        rating: noteToSave.rating,
        summary: noteToSave.summary,
        center: noteToSave.center,
        addresses: noteToSave.addresses,
        created_by: session?.user?.id ?? null,
      };

      // 4. 保存到数据库
      const { error } = await supabase
        .from("travel_notes")
        .upsert(dbRecord, { onConflict: "id" });
      if (error) {
        throw error;
      }

      // 更新本地状态
      if (notes.some((n) => n.id === noteToSave.id)) {
        setNotes((prev) => prev.map((n) => (n.id === noteToSave.id ? noteToSave : n)));
      } else {
        setNotes((prev) => [noteToSave, ...prev]);
      }
      setEditingNote(null);
      setIsAddingNote(false);
      return true;
    } catch (error) {
      alert("保存失败：" + error.message);
      return false;
    }
  };

  // 格式化段落文本中的超链接地址
  const renderTextWithLinks = (noteId, text, addresses) => {
    if (!text || !addresses || addresses.length === 0) return text;
    
    // 按长度降序排序避免部分匹配冲突
    const sorted = [...addresses].sort((a, b) => b.name.length - a.name.length);
    const escapedNames = sorted.map((a) => a.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex = new RegExp(`(${escapedNames.join("|")})`, "g");
    
    const parts = text.split(regex);
    return parts.map((part, index) => {
      const match = sorted.find((a) => a.name === part);
      if (match) {
        return (
          <button
            key={index}
            className="address-link-anchor"
            onClick={() => handleLinkClick(noteId, match)}
            type="button"
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  return (
    <section className="country-gallery-section" id="travel-notes-section" aria-label="旅行记录" style={{ borderTop: "1px dashed #dbe4ee", paddingTop: "40px", marginTop: "40px" }}>
      <div className="country-gallery-title">
        <h2>
          旅行记录·<span className="major-title-en">Travel Notes</span>·<span className="major-title-number">{notes.length}</span>
        </h2>
        {canEdit && (
          <button
            className="country-gallery-toggle active"
            onClick={() => setIsAddingNote(true)}
            type="button"
            style={{ padding: "8px 18px", borderRadius: "999px", background: "linear-gradient(135deg, #c69b55, #b8863b)", color: "#fff", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} /> 写新记录
          </button>
        )}
      </div>

      <div className="travel-notes-grid">
        {notes.map((note) => {
          const isExpanded = expandedNoteId === note.id;
          return (
            <div
              id={`travel-note-card-${note.id}`}
              key={note.id}
              className={`travel-note-card ${isExpanded ? "expanded" : ""} ${draggedCardId === note.id ? "dragging" : ""} ${dragOverCardId === note.id ? "drag-over" : ""}`}
              draggable={!!session && !isExpanded}
              onDragStart={(e) => handleCardDragStart(e, note.id)}
              onDragOver={(e) => handleCardDragOver(e, note.id)}
              onDragLeave={handleCardDragLeave}
              onDrop={(e) => handleCardDrop(e, note.id)}
              onDragEnd={handleCardDragEnd}
              onClick={() => {
                if (!isExpanded) {
                  setExpandedNoteId(note.id);
                }
              }}
            >
              <div 
                className="note-card-banner"
                onClick={(e) => {
                  if (isExpanded) {
                    e.stopPropagation();
                    setExpandedNoteId(null);
                  }
                }}
                style={{ cursor: isExpanded ? "pointer" : "default" }}
                title={isExpanded ? "点击收起此旅行记录" : undefined}
              >
                <img src={note.coverImage} alt={note.city}
                  style={note.coverImagePosition ? { objectPosition: `${note.coverImagePosition.x}% ${note.coverImagePosition.y}%` } : undefined} />
                <div className="note-card-meta">
                  <span className="note-meta-date">
                    <Calendar size={12} /> {note.startDate} 至 {note.endDate}
                  </span>
                  <span className="note-meta-rating">
                    <Star size={12} fill="var(--prophet-gold)" color="var(--prophet-gold)" /> {note.rating}/10
                  </span>
                </div>
                {canEdit && (
                  <div className="note-card-actions">
                    <button onClick={(e) => handleEdit(note, e)} type="button" title="编辑">
                      <Pencil size={14} />
                    </button>
                    <button onClick={(e) => handleDelete(note.id, e)} type="button" title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="note-card-body">
                <h3>{note.city}</h3>
                <p className="note-card-summary">{note.summary}</p>
                {(() => {
                  const stats = getNoteStats(note);
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", borderTop: "1px dashed rgba(200, 200, 200, 0.2)", paddingTop: "8px" }}>
                      <span className="note-card-stats">
                        📷 {stats.photoCount} Photos &nbsp;·&nbsp; ✍️ {stats.wordCount} Words
                      </span>
                      <span className="note-card-author">Author: {note.author || note.coverImagePosition?.author || "Xiao"}</span>
                    </div>
                  );
                })()}

                {isExpanded && (
                  <div className="expanded-note-layout">
                    {/* 地图列 */}
                    <div className="note-map-wrapper">
                      <div style={{ position: "relative" }}>
                        <div id={`note-map-${note.id}`} className="note-map-container" />
                        <button
                          onClick={() => {
                            // 重置时清除挂起地点，防止切换后 initMap 被劫持为单点聚焦
                            pendingZoomAddress.current = null;
                            if (activeDayFilter === null) {
                              const map = mapInstances.current[note.id];
                              const valid = note.addresses.filter((a) => a.coordinates && a.coordinates.lat && a.coordinates.lng);
                              if (map && valid.length > 0) {
                                map.invalidateSize({ animate: false });
                                requestAnimationFrame(() => {
                                  const bounds = L.latLngBounds(valid.map((a) => {
                                    const coords = adjustCoords(a.coordinates, mapTileSource);
                                    return [coords.lat, coords.lng];
                                  }));
                                  map.fitBounds(bounds, { paddingTopLeft: [50, 50], paddingBottomRight: [120, 50], animate: true, duration: 1.0 });
                                });
                              }
                            } else {
                              setActiveDayFilter(null);
                            }
                          }}
                          className="map-reset-view-btn"
                          type="button"
                          title="显示全部路线"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <div className="map-legend">
                          {(() => {
                            const days = [...new Set(note.addresses.map((a) => a.day || 1))].sort((a, b) => a - b);
                            const dayColors = {
                              1: "#3b82f6", 2: "#ec4899", 3: "#10b981", 4: "#f59e0b", 5: "#8b5cf6", 6: "#ef4444", 7: "#06b6d4"
                            };
                            return days.map((d) => (
                              <div
                                key={d}
                                className={`legend-item ${activeDayFilter === d ? "active" : ""}`}
                                onClick={() => setActiveDayFilter(d)}
                                title={`点击筛选 Day ${d}`}
                              >
                                <span className="legend-line" style={{ backgroundColor: dayColors[d] || "#64748b" }} />
                                Day {d}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                      <div className="map-instruction">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapIcon size={14} /> 点击右侧攻略中的地址，地图将自动飞跃定位
                        </div>
                        {(() => {
                          const domestic = isNoteDomestic(note);
                          return (
                            <div className="map-source-switch-container">
                              <span className="switch-label">地图选择：</span>
                              <button
                                onClick={() => setMapTileSource("direct")}
                                className={`map-source-switch-btn ${mapTileSource === "direct" ? "active" : ""}`}
                                disabled={domestic}
                                type="button"
                                title={domestic ? "国内行程默认使用中文地图，无需使用原生地图" : "全球高清街道图，显示英文与本地语言"}
                              >
                                Esri地图
                              </button>
                              <button
                                onClick={() => setMapTileSource("amap")}
                                className={`map-source-switch-btn ${mapTileSource === "amap" ? "active" : ""}`}
                                disabled={!domestic}
                                type="button"
                                title={!domestic ? "国外高比例尺下无街道详情，仅限国内行程使用" : "高精中文地图，带有火星坐标纠错"}
                              >
                                高德地图
                              </button>
                              <button
                                onClick={() => setMapTileSource("tianditu")}
                                className={`map-source-switch-btn ${mapTileSource === "tianditu" ? "active" : ""}`}
                                disabled={!domestic}
                                type="button"
                                title={!domestic ? "国家地理信息服务平台，国外缩放度受限，仅限国内行程使用" : "天地图官方数据，全球中文标注，无偏展示"}
                              >
                                天地图
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 内容列 */}
                    <div className="note-article-wrapper">
                      <div className="note-article-content">
                        {(() => {
                          const days = [...new Set(note.addresses.map((a) => a.day || 1))].sort((a, b) => a - b);
                          return days.map((dayNum) => {
                            const dayAddrs = note.addresses.filter((a) => (a.day || 1) === dayNum);
                            return (
                              <div key={`day-group-${dayNum}`} className="day-notes-group">
                                <button
                                  onClick={() => handleDayRouteClick(note.id, dayNum)}
                                  className="day-group-header-btn"
                                  type="button"
                                >
                                  <span><Calendar size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} /> Day {dayNum} 路线定位</span>
                                  <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>点击缩放此路线 ({dayAddrs.length} 个地点)</span>
                                </button>
                                <div className="day-group-addresses">
                                  {dayAddrs.map((addr) => (
                                    <div key={addr.id} className="address-note-block">
                                      <div className="address-title">
                                        <MapPin size={14} color="#c69b55" />
                                        <button
                                          onClick={() => handleLinkClick(note.id, addr)}
                                          className="address-name-btn"
                                          type="button"
                                        >
                                          {addr.name}
                                        </button>
                                      </div>
                                      <p className="address-text">
                                        {renderTextWithLinks(note.id, addr.text, note.addresses)}
                                      </p>
                                      {renderAddressPhotos(addr, note.addresses.findIndex(a => a.id === addr.id), false, null, (url) => setActiveZoomPhoto(url))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="note-article-footer">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedNoteId(null);
                          }}
                          className="close-expanded-btn-bottom"
                          type="button"
                        >
                          收起记录
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(isAddingNote || editingNote) && (
        <TravelNoteEditDialog
          note={editingNote || { id: `note-${Date.now()}`, city: "", coverImage: "", coverImagePosition: { x: 50, y: 50 }, startDate: "", endDate: "", rating: 10, summary: "", center: [48.8566, 2.3522], addresses: [] }}
          onClose={() => {
            setIsAddingNote(false);
            setEditingNote(null);
          }}
          onSave={handleSaveNote}
        />
      )}

      {activeZoomPhoto && (
        <div className="lightbox-overlay" onClick={() => setActiveZoomPhoto(null)}>
          <button className="lightbox-close" onClick={() => setActiveZoomPhoto(null)}>✕</button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={activeZoomPhoto} alt="Enlarged view" />
          </div>
        </div>
      )}
    </section>
  );
}


// -------------------------------------------------------------
// 添加/编辑旅行记录弹窗组件（双栏布局 + 内嵌地图 v2）
// -------------------------------------------------------------
function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="star-rating-row">
      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${n <= (hovered || value) ? "filled" : ""}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n}星`}
        >
          ★
        </button>
      ))}
      <span className="star-rating-label">{value} / 10</span>
    </div>
  );
}

// 封面图拖拽定位器
// 卡片 banner 高 200px，宽跟随卡片，约 ~340px → 约 17:10 比例
// 我们在编辑器里用 400px × 235px 作为裁剪框
const CROP_W = 400, CROP_H = 235; // 和卡片实际比例匹配

function CoverImagePositioner({ src, position, onChange }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // position: {x: 0-100, y: 0-100} (matches object-position)
  const { x, y } = position;

  const onImgLoad = (e) => {
    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
  };

  // compute the rendered image size inside the CROP_W×CROP_H box using cover
  const getRenderedSize = () => {
    const { w, h } = imgSize;
    if (!w || !h) return { rw: CROP_W, rh: CROP_H };
    const scaleX = CROP_W / w, scaleY = CROP_H / h;
    const scale = Math.max(scaleX, scaleY);
    return { rw: w * scale, rh: h * scale };
  };

  const { rw, rh } = getRenderedSize();
  // object-position in pixels
  const imgOffsetX = -((x / 100) * (rw - CROP_W));
  const imgOffsetY = -((y / 100) * (rh - CROP_H));

  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPx: x, startPy: y };
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const maxDx = rw - CROP_W, maxDy = rh - CROP_H;
      const newPx = maxDx > 0 ? Math.max(0, Math.min(100, dragRef.current.startPx - (dx / maxDx * 100))) : 50;
      const newPy = maxDy > 0 ? Math.max(0, Math.min(100, dragRef.current.startPy - (dy / maxDy * 100))) : 50;
      onChange({ x: Math.round(newPx), y: Math.round(newPy) });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="cover-positioner-wrap">
      <div
        ref={containerRef}
        className="cover-positioner-box"
        style={{ width: CROP_W, height: CROP_H }}
        onMouseDown={onMouseDown}
        title="拖拽图片，调整卡片上的显示区域"
      >
        <img
          ref={imgRef}
          src={src}
          alt="封面"
          onLoad={onImgLoad}
          draggable={false}
          style={{
            position: "absolute",
            width: rw || "100%",
            height: rh || "100%",
            left: imgOffsetX,
            top: imgOffsetY,
            userSelect: "none",
            cursor: "grab",
          }}
        />
        {/* 4角标记 */}
        <div className="cover-crop-corner tl" />
        <div className="cover-crop-corner tr" />
        <div className="cover-crop-corner bl" />
        <div className="cover-crop-corner br" />
        <div className="cover-crop-label">卡片显示区域（可拖拽调整）</div>
      </div>
      <div className="cover-positioner-hint">↔ 左右拖拽 &nbsp;·&nbsp; ↕ 上下拖拽，调整图片在卡片上的显示位置</div>
    </div>
  );
}

function TravelNoteEditDialog({ note, onClose, onSave }) {
  const [editingNote, setEditingNote] = useState(() => {
    const cloned = JSON.parse(JSON.stringify(note));
    return {
      ...cloned,
      author: cloned.author || cloned.coverImagePosition?.author || "Xiao",
      coverImagePosition: cloned.coverImagePosition || { x: 50, y: 50 },
      // Initialize address.photos list. If the address has a single image but no photos, convert it.
      addresses: (cloned.addresses || []).map((a) => ({
        ...a,
        photos: a.photos || (a.image ? [{ id: `ph-init-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, url: a.image, ratio: "4:3" }] : [])
      }))
    };
  });
  const [searchingIndex, setSearchingIndex] = useState(null);
  const [mapPickingIdx, setMapPickingIdx] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const [draggedPhotoId, setDraggedPhotoId] = useState(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState(null);

  const draggedPhotoRef = useRef(null);

  const handlePhotoDragStart = (addrIdx, photo) => {
    draggedPhotoRef.current = { addrIdx, photo };
    setDraggedPhotoId(photo.id);
  };

  const handlePhotoDragOver = (e, addrIdx, targetPhoto) => {
    const dragged = draggedPhotoRef.current;
    if (dragged && dragged.addrIdx === addrIdx && dragged.photo.ratio === targetPhoto.ratio) {
      e.preventDefault();
      if (dragOverPhotoId !== targetPhoto.id) {
        setDragOverPhotoId(targetPhoto.id);
      }
    }
  };

  const handlePhotoDragLeave = () => {
    setDragOverPhotoId(null);
  };

  const handlePhotoDragEnd = () => {
    draggedPhotoRef.current = null;
    setDraggedPhotoId(null);
    setDragOverPhotoId(null);
  };

  const handlePhotoDrop = (addrIdx, targetPhoto) => {
    const dragged = draggedPhotoRef.current;
    if (dragged && dragged.addrIdx === addrIdx && dragged.photo.ratio === targetPhoto.ratio) {
      if (dragged.photo.id === targetPhoto.id) {
        setDraggedPhotoId(null);
        setDragOverPhotoId(null);
        return;
      }
      setEditingNote((prev) => {
        const updatedAddrs = [...prev.addresses];
        const photos = [...(updatedAddrs[addrIdx].photos || [])];
        const draggedIndex = photos.findIndex((p) => p.id === dragged.photo.id);
        const targetIndex = photos.findIndex((p) => p.id === targetPhoto.id);
        if (draggedIndex > -1 && targetIndex > -1) {
          const [moved] = photos.splice(draggedIndex, 1);
          photos.splice(targetIndex, 0, moved);
        }
        updatedAddrs[addrIdx] = {
          ...updatedAddrs[addrIdx],
          photos
        };
        return { ...prev, addresses: updatedAddrs };
      });
    }
    draggedPhotoRef.current = null;
    setDraggedPhotoId(null);
    setDragOverPhotoId(null);
  };

  const hasNewImages = useMemo(() => {
    if (editingNote.coverImage && editingNote.coverImage.startsWith("data:")) {
      return true;
    }
    return (editingNote.addresses || []).some((addr) =>
      (addr.photos || []).some((photo) =>
        (photo.dataUrl && photo.dataUrl.startsWith("data:")) ||
        (photo.url && photo.url.startsWith("data:"))
      )
    );
  }, [editingNote]);

  // 地图 refs
  const editMapRef = useRef(null);
  const editMapInstance = useRef(null);
  const editMarkersRef = useRef({});
  const editTileRef = useRef(null);
  const mapPickingIdxRef = useRef(null);
  const handleUpdateRef = useRef(null);

  const adjustHeight = (el) => {
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  };

  const handleFieldChange = (field, val) => {
    setEditingNote((prev) => ({ ...prev, [field]: val }));
  };

  const handleUpdateAddressField = (idx, field, val) => {
    setEditingNote((prev) => {
      const updated = [...prev.addresses];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, addresses: updated };
    });
  };

  useEffect(() => { handleUpdateRef.current = handleUpdateAddressField; });
  useEffect(() => { mapPickingIdxRef.current = mapPickingIdx; }, [mapPickingIdx]);

  // ── Drag and Drop Reordering ──
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;
    setEditingNote((prev) => {
      const addresses = [...prev.addresses];
      const [movedItem] = addresses.splice(draggedIdx, 1);
      addresses.splice(targetIndex, 0, movedItem);
      return { ...prev, addresses };
    });
    setDraggedIdx(null);
  };

  const moveAddress = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= editingNote.addresses.length) return;
    setEditingNote((prev) => {
      const addresses = [...prev.addresses];
      const [movedItem] = addresses.splice(index, 1);
      addresses.splice(targetIndex, 0, movedItem);
      return { ...prev, addresses };
    });
  };

  const handleAddAddress = () => {
    setEditingNote((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses,
        { id: `addr-${Date.now()}-${prev.addresses.length}`, day: 1, name: "", coordinates: { lat: 0, lng: 0 }, text: "", photos: [] }
      ]
    }));
  };

  const handleRemoveAddress = (idx) => {
    setEditingNote((prev) => ({ ...prev, addresses: prev.addresses.filter((_, i) => i !== idx) }));
    if (mapPickingIdx === idx) setMapPickingIdx(null);
  };

  const processImageUpload = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200; // 保留更高分辨率以支持裁剪
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        
        // Determine whether landscape (4:3) or portrait (3:4)
        const ratio = width >= height ? "4:3" : "3:4";
        callback(canvas.toDataURL("image/jpeg", 0.85), ratio);
      };
    };
  };

  // Add multiple photos
  const handleAddPhotos = (idx, files) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      processImageUpload(file, (dataUrl, ratio) => {
        setEditingNote((prev) => {
          const updatedAddrs = [...prev.addresses];
          const currentPhotos = [...(updatedAddrs[idx].photos || [])];
          currentPhotos.push({
            id: `ph-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            dataUrl,
            ratio
          });
          updatedAddrs[idx] = {
            ...updatedAddrs[idx],
            photos: currentPhotos
          };
          return { ...prev, addresses: updatedAddrs };
        });
      });
    });
  };

  // renderAddressPhotos has been moved to global scope

  const handleRemovePhoto = (addrIdx, photoId) => {
    setEditingNote((prev) => {
      const updatedAddrs = [...prev.addresses];
      const currentPhotos = (updatedAddrs[addrIdx].photos || []).filter((p) => p.id !== photoId);
      updatedAddrs[addrIdx] = {
        ...updatedAddrs[addrIdx],
        photos: currentPhotos
      };
      return { ...prev, addresses: updatedAddrs };
    });
  };

  // ── Day 下拉框：根据日期范围生成选项 ──
  const dayOptions = useMemo(() => {
    const { startDate, endDate } = editingNote;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diff = Math.max(1, Math.round((end - start) / 86400000) + 1);
      const opts = [];
      for (let i = 0; i < diff; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const label = `第${i+1}天 · ${d.getMonth()+1}月${d.getDate()}日`;
        opts.push({ value: i + 1, label });
      }
      return opts;
    }
    return Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `第${i+1}天` }));
  }, [editingNote.startDate, editingNote.endDate]);

  const handleGeocodeSearch = async (idx, name) => {
    if (!name) { alert("请先填写地点名称后再尝试查询！"); return; }
    setSearchingIndex(idx);
    try {
      let lat, lng;
      const cityCtx = editingNote?.city?.trim() || "";
      const q = cityCtx && !name.includes(cityCtx) ? `${cityCtx} ${name}` : name;

      try {
        const r = await fetch(`https://api.tianditu.gov.cn/geocoder?ds=${encodeURIComponent(JSON.stringify({ keyWord: q }))}&tk=${TIANDITU_KEY}`);
        const d = await r.json();
        if (d?.status === "0" && d.location) { lat = parseFloat(d.location.lat); lng = parseFloat(d.location.lon); }
      } catch (e) { console.warn("TianDiTu failed:", e); }

      if (lat === undefined) {
        try {
          const r = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(q)}&maxLocations=1`);
          const d = await r.json();
          if (d?.candidates?.length > 0) { lat = parseFloat(d.candidates[0].location.y); lng = parseFloat(d.candidates[0].location.x); }
        } catch (e) { console.warn("Esri failed:", e); }
      }

      if (lat === undefined) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
          const d = await r.json();
          if (d?.length > 0) { lat = parseFloat(d[0].lat); lng = parseFloat(d[0].lon); }
        } catch (e) { console.warn("Nominatim failed:", e); }
      }

      if (lat !== undefined && lng !== undefined) {
        handleUpdateAddressField(idx, "coordinates", { lat, lng });
        if (idx === 0) setEditingNote((prev) => ({ ...prev, center: [lat, lng] }));
      } else {
        alert("未查找到坐标，可点击「地图选点」在地图上手动标注位置。");
      }
    } catch (e) {
      console.error(e);
      alert("解析失败，请使用地图选点功能手动标注。");
    } finally {
      setSearchingIndex(null);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!editingNote.city) { alert("请填写旅行记录标题/城市名称！"); return; }
    if (editingNote.addresses.length > 0 && !editingNote.center) {
      const first = editingNote.addresses[0].coordinates;
      editingNote.center = [first.lat, first.lng];
    }
    setIsSaving(true);
    try {
      const ok = await onSave(editingNote);
      if (!ok) {
        setIsSaving(false);
      }
    } catch (err) {
      alert("保存失败：" + err.message);
      setIsSaving(false);
    }
  };

  // ── 初始化编辑器地图 ──────────────────────────────────────────
  useEffect(() => {
    if (!editMapRef.current || editMapInstance.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(editMapRef.current, { center: [30, 110], zoom: 4, zoomControl: true });

    const esriLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { attribution: "© Esri", maxZoom: 19 }
    );
    esriLayer.addTo(map);
    editTileRef.current = { type: "esri", base: esriLayer, label: null };

    map.on("click", (e) => {
      const idx = mapPickingIdxRef.current;
      if (idx === null) return;
      const { lat, lng } = e.latlng;
      handleUpdateRef.current?.(idx, "coordinates", { lat, lng });
      setMapPickingIdx(null);
    });

    editMapInstance.current = map;
    return () => {
      map.remove();
      editMapInstance.current = null;
      editMarkersRef.current = {};
      editTileRef.current = null;
    };
  }, []);

  // ── 根据坐标自动切换地图底图 ──────────────────────────────────
  useEffect(() => {
    const map = editMapInstance.current;
    if (!map) return;
    const L = window.L;
    if (!L) return;

    const isDomestic = isNoteDomestic(editingNote);
    const current = editTileRef.current;
    if (!current) return;

    if (isDomestic && current.type !== "tdt") {
      if (current.base) map.removeLayer(current.base);
      if (current.label) map.removeLayer(current.label);
      const tdtBase = L.tileLayer(
        `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
        { subdomains: "01234567", maxZoom: 18, attribution: "© 天地图" }
      ).addTo(map);
      const tdtLabel = L.tileLayer(
        `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_KEY}`,
        { subdomains: "01234567", maxZoom: 18 }
      ).addTo(map);
      editTileRef.current = { type: "tdt", base: tdtBase, label: tdtLabel };
    } else if (!isDomestic && current.type !== "esri") {
      if (current.base) map.removeLayer(current.base);
      if (current.label) map.removeLayer(current.label);
      const esriLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri", maxZoom: 19 }
      ).addTo(map);
      editTileRef.current = { type: "esri", base: esriLayer, label: null };
    }
  }, [editingNote.addresses, editingNote.center]);

  // ── 同步地图标记 ──────────────────────────────────────────────
  useEffect(() => {
    const map = editMapInstance.current;
    if (!map) return;
    const L = window.L;
    if (!L) return;

    Object.values(editMarkersRef.current).forEach((m) => map.removeLayer(m));
    editMarkersRef.current = {};
    const validCoords = [];

    editingNote.addresses.forEach((addr, idx) => {
      const { lat, lng } = addr.coordinates || {};
      if (Math.abs(lat || 0) < 0.001 && Math.abs(lng || 0) < 0.001) return;

      const isPicking = mapPickingIdx === idx;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;background:${isPicking ? "#3b82f6" : "#c69b55"};border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:grab;">${idx + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon });
      marker.bindTooltip(addr.name || `足迹点 #${idx + 1}`, { direction: "top", offset: [0, -14] });
      marker.on("dragend", (ev) => {
        const pos = ev.target.getLatLng();
        handleUpdateRef.current?.(idx, "coordinates", { lat: pos.lat, lng: pos.lng });
      });
      marker.addTo(map);
      editMarkersRef.current[idx] = marker;
      validCoords.push([lat, lng]);
    });

    if (validCoords.length === 1) map.setView(validCoords[0], 13);
    else if (validCoords.length > 1) map.fitBounds(validCoords, { padding: [32, 32] });
  }, [editingNote.addresses, mapPickingIdx]);

  useEffect(() => {
    const map = editMapInstance.current;
    if (!map) return;
    map.getContainer().style.cursor = mapPickingIdx !== null ? "crosshair" : "";
  }, [mapPickingIdx]);

  return (
    <div className="travel-edit-dialog-overlay">
      <div className="travel-edit-dialog-wide" onClick={(e) => e.stopPropagation()}>

        {/* ── 顶部标题栏（全新精美设计） ── */}
        <div className="tned-header">
          <div className="tned-header-title">
            <div className="tned-header-badge">
              <span className="tned-badge-icon">✈️</span>
              <span className="tned-badge-text">Travel Map Editor</span>
            </div>
            <h2>旅行记录编辑器</h2>
            {editingNote.city && <p className="tned-subtitle">当前编辑城市：{editingNote.city}</p>}
          </div>
          <button onClick={onClose} className="tned-close-btn" type="button" disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        {/* ── 主体 ── */}
        <div className="tned-body">

          {/* ── 左栏：表单 ── */}
          <form onSubmit={handleFormSubmit} className="tned-left">

            {/* 基本信息 */}
            <div className="tned-section">
              <div className="tned-section-label">
                <span className="tned-section-lbl-icon">📝</span> 基本信息
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>旅行记录标题 / 城市 *</label>
                  <input type="text" value={editingNote.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    placeholder="例如：武汉" required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>作者</label>
                  <select
                    value={editingNote.author || "Xiao"}
                    onChange={(e) => handleFieldChange("author", e.target.value)}
                    className="author-select"
                  >
                    <option value="Xiao">Xiao</option>
                    <option value="Tang">Tang</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>开始日期</label>
                  <input type="date" value={editingNote.startDate}
                    onChange={(e) => handleFieldChange("startDate", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>截止日期</label>
                  <input type="date" value={editingNote.endDate}
                    onChange={(e) => handleFieldChange("endDate", e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>评分</label>
                <StarRating
                  value={editingNote.rating || 10}
                  onChange={(v) => handleFieldChange("rating", v)}
                />
              </div>

              <div className="form-group">
                <label>简短概览描述</label>
                <textarea value={editingNote.summary}
                  onChange={(e) => { handleFieldChange("summary", e.target.value); adjustHeight(e.target); }}
                  ref={adjustHeight} placeholder="一两句话描述这次旅行..." rows={2} />
              </div>
            </div>

            {/* 封面图 */}
            <div className="tned-section">
              <div className="tned-section-label">
                <span className="tned-section-lbl-icon">🖼️</span> 卡片封面图
              </div>
              <div className="form-group">
                <label>选择图片（上传后可拖拽调整裁剪位置）</label>
                <label className="file-upload-btn">
                  📷 选择图片
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => {
                      processImageUpload(e.target.files[0], (d) => {
                        handleFieldChange("coverImage", d);
                        handleFieldChange("coverImagePosition", { x: 50, y: 50 });
                      });
                    }} />
                </label>
              </div>
              {editingNote.coverImage ? (
                <CoverImagePositioner
                  src={editingNote.coverImage}
                  position={editingNote.coverImagePosition || { x: 50, y: 50 }}
                  onChange={(pos) => handleFieldChange("coverImagePosition", pos)}
                />
              ) : (
                <div className="tned-empty-hint" style={{ marginTop: 8 }}>
                  暂未上传封面图。上传后可拖拽调整图片在卡片上的显示位置。
                </div>
              )}
            </div>

            {/* 足迹点列表 */}
            <div className="tned-section">
              <div className="tned-section-label tned-section-row">
                <span>
                  <span className="tned-section-lbl-icon">📍</span> 足迹点轨迹列表
                </span>
                <button onClick={handleAddAddress} className="add-address-btn" type="button">+ 新增足迹点</button>
              </div>

              {editingNote.addresses.length === 0 && (
                <div className="tned-empty-hint">
                  暂无足迹点。点击上方「+ 新增足迹点」，或在右侧地图上点击「地图选点」直接标注。
                </div>
              )}

              {editingNote.addresses.map((addr, idx) => (
                <div
                  key={addr.id}
                  className={`address-edit-card ${mapPickingIdx === idx ? "addr-card-picking" : ""}`}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                >
                  <div className="address-card-header">
                    <div className="address-card-header-left">
                      <span
                        className="drag-handle"
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragEnd={() => setDraggedIdx(null)}
                        title="按住拖拽排序"
                      >
                        ⠿
                      </span>
                      <span className="addr-card-num">📍 足迹点 #{idx + 1}</span>
                    </div>
                    <div className="address-card-actions">
                      <button
                        type="button"
                        className="reorder-btn"
                        disabled={idx === 0}
                        onClick={() => moveAddress(idx, -1)}
                        title="上移"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="reorder-btn"
                        disabled={idx === editingNote.addresses.length - 1}
                        onClick={() => moveAddress(idx, 1)}
                        title="下移"
                      >
                        ↓
                      </button>
                      <button onClick={() => handleRemoveAddress(idx)} className="remove-address-btn" type="button">删除</button>
                    </div>
                  </div>

                  {/* 天数 + 地点名称 */}
                  <div className="form-row">
                    <div className="form-group" style={{ flex: "0 0 130px" }}>
                      <label>Day</label>
                      <select value={addr.day || 1}
                        onChange={(e) => handleUpdateAddressField(idx, "day", parseInt(e.target.value) || 1)}
                        className="day-select">
                        {dayOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>地点名称</label>
                      <input type="text" value={addr.name}
                        onChange={(e) => handleUpdateAddressField(idx, "name", e.target.value)}
                        placeholder="例如：光谷广场" />
                    </div>
                  </div>

                  {/* 坐标 + 操作按钮 */}
                  <div className="addr-coords-block">
                    <div className="addr-coords-inputs">
                      <div className="form-group">
                        <label>纬度 (Lat)</label>
                        <input type="number" step="any" value={addr.coordinates.lat}
                          onChange={(e) => handleUpdateAddressField(idx, "coordinates", { ...addr.coordinates, lat: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="form-group">
                        <label>经度 (Lng)</label>
                        <input type="number" step="any" value={addr.coordinates.lng}
                          onChange={(e) => handleUpdateAddressField(idx, "coordinates", { ...addr.coordinates, lng: parseFloat(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="addr-action-btns">
                      <button onClick={() => handleGeocodeSearch(idx, addr.name)} className="coords-lookup-btn"
                        type="button" disabled={searchingIndex === idx}>
                        {searchingIndex === idx ? "解析中…" : "🔍 解析坐标"}
                      </button>
                      <button
                        onClick={() => setMapPickingIdx(mapPickingIdx === idx ? null : idx)}
                        className={`map-pick-btn ${mapPickingIdx === idx ? "active" : ""}`}
                        type="button">
                        {mapPickingIdx === idx ? "✕ 取消" : "📍 地图选点"}
                      </button>
                    </div>
                  </div>

                  {/* 攻略文字 */}
                  <div className="form-group">
                    <label>攻略 / 旅行日记</label>
                    <textarea value={addr.text}
                      onChange={(e) => { handleUpdateAddressField(idx, "text", e.target.value); adjustHeight(e.target); }}
                      ref={adjustHeight} placeholder="在这里记录足迹点的攻略和旅行日记..." rows={3} />
                  </div>

                  {/* 多图配图上传 */}
                  <div className="form-group">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>点位配图（可添加多张）</span>
                      {addr.photos && addr.photos.length > 0 && (
                        <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                          已添加 {addr.photos.length} 张图片
                        </span>
                      )}
                    </label>
                    <label className="file-upload-btn file-upload-btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                      🖼 添加图片
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => handleAddPhotos(idx, e.target.files)}
                      />
                    </label>

                    {renderAddressPhotos(
                      addr,
                      idx,
                      true,
                      handleRemovePhoto,
                      null,
                      handlePhotoDragStart,
                      handlePhotoDragOver,
                      handlePhotoDrop,
                      draggedPhotoId,
                      dragOverPhotoId,
                      handlePhotoDragEnd,
                      handlePhotoDragLeave
                    )}
                  </div>

                </div>
              ))}

              {editingNote.addresses.length > 0 && (
                <button onClick={handleAddAddress} className="add-address-btn add-address-btn-bottom" type="button">
                  + 继续新增足迹点
                </button>
              )}
            </div>

            <div className="dialog-footer">
              <button onClick={onClose} className="cancel-btn" type="button" disabled={isSaving}>取消</button>
              <button type="submit" className="save-btn" disabled={isSaving}>
                {isSaving ? (hasNewImages ? "正在上传图片并保存..." : "正在保存...") : "保存旅行记录"}
              </button>
            </div>
          </form>

          {/* ── 右栏：地图 ── */}
          <div className="tned-right">
            {mapPickingIdx !== null && (
              <div className="tned-pick-banner">
                <span>📍 请在地图上点击，为「足迹点 #{mapPickingIdx + 1}{editingNote.addresses[mapPickingIdx]?.name ? " · " + editingNote.addresses[mapPickingIdx].name : ""}」标注位置</span>
                <button onClick={() => setMapPickingIdx(null)} type="button">取消</button>
              </div>
            )}
            <div ref={editMapRef} className="tned-map-container" />
            <div className="tned-map-hint">
              🖱️ 拖拽编号标记可微调坐标 &nbsp;·&nbsp; 国内城市自动切换天地图 &nbsp;·&nbsp; 点击「地图选点」手动标注
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const renderAddressPhotos = (
  addr,
  idx,
  isEditMode = false,
  onRemovePhoto = null,
  onPhotoClick = null,
  onPhotoDragStart = null,
  onPhotoDragOver = null,
  onPhotoDrop = null,
  draggedPhotoId = null,
  dragOverPhotoId = null,
  onPhotoDragEnd = null,
  onPhotoDragLeave = null
) => {
  if (!addr.photos || addr.photos.length === 0) {
    if (!isEditMode && addr.image) {
      return (
        <div className="address-image-container">
          <img src={addr.image} alt={addr.name} onClick={() => { if (onPhotoClick) onPhotoClick(addr.image); else window.open(addr.image, "_blank"); }} style={{ cursor: "zoom-in" }} />
        </div>
      );
    }
    return null;
  }

  const landscapes = addr.photos.filter(p => (p.ratio || "4:3") === "4:3");
  const portraits = addr.photos.filter(p => p.ratio === "3:4");

  if (landscapes.length === 1 && portraits.length === 1) {
    // 规则 1：当仅有一个 4:3 和一个 3:4 时，并排占满一行
    const phL = landscapes[0];
    const phP = portraits[0];
    return (
      <div className="address-photos-wrapper" style={{ marginTop: isEditMode ? 8 : 0 }}>
        <div className="footpoint-photo-grid layout-mixed-one-each">
          <div 
            className={`footpoint-photo-item item-4-3 ${phL.id === draggedPhotoId ? "dragging" : ""} ${phL.id === dragOverPhotoId ? "drag-over" : ""}`}
            draggable={isEditMode}
            onDragStart={isEditMode && onPhotoDragStart ? (e) => onPhotoDragStart(idx, phL) : undefined}
            onDragOver={isEditMode && onPhotoDragOver ? (e) => onPhotoDragOver(e, idx, phL) : undefined}
            onDrop={isEditMode && onPhotoDrop ? (e) => onPhotoDrop(idx, phL) : undefined}
            onDragEnd={isEditMode && onPhotoDragEnd ? onPhotoDragEnd : undefined}
            onDragLeave={isEditMode && onPhotoDragLeave ? onPhotoDragLeave : undefined}
          >
            <img src={phL.url || phL.dataUrl} alt="" onClick={!isEditMode ? () => { if (onPhotoClick) onPhotoClick(phL.url || phL.dataUrl); else window.open(phL.url || phL.dataUrl, "_blank"); } : undefined} style={{ cursor: !isEditMode ? "zoom-in" : "grab" }} />
            {isEditMode && onRemovePhoto && (
              <button type="button" className="photo-remove-btn" onClick={() => onRemovePhoto(idx, phL.id)}>✕</button>
            )}
          </div>
          <div 
            className={`footpoint-photo-item item-3-4 ${phP.id === draggedPhotoId ? "dragging" : ""} ${phP.id === dragOverPhotoId ? "drag-over" : ""}`}
            draggable={isEditMode}
            onDragStart={isEditMode && onPhotoDragStart ? (e) => onPhotoDragStart(idx, phP) : undefined}
            onDragOver={isEditMode && onPhotoDragOver ? (e) => onPhotoDragOver(e, idx, phP) : undefined}
            onDrop={isEditMode && onPhotoDrop ? (e) => onPhotoDrop(idx, phP) : undefined}
            onDragEnd={isEditMode && onPhotoDragEnd ? onPhotoDragEnd : undefined}
            onDragLeave={isEditMode && onPhotoDragLeave ? onPhotoDragLeave : undefined}
          >
            <img src={phP.url || phP.dataUrl} alt="" onClick={!isEditMode ? () => { if (onPhotoClick) onPhotoClick(phP.url || phP.dataUrl); else window.open(phP.url || phP.dataUrl, "_blank"); } : undefined} style={{ cursor: !isEditMode ? "zoom-in" : "grab" }} />
            {isEditMode && onRemovePhoto && (
              <button type="button" className="photo-remove-btn" onClick={() => onRemovePhoto(idx, phP.id)}>✕</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 规则 2：如果最后只剩下两个 3:4，占满横向
  const isPortraitStretch = (portraits.length % 3 === 2);

  return (
    <div className="address-photos-wrapper" style={{ marginTop: isEditMode ? 8 : 0 }}>
      {landscapes.length > 0 && (
        <div className="footpoint-photo-grid layout-landscape">
          {landscapes.map((ph, pIdx) => (
            <div 
              key={ph.id || `l-${pIdx}`} 
              className={`footpoint-photo-item ${ph.id === draggedPhotoId ? "dragging" : ""} ${ph.id === dragOverPhotoId ? "drag-over" : ""}`}
              draggable={isEditMode}
              onDragStart={isEditMode && onPhotoDragStart ? (e) => onPhotoDragStart(idx, ph) : undefined}
              onDragOver={isEditMode && onPhotoDragOver ? (e) => onPhotoDragOver(e, idx, ph) : undefined}
              onDrop={isEditMode && onPhotoDrop ? (e) => onPhotoDrop(idx, ph) : undefined}
              onDragEnd={isEditMode && onPhotoDragEnd ? onPhotoDragEnd : undefined}
              onDragLeave={isEditMode && onPhotoDragLeave ? onPhotoDragLeave : undefined}
            >
              <img src={ph.url || ph.dataUrl} alt="" onClick={!isEditMode ? () => { if (onPhotoClick) onPhotoClick(ph.url || ph.dataUrl); else window.open(ph.url || ph.dataUrl, "_blank"); } : undefined} style={{ cursor: !isEditMode ? "zoom-in" : "grab" }} />
              {isEditMode && onRemovePhoto && (
                <button type="button" className="photo-remove-btn" onClick={() => onRemovePhoto(idx, ph.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      {portraits.length > 0 && (
        <div className="footpoint-photo-grid layout-portrait" style={{ marginTop: landscapes.length > 0 ? "10px" : "0" }}>
          {portraits.map((ph, pIdx) => {
            const isLastTwo = isPortraitStretch && (pIdx >= portraits.length - 2);
            return (
              <div 
                key={ph.id || `p-${pIdx}`} 
                className={`footpoint-photo-item ${isLastTwo ? "portrait-stretch-50" : ""} ${ph.id === draggedPhotoId ? "dragging" : ""} ${ph.id === dragOverPhotoId ? "drag-over" : ""}`}
                draggable={isEditMode}
                onDragStart={isEditMode && onPhotoDragStart ? (e) => onPhotoDragStart(idx, ph) : undefined}
                onDragOver={isEditMode && onPhotoDragOver ? (e) => onPhotoDragOver(e, idx, ph) : undefined}
                onDrop={isEditMode && onPhotoDrop ? (e) => onPhotoDrop(idx, ph) : undefined}
                onDragEnd={isEditMode && onPhotoDragEnd ? onPhotoDragEnd : undefined}
                onDragLeave={isEditMode && onPhotoDragLeave ? onPhotoDragLeave : undefined}
              >
                <img src={ph.url || ph.dataUrl} alt="" onClick={!isEditMode ? () => { if (onPhotoClick) onPhotoClick(ph.url || ph.dataUrl); else window.open(ph.url || ph.dataUrl, "_blank"); } : undefined} style={{ cursor: !isEditMode ? "zoom-in" : "grab" }} />
                {isEditMode && onRemovePhoto && (
                  <button type="button" className="photo-remove-btn" onClick={() => onRemovePhoto(idx, ph.id)}>✕</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getNoteStats = (note) => {
  let photoCount = 0;
  let wordCount = 0;
  
  (note.addresses || []).forEach((addr) => {
    if (addr.photos && addr.photos.length > 0) {
      photoCount += addr.photos.length;
    } else if (addr.image) {
      photoCount += 1;
    }
    
    const text = addr.text || "";
    if (text.trim()) {
      const cnMatches = text.match(/[\u4e00-\u9fa5]/g);
      const cnCount = cnMatches ? cnMatches.length : 0;
      
      const nonCnText = text.replace(/[\u4e00-\u9fa5]/g, " ");
      const enWords = nonCnText.trim().split(/\s+/).filter(w => w.length > 0);
      const enCount = enWords.length;
      
      wordCount += (cnCount + enCount);
    }
  });
  
  return { photoCount, wordCount };
};

export default App;
