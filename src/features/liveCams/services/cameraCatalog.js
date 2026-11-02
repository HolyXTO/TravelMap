// -*- coding: utf-8 -*-
/**
 * cameraCatalog.js
 * 
 * 全球实时摄像头数据接入层：
 * 载入 OSIRIS 与全球公开交通/城市数据源（共 2,000+ 个实时探头），
 * 涵盖欧洲、亚洲、北美洲、南美洲、非洲、大洋洲。
 * 重点支持真实 24/7 连续视频流（HLS / MP4 / Iframe 60FPS 直播），
 * 并提供大洲分类、实时视频快速筛选、关键字检索与 GeoJSON 格式转换。
 */
import rawCamerasData from "./camerasData.json";

export const CAMERA_CONTINENTS = [
  // 第一行：4 个 2 字符大洲/分类（占满第一行，每格 3/12 宽度）
  { id: "all", label: "全球", enLabel: "Global", row: 1 },
  { id: "Asia", label: "亚洲", enLabel: "Asia", row: 1 },
  { id: "Europe", label: "欧洲", enLabel: "Europe", row: 1 },
  { id: "Africa", label: "非洲", enLabel: "Africa", row: 1 },
  // 第二行：3 个 3 字符大洲（占满第二行，每格 4/12 宽度）
  { id: "North America", label: "北美洲", enLabel: "North America", row: 2 },
  { id: "South America", label: "南美洲", enLabel: "South America", row: 2 },
  { id: "Oceania", label: "大洋洲", enLabel: "Oceania", row: 2 },
];

// 大洲英文 ID 到中文名称映射
const CONTINENT_MAP = {
  Asia: "亚洲",
  Europe: "欧洲",
  "North America": "北美洲",
  "South America": "南美洲",
  Oceania: "大洋洲",
  Africa: "非洲",
};

// 官方机构与市民交通路况门户直达网址映射 (替代底层 .m3u8 切片或 /api 地址)
const OFFICIAL_PORTALS = {
  "INDOT TrafficWise": "https://511in.org",
  "Caltrans": "https://quickmap.dot.ca.gov",
  "TxDOT": "https://drivetexas.org",
  "FDOT": "https://fl511.com",
  "GDOT": "https://511ga.org",
  "UDOT": "https://udottraffic.utah.gov",
  "NCDOT": "https://drivenc.gov",
  "MDOT MiDrive": "https://mdotjboss.state.mi.us/MiDrive/map",
  "SCDOT": "https://www.511sc.org",
  "ADOT": "https://az511.com",
  "MDOT SHA CHART": "https://chart.maryland.gov",
  "Houston TranStar": "https://traffic.houstontranstar.org",
  "DelDOT": "https://deldot.gov",
  "LADOTD": "https://511la.org",
  "ODOT TripCheck": "https://tripcheck.com",
  "NDOT": "https://nvroads.com",
  "DriveBC": "https://www.drivebc.ca",
  "511 Ontario": "https://511on.ca",
  "City of Toronto": "https://www.toronto.ca",
  "City of Ottawa": "https://traffic.ottawa.ca",
  "Alberta 511": "https://511.alberta.ca",
  "City of Edmonton": "https://www.edmonton.ca",
  "TfL": "https://tfl.gov.uk/traffic/status/",
  "Autostrade per l'Italia": "https://www.autostrade.it",
  "Trafikverket": "https://www.trafikverket.se",
  "Fintraffic": "https://liikennetilanne.fintraffic.fi",
  "DGT": "https://infocar.dgt.es",
  "Via Lietuva": "https://eismoinfo.lt",
  "Live Traffic": "https://livetraffic.com",
  "HK Transport Dept": "https://www.td.gov.hk",
  "ASFINAG": "https://www.asfinag.at",
  "NZTA": "https://www.journeys.nzta.govt.nz",
  "Vegagerðin": "https://www.vegagerdin.is"
};

/**
 * 标准化单个探头对象
 */
function normalizeCamera(item) {
  let streamUrl = item.stream_url;
  let streamType = item.stream_type;
  let hasLiveVideo = Boolean(item.has_live_video);

  // 针对伦敦交通局 TfL (Transport for London) 890 处全量实时探头：
  // TfL 官方同时在 AWS S3 提供 24/7 实时更新的 mp4 视频流（与 .jpg 同目录同名）
  const isTfL =
    item.source === "TfL" ||
    item.id?.startsWith("tfl-") ||
    item.feed_url?.includes("jamcams.tfl.gov.uk");
  if (isTfL && item.feed_url) {
    if (!streamUrl) {
      streamUrl = item.feed_url.replace(/\.jpg$/i, ".mp4");
      streamType = "mp4";
      hasLiveVideo = true;
    }
  }

  // 针对中国台湾各县市交控与高公局 MJPEG 真实连续视频流 (taichung.gov.tw / ttcpb / gov.taipei / freeway / klcg)
  const isTaiwanMjpeg =
    (item.country === "中国台湾" || item.country === "台湾") &&
    (
      streamType === "mjpeg" ||
      (item.feed_url && (
        item.feed_url.includes("taichung.gov.tw") ||
        item.feed_url.includes("trafficvideo.ttcpb.gov.tw") ||
        item.feed_url.includes("gov.taipei") ||
        item.feed_url.includes("cctv.klcg.gov.tw") ||
        item.feed_url.includes("/abs2mjpg/")
      )) ||
      (item.source === "OpenCCTV / taiwan-freeway" && !item.feed_url?.includes("/snapshot"))
    );

  if (isTaiwanMjpeg) {
    streamType = "mjpeg";
    hasLiveVideo = true;
    if (!streamUrl && item.feed_url) {
      streamUrl = item.feed_url;
    }
  }

  const isVideo = Boolean(
    hasLiveVideo ||
    (streamType && ["hls", "mp4", "iframe", "mjpeg"].includes(streamType)) ||
    (streamUrl && (streamUrl.includes(".m3u8") || streamUrl.includes(".mp4")))
  );

  const finalStreamType =
    streamType ||
    (streamUrl?.includes(".m3u8")
      ? "hls"
      : streamUrl?.includes(".mp4")
      ? "mp4"
      : isTaiwanMjpeg
      ? "mjpeg"
      : "jpg");

  // 生成代表性的海报图/快照
  let posterUrl = item.feed_url;
  if (!posterUrl && item.stream_url && (item.stream_url.endsWith(".jpg") || item.stream_url.endsWith(".png"))) {
    posterUrl = item.stream_url;
  }
  if (!posterUrl) {
    posterUrl = "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop";
  }

  return {
    id: String(item.id),
    name: item.name || "全球实时探头",
    enName: item.name || "Global CCTV",
    country: item.country || "全球",
    city: item.city || "全球",
    continent: item.continent || "欧洲",
    lat: Number(item.lat),
    lng: Number(item.lng),
    category: isVideo ? "24H 实时视频流" : "道路监控快照",
    status: "online",
    source: item.source || "OSIRIS Open CCTV",
    sourceUrl:
      item.external_url ||
      OFFICIAL_PORTALS[item.source] ||
      (item.feed_url?.startsWith("http") ? item.feed_url : null) ||
      (item.stream_url?.startsWith("http") ? item.stream_url : null) ||
      "https://osirisai.live",
    hasLiveVideo: isVideo,
    media: {
      type: finalStreamType,
      url: streamUrl || item.feed_url || "",
      streamUrl: streamUrl || "",
      feedUrl: item.feed_url || "",
      embedUrl: streamUrl || "",
      posterUrl,
      refreshInterval: 4000,
      hasLiveVideo: isVideo,
    },
    description: isVideo
      ? `位于 ${item.country} ${item.city} 的 24/7 连续全天候视频流，由 ${item.source} 实时传回。`
      : `位于 ${item.country} ${item.city} 的实时监控节点，由 ${item.source} 实时更新。`,
  };
}

// 缓存全局探头列表（按照视频流优先、亚洲欧洲优先排序）
export let ALL_CAMERAS = rawCamerasData.map(normalizeCamera).sort((a, b) => {
  const aLive = a.hasLiveVideo ? 1 : 0;
  const bLive = b.hasLiveVideo ? 1 : 0;
  return bLive - aLive;
});
export const RAW_CAMERAS = ALL_CAMERAS;

let isFullDatasetLoaded = false;
let loadPromise = null;

/**
 * 异步载入 OSIRIS 45,000+ 全球全量摄像头数据集 (通过 public/data/camerasData.json)
 * 具备即时单例保障与秒级网络拉取
 */
export async function loadFullCamerasData() {
  if (isFullDatasetLoaded) {
    return ALL_CAMERAS;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/data/camerasData.json`);
      if (res.ok) {
        const fullData = await res.json();
        ALL_CAMERAS = fullData.map(normalizeCamera).sort((a, b) => {
          const aLive = a.hasLiveVideo ? 1 : 0;
          const bLive = b.hasLiveVideo ? 1 : 0;
          return bLive - aLive;
        });
        isFullDatasetLoaded = true;
        return ALL_CAMERAS;
      }
    } catch (e) {
      console.warn("[cameraCatalog] Load full cameras dataset fallback:", e);
    }
    return ALL_CAMERAS;
  })();

  return loadPromise;
}

/**
 * 复合多维筛选函数：
 * 支持大洲分类 + 视频流类型 (全部/实时流/实况快照) + 关键字模糊检索
 */
export function filterCameras({
  cameras = ALL_CAMERAS,
  continent = "all",
  onlyLive = false,
  streamFilter = "all", // 'all' | 'live' | 'snapshot'
  query = "",
} = {}) {
  let list = cameras;

  // 兼容老调用：若传入 onlyLive 或 continent === "live_video"
  let actualContinent = continent;
  let actualStreamFilter = streamFilter;
  if (continent === "live_video" || onlyLive) {
    actualStreamFilter = "live";
    if (continent === "live_video") {
      actualContinent = "all";
    }
  }

  // 1. 大洲过滤 (全球时不过滤)
  if (actualContinent && actualContinent !== "all") {
    const target = CONTINENT_MAP[actualContinent] || actualContinent;
    list = list.filter((c) => c.continent === target);
  }

  // 2. 视频流类型正交过滤 (全部 / 实时视频流 / 实况抓拍)
  if (actualStreamFilter === "live") {
    list = list.filter((c) => c.hasLiveVideo);
  } else if (actualStreamFilter === "snapshot") {
    list = list.filter((c) => !c.hasLiveVideo);
  }

  // 3. 关键字/城市/国家检索
  if (query) {
    list = searchCameras(query, list);
  }

  return list;
}

/**
 * 获取全量摄像头列表
 */
export function getAllCameras() {
  return ALL_CAMERAS;
}

/**
 * 根据大洲或类型筛选摄像头
 * @param {string} filterId 'all' | 'live_video' | 'Asia' | 'Europe' ...
 * @param {Array} cameras 摄像头列表
 */
export function getCamerasByContinent(filterId = "all", cameras = ALL_CAMERAS) {
  if (filterId === "all") {
    return cameras;
  }
  if (filterId === "live_video") {
    return cameras.filter((c) => c.hasLiveVideo);
  }
  const targetContinent = CONTINENT_MAP[filterId] || filterId;
  return cameras.filter((c) => c.continent === targetContinent);
}

// 双向中英文搜索同义词映射
const SEARCH_ALIASES = {
  france: ["法国", "france"],
  french: ["法国"],
  paris: ["巴黎", "paris"],
  uk: ["英国", "uk", "united kingdom", "england"],
  britain: ["英国", "britain"],
  london: ["伦敦", "london"],
  japan: ["日本", "japan"],
  tokyo: ["东京", "tokyo"],
  usa: ["美国", "usa", "united states", "america"],
  america: ["美国"],
  canada: ["加拿大", "canada"],
  toronto: ["多伦多", "toronto"],
  italy: ["意大利", "italy", "italia"],
  rome: ["罗马", "rome", "roma"],
  spain: ["西班牙", "spain", "españa"],
  madrid: ["马德里", "madrid"],
  barcelona: ["巴塞罗那", "barcelona"],
  germany: ["德国", "germany", "deutschland"],
  berlin: ["柏林", "berlin"],
  taiwan: ["台湾", "中国台湾", "taiwan", "taipei"],
  hongkong: ["香港", "中国香港", "hong kong"],
  "hong kong": ["香港", "中国香港", "hong kong"],
  korea: ["韩国", "korea", "seoul"],
  thailand: ["泰国", "thailand", "bangkok"],
  australia: ["澳大利亚", "australia", "sydney"],
  switzerland: ["瑞士", "switzerland"],
  austria: ["奥地利", "austria"],
  sweden: ["瑞典", "sweden"],
  norway: ["挪威", "norway"],
  finland: ["芬兰", "finland"],
  poland: ["波兰", "poland"],
  greece: ["希腊", "greece"],
  russia: ["俄罗斯", "russia"],
};

/**
 * 模糊搜索摄像头 (匹配名称、城市、国家、ID 及中英同义词)
 */
export function searchCameras(query = "", cameras = ALL_CAMERAS) {
  const q = query.trim().toLowerCase();
  if (!q) return cameras;

  // 扩展同义词匹配候选
  const aliasTerms = SEARCH_ALIASES[q] || [];
  const searchTerms = [q, ...aliasTerms];

  return cameras.filter((c) => {
    const nameLow = c.name?.toLowerCase() || "";
    const cityLow = c.city?.toLowerCase() || "";
    const countryLow = c.country?.toLowerCase() || "";
    const idLow = c.id?.toLowerCase() || "";

    return searchTerms.some(
      (term) =>
        nameLow.includes(term) ||
        cityLow.includes(term) ||
        countryLow.includes(term) ||
        idLow.includes(term)
    );
  });
}

/**
 * 将摄像头数组转为 MapLibre GeoJSON FeatureCollection
 */
export function camerasToGeoJSON(cameras = ALL_CAMERAS) {
  return {
    type: "FeatureCollection",
    features: cameras.map((c) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [c.lng, c.lat],
      },
      properties: {
        id: c.id,
        name: c.name,
        city: c.city,
        country: c.country,
        continent: c.continent,
        hasLiveVideo: c.hasLiveVideo ? 1 : 0,
        streamType: c.media.type,
      },
    })),
  };
}
