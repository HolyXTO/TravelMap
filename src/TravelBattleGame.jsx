import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Swords,
  Users,
  Zap,
  Clock,
  Trophy,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Home,
  User,
  UserCheck,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Maximize2,
  Minimize2,
  Crown,
  Flame,
  Heart,
  AlertTriangle,
  ShieldCheck,
  Skull,
  Globe2,
  Camera,
  Car,
  Key,
  Navigation,
  Lock,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import gameData from "./data/guessGameData.json";
import { supabase } from "./lib/supabase";
import StreetViewViewer from "./components/StreetViewViewer";
import {
  STREET_VIEW_QUESTIONS,
  getStreetViewQuestions,
} from "./services/streetViewService";
import "./battleStyles.css";

// 题库过滤与洗牌工具 (支持 Xiao / Tang / Xiao & Tang 全量题库)
function getFilteredQuestions(filter = "Tang") {
  if (filter === "Xiao") {
    return gameData.questions.filter((q) => q.author === "Xiao" || !q.author || q.author !== "Tang");
  }
  if (filter === "Tang") {
    return gameData.questions.filter((q) => q.author === "Tang");
  }
  // Xiao & Tang 两人照片合集
  return gameData.questions;
}

// 华为地图瓦片服务 (带 OSM 自动优雅降级)
const HUAWEI_MAP_TILE_URL =
  "https://maprastertile-drcn.dbankcdn.cn/display-service/v1/online-render/getTile/26.02.03.16/{z}/{x}/{y}/?language=zh&p=46&scale=2&mapType=ROADMAP&presetStyleId=standard&pattern=JPG&key=DAEDANitav6P7Q0lWzCzKkLErbrJG4kS1u%2FCpEe5ZyxW5u0nSkb40bJ%2BYAugRN03fhf0BszLS1rCrzAogRHDZkxaMrloaHPQGO6LNg==";

// 大圆球面距离计算 (km)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }
  const R = 6371; // 地球半径 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// 格式化距离显示
function formatDistance(distKm) {
  if (!Number.isFinite(distKm)) return "未作答";
  if (distKm < 1.0) {
    return `${Math.round(distKm * 1000)} 米`;
  }
  if (distKm >= 100) {
    return `${Math.round(distKm)} 公里`;
  }
  return `${distKm.toFixed(1)} 公里`;
}

// 国际版指数衰减计分公式 (满分 5,000 分，参数 D = 14916.862)
function calculateBattleScore(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= 0.15) return 5000; // 150米内满分
  const D = 14916.862;
  if (distanceKm >= D) return 0;
  const rawScore = 5000 * Math.exp((-10 * distanceKm) / D);
  return Math.max(0, Math.min(5000, Math.round(rawScore)));
}

// GeoGuessr / 图寻主流扣血制伤害倍率计算 (第 5 题起启动倍率，最高 4.0x)
function getRoundMultiplier(roundIndex) {
  const roundNum = roundIndex + 1;
  if (roundNum <= 4) return 1.0;
  if (roundNum === 5) return 1.5;
  if (roundNum === 6) return 2.0;
  if (roundNum === 7) return 2.5;
  if (roundNum === 8) return 3.0;
  if (roundNum === 9) return 3.5;
  return Math.min(4.0, 4.0 + (roundNum - 10) * 0.5);
}

// 全局题目查找器 (兼容 360° 全景街景与旅拍照片)
function findQuestionById(id) {
  const fromGameData = gameData.questions.find((q) => q.id === id);
  if (fromGameData) return fromGameData;
  const fromStreetView = STREET_VIEW_QUESTIONS.find((q) => q.id === id);
  if (fromStreetView) {
    return {
      ...fromStreetView,
      countryName: fromStreetView.countryName || fromStreetView.country,
      cityName: fromStreetView.cityName || fromStreetView.city,
      exactLat: fromStreetView.lat,
      exactLng: fromStreetView.lng,
      center: [fromStreetView.lng, fromStreetView.lat],
      photoUrl: fromStreetView.panoUrl,
      photoUrlHd: fromStreetView.panoUrl,
    };
  }
  return null;
}

// 随机洗牌选取题目 (支持 360° 全球街景与旅拍照片两大对战模式)
function pickBattleQuestions(mediaMode = "streetview", filter = "global", count = 30) {
  if (mediaMode === "streetview") {
    return getStreetViewQuestions(filter, count);
  }
  const pool = [...getFilteredQuestions(filter)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// =========================================================================
// GeoGuessr 针式图钉图标定义 (与实景图寻 100% 保持一致视觉设计)
// =========================================================================

// 玩家自己的插旗 (金黄色针式图钉)
function createGuessPinIcon() {
  return L.divIcon({
    className: "game-div-icon-wrapper",
    html: `
      <div class="geoguessr-needle-pin guess">
        <div class="pin-head-bubble">
          <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="battle-pin-drop-shadow" x="-30%" y="-20%" width="160%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="rgba(0,0,0,0.4)" />
              </filter>
              <linearGradient id="battle-guess-pin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#d97706" />
              </linearGradient>
            </defs>
            <path d="M19 48 C19 48, 35 30, 35 19 C35 10.163, 27.837 3, 19 3 C10.163 3, 3 10.163, 3 19 C3 30, 19 48, 19 48 Z" fill="url(#battle-guess-pin-grad)" stroke="#ffffff" stroke-width="2.5" filter="url(#battle-pin-drop-shadow)" />
            <circle cx="19" cy="19" r="8" fill="#ffffff" />
            <circle cx="19" cy="19" r="4.5" fill="#d97706" />
          </svg>
          <div class="needle-pin-label">您的插旗</div>
        </div>
        <div class="needle-ground-shadow"></div>
      </div>
    `,
    iconSize: [38, 50],
    iconAnchor: [19, 48],
  });
}

// 对手的插旗 (冰蓝色针式图钉)
function createOpponentPinIcon(oppName) {
  return L.divIcon({
    className: "game-div-icon-wrapper",
    html: `
      <div class="geoguessr-needle-pin opponent">
        <div class="pin-head-bubble">
          <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="battle-opp-drop-shadow" x="-30%" y="-20%" width="160%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="rgba(0,0,0,0.4)" />
              </filter>
              <linearGradient id="battle-opp-pin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a855f7" />
                <stop offset="100%" stop-color="#7c3aed" />
              </linearGradient>
            </defs>
            <path d="M19 48 C19 48, 35 30, 35 19 C35 10.163, 27.837 3, 19 3 C10.163 3, 3 10.163, 3 19 C3 30, 19 48, 19 48 Z" fill="url(#battle-opp-pin-grad)" stroke="#ffffff" stroke-width="2.5" filter="url(#battle-opp-drop-shadow)" />
            <circle cx="19" cy="19" r="8" fill="#ffffff" />
            <circle cx="19" cy="19" r="4.5" fill="#7c3aed" />
          </svg>
          <div class="needle-pin-label opponent">${oppName || "对手插旗"}</div>
        </div>
        <div class="needle-ground-shadow"></div>
      </div>
    `,
    iconSize: [38, 50],
    iconAnchor: [19, 48],
  });
}

// 目标真实拍摄点：经典普通规范小红旗 (直立细杆 + 纯正红色三角旗面 + 精准触地红点)
function createTargetPinIcon(cityName) {
  return L.divIcon({
    className: "battle-red-flag-icon-wrap",
    html: `
      <div class="battle-target-flag-container">
        <div class="battle-flag-label target">真实位置 · ${cityName || "实际拍摄地"}</div>
        <svg class="battle-flag-svg" width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="battle-flag-shadow" x="-20%" y="-10%" width="150%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.25)" />
            </filter>
          </defs>
          <!-- 地面锚点浅灰微阴影 -->
          <ellipse cx="6" cy="39" rx="5" ry="2" fill="rgba(0,0,0,0.2)" />
          <!-- 笔直金属细旗杆 -->
          <line x1="6" y1="4" x2="6" y2="39" stroke="#334155" stroke-width="2.4" stroke-linecap="round" />
          <!-- 旗杆顶部金属小圆头 -->
          <circle cx="6" cy="4" r="2" fill="#94a3b8" />
          <!-- 经典规范的小红旗 (向右三角旗面，纯净红底白边) -->
          <path d="M6 5 L28 14 L6 23 Z" fill="#ef4444" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" filter="url(#battle-flag-shadow)" />
          <!-- 触地点红色定位小圆珠 -->
          <circle cx="6" cy="39" r="2.5" fill="#ef4444" stroke="#ffffff" stroke-width="1" />
        </svg>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [6, 39],
  });
}

// 智能计算连线徽章最佳放置坐标 (避开目标点、己方与对手插旗，以及其他徽章，杜绝遮挡)
function getOptimalBadgeCoord(guessLat, guessLng, targetLat, targetLng, obstacles = [], preferredT = 0.35) {
  // 根据 preferredT 区分双方徽章在连线上的侧重采样区间：我方偏向 0.30~0.42，敌方偏向 0.60~0.75
  const candidates =
    preferredT < 0.5
      ? [0.35, 0.28, 0.42, 0.22, 0.48]
      : [0.65, 0.72, 0.58, 0.78, 0.52];

  let bestT = candidates[0];
  let maxMinDist = -1;

  for (const t of candidates) {
    const lat = guessLat * (1 - t) + targetLat * t;
    const lng = guessLng * (1 - t) + targetLng * t;

    let minDist = Infinity;
    for (const obs of obstacles) {
      if (!obs || obs[0] === null || obs[1] === null) continue;
      const dLat = (lat - obs[0]) * 111;
      const dLng = (lng - obs[1]) * 111 * Math.cos((lat * Math.PI) / 180);
      const d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (d < minDist) minDist = d;
    }

    const score = minDist - Math.abs(t - preferredT) * 45;
    if (score > maxMinDist) {
      maxMinDist = score;
      bestT = t;
    }
  }

  return [guessLat * (1 - bestT) + targetLat * bestT, guessLng * (1 - bestT) + targetLng * bestT];
}

// 连线中点距离与得分徽章 (极简高质感双色浮动胶囊，彻底杜绝重叠与黑圈)
function createDistanceBadgeIcon(distKm, score, isOpponent) {
  const badgeClass = isOpponent ? "opp" : "you";
  return L.divIcon({
    className: "battle-distance-badge-wrap",
    html: `
      <div class="battle-midpoint-pill ${badgeClass}">
        <span class="pill-dist">${formatDistance(distKm)}</span>
        <span class="pill-divider">·</span>
        <span class="pill-score">+${score.toLocaleString()}分</span>
      </div>
    `,
    iconSize: [0, 0],
  });
}

// 繁体中文与别名映射到标准简体中文（确保与 public/flags/circle-195/*.png 100% 对应）
const TRAD_TO_SIMP_COUNTRIES = {
  "中國": "中国", "法國": "法国", "德國": "德国", "美國": "美国", "荷蘭": "荷兰",
  "奧地利": "奥地利", "波蘭": "波兰", "愛沙尼亞": "爱沙尼亚", "拉脫維亞": "拉脱维亚",
  "烏克蘭": "乌克兰", "烏拉圭": "乌拉圭", "愛爾蘭共和國": "爱尔兰", "愛爾蘭": "爱尔兰",
  "坦桑尼亞": "坦桑尼亚", "白俄羅斯": "白俄罗斯", "芬蘭": "芬兰", "梵蒂岡城國": "梵蒂冈",
  "梵蒂岡": "梵蒂冈", "羅馬尼亞": "罗马尼亚", "馬達加斯加": "马达加斯加", "希臘": "希腊",
  "俄羅斯": "俄罗斯", "義大利": "意大利", "澳大利亞": "澳大利亚", "紐西蘭": "新西兰",
  "南非共和國": "南非", "沙烏地阿拉伯": "沙特阿拉伯", "土耳其共和國": "土耳其",
  "南韓": "韩国", "北韓": "朝鲜", "菲律賓": "菲律宾", "阿爾及利亞": "阿尔及利亚",
  "奈及利亞": "尼日利亚", "利比亞": "利比亚", "葛摩": "科摩罗", "香港": "中国",
  "澳門": "中国", "台湾": "中国", "臺灣": "中国", "United States": "美国",
  "France": "法国", "Germany": "德国", "Italy": "意大利", "Spain": "西班牙",
  "United Kingdom": "英国", "Japan": "日本", "Brazil": "巴西", "Russia": "俄罗斯"
};

// 国家国旗圆形图标组件 (优先读取本地 /TravelMap/flags/circle-195/*.png，若无则平滑降级为 Emoji)
const COUNTRY_FLAG_EMOJIS = {
  "中国": "🇨🇳", "挪威": "🇳🇴", "法国": "🇫🇷", "德国": "🇩🇪", "瑞士": "🇨🇭",
  "荷兰": "🇳🇱", "卢森堡": "🇱🇺", "冰岛": "🇮🇸", "意大利": "🇮🇹", "西班牙": "🇪🇸",
  "捷克": "🇨🇿", "奥地利": "🇦🇹", "比利时": "🇧🇪", "希腊": "🇬🇷", "波兰": "🇵🇱",
  "安道尔": "🇦🇩", "列支敦士登": "🇱🇮", "塞浦路斯": "🇨🇾", "梵蒂冈": "🇻🇦",
  "英国": "🇬🇧", "瑞典": "🇸🇪", "芬兰": "🇫🇮", "丹麦": "🇩🇰", "葡萄牙": "🇵🇹",
  "爱尔兰": "🇮🇪", "匈牙利": "🇭🇺", "克罗地亚": "🇭🇷", "摩纳哥": "🇲🇨", "圣马力诺": "🇸🇲",
  "日本": "🇯🇵", "韩国": "🇰🇷", "泰国": "🇹🇭", "新加坡": "🇸🇬", "美国": "🇺🇸",
  "加拿大": "🇨🇦", "澳大利亚": "🇦🇺", "新西兰": "🇳🇿", "巴西": "🇧🇷", "阿根廷": "🇦🇷",
  "智利": "🇨🇱", "墨西哥": "🇲🇽", "土耳其": "🇹🇷", "俄罗斯": "🇷🇺", "乌克兰": "🇺🇦",
  "爱沙尼亚": "🇪🇪", "拉脱维亚": "🇱🇻", "立陶宛": "🇱🇹", "斯洛伐克": "🇸🇰", "斯洛文尼亚": "🇸🇮",
  "塞尔维亚": "🇷🇸", "保加利亚": "🇧🇬", "罗马尼亚": "🇷🇴", "埃及": "🇪🇬", "南非": "🇿🇦",
  "印度": "🇮🇳", "印度尼西亚": "🇮🇩", "马来西亚": "🇲🇾", "越南": "🇻🇳", "菲律宾": "🇵🇭"
};

function CountryFlag({ countryName, size = 26, className = "" }) {
  const [hasError, setHasError] = useState(false);
  const rawName = (countryName || "").trim();
  const cleanName = TRAD_TO_SIMP_COUNTRIES[rawName] || rawName;
  const flagUrl = `${import.meta.env.BASE_URL}flags/circle-195/${encodeURIComponent(cleanName)}.png`;

  useEffect(() => {
    setHasError(false);
  }, [cleanName]);

  if (hasError || !cleanName) {
    const emoji = COUNTRY_FLAG_EMOJIS[cleanName] || COUNTRY_FLAG_EMOJIS[rawName] || "🌍";
    return (
      <span
        className={`country-flag-emoji ${className}`}
        style={{ fontSize: `${size * 0.85}px`, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}
        role="img"
        aria-label={cleanName}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={flagUrl}
      alt={cleanName}
      className={`country-flag-circle ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        objectFit: "cover",
        display: "inline-block",
        verticalAlign: "middle",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
        border: "1.5px solid rgba(255, 255, 255, 0.9)",
        flexShrink: 0
      }}
      onError={() => setHasError(true)}
    />
  );
}

// =========================================================================
// 交互式滚轮缩放与平移看图组件 (与实景图寻 InteractivePhotoZoomer 对齐)
// =========================================================================
function BattlePhotoZoomer({ photoUrl, photoUrlHd, alt }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1.0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const translateStartRef = useRef({ x: 0, y: 0 });
  const [isHdLoaded, setIsHdLoaded] = useState(false);

  // 预加载高清大图
  useEffect(() => {
    setIsHdLoaded(false);
    setScale(1.0);
    setTranslate({ x: 0, y: 0 });

    if (!photoUrlHd) return;
    const img = new Image();
    img.src = photoUrlHd;
    img.onload = () => setIsHdLoaded(true);
  }, [photoUrl, photoUrlHd]);

  // 非被动 wheel 监听器，支持中心相对缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const offsetX = mouseX - centerX;
      const offsetY = mouseY - centerY;
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;

      setScale((currentScale) => {
        const nextScale = Math.min(6.0, Math.max(1.0, currentScale * zoomFactor));
        if (nextScale <= 1.01) {
          setTranslate({ x: 0, y: 0 });
          return 1.0;
        }

        const deltaRatio = nextScale / currentScale - 1;
        setTranslate((prevTranslate) => {
          const nextX = prevTranslate.x - offsetX * deltaRatio;
          const nextY = prevTranslate.y - offsetY * deltaRatio;
          const maxTranslateX = Math.max(0, (rect.width * (nextScale - 1)) / 2);
          const maxTranslateY = Math.max(0, (rect.height * (nextScale - 1)) / 2);

          return {
            x: Math.max(-maxTranslateX, Math.min(maxTranslateX, nextX)),
            y: Math.max(-maxTranslateY, Math.min(maxTranslateY, nextY)),
          };
        });

        return nextScale;
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  const handleMouseDown = (e) => {
    if (scale <= 1.0 || e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    translateStartRef.current = { ...translate };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1.0) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const rect = containerRef.current?.getBoundingClientRect();
    const maxTranslateX = rect ? Math.max(0, (rect.width * (scale - 1)) / 2) : 1000;
    const maxTranslateY = rect ? Math.max(0, (rect.height * (scale - 1)) / 2) : 1000;

    setTranslate({
      x: Math.max(-maxTranslateX, Math.min(maxTranslateX, translateStartRef.current.x + dx)),
      y: Math.max(-maxTranslateY, Math.min(maxTranslateY, translateStartRef.current.y + dy)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = (e) => {
    if (scale > 1.2) {
      setScale(1.0);
      setTranslate({ x: 0, y: 0 });
    } else {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const offsetX = e.clientX - rect.left - centerX;
      const offsetY = e.clientY - rect.top - centerY;
      const nextScale = 2.5;
      const deltaRatio = nextScale - 1.0;

      const maxTranslateX = Math.max(0, (rect.width * (nextScale - 1)) / 2);
      const maxTranslateY = Math.max(0, (rect.height * (nextScale - 1)) / 2);

      setScale(nextScale);
      setTranslate({
        x: Math.max(-maxTranslateX, Math.min(maxTranslateX, -offsetX * deltaRatio)),
        y: Math.max(-maxTranslateY, Math.min(maxTranslateY, -offsetY * deltaRatio)),
      });
    }
  };

  const stepZoom = (direction) => {
    setScale((current) => {
      const factor = direction > 0 ? 1.4 : 0.72;
      const next = Math.min(6.0, Math.max(1.0, current * factor));
      if (next <= 1.01) {
        setTranslate({ x: 0, y: 0 });
        return 1.0;
      }
      return next;
    });
  };

  const resetZoom = () => {
    setScale(1.0);
    setTranslate({ x: 0, y: 0 });
  };

  const activeSrc = isHdLoaded && scale > 1.6 ? photoUrlHd || photoUrl : photoUrl;

  return (
    <div
      className={`game-photo-viewport ${scale > 1.0 ? "zoomed" : ""} ${
        isDragging ? "dragging" : ""
      }`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <div
        className="game-photo-transform-layer"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        <img src={activeSrc} alt={alt} className="game-photo-render" draggable={false} />
      </div>

      <div className="game-photo-hud">
        <div className="photo-hud-badge">
          <span>{Math.round(scale * 100)}%</span>
          {scale > 1.6 && <span className="hd-tag">4K高清</span>}
        </div>
        <div className="photo-hud-buttons">
          <button type="button" onClick={() => stepZoom(1)} title="放大 (+)">
            <ZoomIn size={14} />
          </button>
          <button type="button" onClick={() => stepZoom(-1)} title="缩小 (-)">
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            title="复位照片视角 (1x)"
            className="photo-hud-reset-btn"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Web Audio API 游戏音效合成器
class SoundFx {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }
  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  playTone(freq, type = "sine", duration = 0.15, gainVal = 0.1) {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio errors
    }
  }
  playMatchFound() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "triangle", 0.2, 0.15), i * 90);
    });
  }
  playLock() {
    this.playTone(440, "sine", 0.1, 0.2);
    setTimeout(() => this.playTone(880, "sine", 0.15, 0.2), 100);
  }
  playUrgentTick() {
    this.playTone(880, "square", 0.08, 0.15);
  }
  playReveal() {
    [659.25, 830.61, 987.77].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "sine", 0.25, 0.15), i * 110);
    });
  }
  playHit() {
    this.playTone(440, "triangle", 0.12, 0.22);
    setTimeout(() => this.playTone(660, "square", 0.18, 0.18), 70);
  }
  playDamage() {
    this.playTone(180, "sawtooth", 0.22, 0.2);
    setTimeout(() => this.playTone(120, "sawtooth", 0.3, 0.25), 90);
  }
  playVictory() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, "triangle", 0.4, 0.2), i * 120);
    });
  }
}

const sfx = new SoundFx();

export default function TravelBattleGame({ onBackToExplore }) {
  // 玩家基础信息
  const [playerId] = useState(() => {
    let id = sessionStorage.getItem("travel_battle_player_id");
    if (!id) {
      id = "p_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("travel_battle_player_id", id);
    }
    return id;
  });

  const [playerName, setPlayerName] = useState(() => {
    return (
      localStorage.getItem("travel_battle_player_name") ||
      "探险家-" + playerId.substring(2, 6).toUpperCase()
    );
  });

  const [isMuted, setIsMuted] = useState(false);

  // 游戏全局阶段状态:
  // LOBBY / MATCHING / ROOM_WAITING / PLAYING / ROUND_REVEAL / GAME_OVER
  const [gameState, setGameState] = useState("LOBBY");

  // 房间与对战元数据
  const [roomId, setRoomId] = useState("");
  const [inputRoomCode, setInputRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [opponent, setOpponent] = useState(null); // { id, name }
  const [matchQuestions, setMatchQuestions] = useState([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

  // 本回合答题与计时状态
  const [myPin, setMyPin] = useState(null); // { lat, lng }
  const [myLocked, setMyLocked] = useState(false);
  const [opponentLocked, setOpponentLocked] = useState(false);
  const [urgentSeconds, setUrgentSeconds] = useState(null); // 15s 倒计时
  const [urgentTriggeredBy, setUrgentTriggeredBy] = useState(null);

  // 赛制玩法: "HP" (6000 HP 扣血淘汰) | "POINTS" (10 题经典积分)
  const [matchMode, setMatchMode] = useState("HP");
  const matchModeRef = useRef("HP");

  // 题目形式：streetview (全球360°真实街景) | photo (经典旅拍照片)
  const [battleMediaMode, setBattleMediaMode] = useState("streetview");
  const battleMediaModeRef = useRef("streetview");

  // 街景分类选择：全球 / 国内 / 国外
  const [streetViewRegion, setStreetViewRegion] = useState("global"); // "global" | "domestic" | "international"
  const streetViewRegionRef = useRef("global");

  // 街景观察规则：自由拖拽/环视变焦 (默认开启)
  const [movementAllowed, setMovementAllowed] = useState(true);
  const movementAllowedRef = useRef(true);

  const updateBattleMediaMode = (mode) => {
    setBattleMediaMode(mode);
    battleMediaModeRef.current = mode;
  };
  const updateStreetViewRegion = (region) => {
    setStreetViewRegion(region);
    streetViewRegionRef.current = region;
  };
  const updateMovementAllowed = (allowed) => {
    setMovementAllowed(allowed);
    movementAllowedRef.current = allowed;
  };

  const getActiveQuestionFilter = () => {
    if (battleMediaModeRef.current === "streetview") return streetViewRegionRef.current;
    return authorFilterRef.current;
  };

  // 题库分类选择: "Xiao" (4365张) | "Tang" (502张) | "Xiao&Tang" (4867张全量)
  const [authorFilter, setAuthorFilter] = useState("Tang");
  const authorFilterRef = useRef("Tang");
  useEffect(() => {
    authorFilterRef.current = authorFilter;
  }, [authorFilter]);

  // 双方血量 (6000 HP 扣血模式独享)
  const [myHp, setMyHp] = useState(6000);
  const [opponentHp, setOpponentHp] = useState(6000);
  const myHpRef = useRef(6000);
  const opponentHpRef = useRef(6000);

  // 回合与全局累计比分
  const [myTotalScore, setMyTotalScore] = useState(0);
  const [opponentTotalScore, setOpponentTotalScore] = useState(0);
  const [roundResult, setRoundResult] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);

  // 复制与自动倒计时状态
  const [copiedLink, setCopiedLink] = useState(false);
  const [autoAdvanceSec, setAutoAdvanceSec] = useState(null);

  // 关键 Ref 引用 (用于避免广播时序竞争和状态闭包问题)
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);
  const channelRef = useRef(null);
  const lobbyChannelRef = useRef(null);
  const urgentTimerRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);

  // 状态同步 Refs (彻底杜绝 WebSocket 广播闭包中取到旧 state 的 Bug)
  const matchQuestionsRef = useRef([]);
  const currentRoundIndexRef = useRef(0);
  const gameStateRef = useRef("LOBBY");
  const myLockedRef = useRef(false);
  const myPinRef = useRef(null);
  const roundSubmissionsRef = useRef({});

  // 广播事件委托代理 Ref
  const handlersRef = useRef({});

  // 实时同步状态至 Refs
  useEffect(() => {
    matchModeRef.current = matchMode;
  }, [matchMode]);

  useEffect(() => {
    myHpRef.current = myHp;
  }, [myHp]);

  useEffect(() => {
    opponentHpRef.current = opponentHp;
  }, [opponentHp]);

  useEffect(() => {
    matchQuestionsRef.current = matchQuestions;
  }, [matchQuestions]);

  useEffect(() => {
    currentRoundIndexRef.current = currentRoundIndex;
  }, [currentRoundIndex]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    myLockedRef.current = myLocked;
  }, [myLocked]);

  useEffect(() => {
    myPinRef.current = myPin;
  }, [myPin]);

  const updateMatchQuestions = (qs) => {
    matchQuestionsRef.current = qs;
    setMatchQuestions(qs);
  };

  const updateRoundIndex = (idx) => {
    currentRoundIndexRef.current = idx;
    setCurrentRoundIndex(idx);
  };

  const updateGameState = (st) => {
    gameStateRef.current = st;
    setGameState(st);
  };

  // 地图视角复位 (街景国内模式居中中国，国外/全球居中世界，照片模式居中欧洲)
  const handleResetMapView = () => {
    if (mapInstanceRef.current) {
      if (battleMediaModeRef.current === "streetview") {
        if (streetViewRegionRef.current === "domestic") {
          mapInstanceRef.current.setView([35.8617, 104.1954], 4);
        } else {
          mapInstanceRef.current.setView([25.0, 15.0], 2);
        }
      } else {
        mapInstanceRef.current.setView([48.8566, 2.3522], 4);
      }
    }
  };

  // 全屏沉浸对战模式 (对局时自动扩展铺满整个网页视口，带来沉浸式电竞体验)
  const [isImmersive, setIsImmersive] = useState(true);

  // 对战进行或结算阶段锁定外层网页滚动，防止背景穿透
  useEffect(() => {
    if (isImmersive && (gameState === "PLAYING" || gameState === "ROUND_REVEAL" || gameState === "GAME_OVER")) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isImmersive, gameState]);

  // 全屏模式切换时重新自适应地图尺寸
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isImmersive, gameState]);

  // 卸载清理通道与定时器
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current);
      if (urgentTimerRef.current) clearTimeout(urgentTimerRef.current);
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, []);

  // 同步静音设置
  useEffect(() => {
    sfx.isMuted = isMuted;
  }, [isMuted]);

  // 保存昵称
  const handlePlayerNameChange = (nameStr) => {
    const val = (nameStr || "").trim().substring(0, 12);
    setPlayerName(val || "探险家");
    localStorage.setItem("travel_battle_player_name", val || "探险家");
  };

  const handleNameChange = (e) => {
    handlePlayerNameChange(e.target.value);
  };

  // URL 带参加入房间 (e.g. ?duel=123456)
  useEffect(() => {
    try {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const fullUrl = search + hash;
      const match = fullUrl.match(/[?&]duel=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setInputRoomCode(match[1].toUpperCase());
      }
    } catch (err) {
      console.warn("Duel url parse error:", err);
    }
  }, []);

  // ==========================================================================
  // Leaflet 地图初始化与销毁 (仅在 PLAYING / ROUND_REVEAL 状态挂载)
  // ==========================================================================
  useEffect(() => {
    if (gameState !== "PLAYING" && gameState !== "ROUND_REVEAL") {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerGroupRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // 视角定在欧洲中部 (Tang 精选欧洲题库)
      const map = L.map(mapContainerRef.current, {
        center: [48.8566, 2.3522],
        zoom: 4,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: false,
      });

      const tileLayer = L.tileLayer(HUAWEI_MAP_TILE_URL, {
        minZoom: 1,
        maxZoom: 18,
        tileSize: 256,
      }).addTo(map);

      tileLayer.on("tileerror", (e) => {
        if (e.tile && !e.tile.__fallback) {
          e.tile.__fallback = true;
          const { x, y, z } = e.coords;
          e.tile.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        }
      });

      const markerGroup = L.featureGroup().addTo(map);
      markerGroupRef.current = markerGroup;

      // 玩家点击地图放置图钉 (引用 Ref 彻底防止旧闭包)
      map.on("click", (e) => {
        if (myLockedRef.current || gameStateRef.current !== "PLAYING") return; // 锁定后或非答题中不可修改
        const { lat, lng } = e.latlng;
        const newPin = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
        myPinRef.current = newPin;
        setMyPin(newPin);
      });

      mapInstanceRef.current = map;
    }

    // 重新调整地图尺寸
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);
  }, [gameState]);

  // ==========================================================================
  // 地图标记渲染 (选点标记 与 回合揭晓同屏对比)
  // ==========================================================================
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();

    // 1. 游戏中阶段：显示自己当前的金色针式图钉 (与实景图寻一致)
    if (gameState === "PLAYING" && myPin) {
      L.marker([myPin.lat, myPin.lng], {
        icon: createGuessPinIcon(),
        draggable: !myLocked,
        zIndexOffset: 1500,
      }).addTo(markerGroup);
    }

    // 2. 回合揭晓阶段：同时绘制 目标真实战旗、你的插旗、对手插旗、智能避让得分徽章与虚线
    if (gameState === "ROUND_REVEAL" && roundResult) {
      const { targetLat, targetLng, myGuess, oppGuess, targetCity } = roundResult;
      const boundsPoints = [[targetLat, targetLng]];

      // A. 目标真实点 (鲜艳红色战旗 + 地面雷达波纹)
      const targetMarker = L.marker([targetLat, targetLng], {
        icon: createTargetPinIcon(targetCity),
        zIndexOffset: 2000,
      });
      markerGroup.addLayer(targetMarker);

      // 收集地图上所有障碍点 (目标真实点、双方插旗点)，供徽章避让算法排布
      const obstacles = [[targetLat, targetLng]];
      if (myGuess && myGuess.lat !== null) obstacles.push([myGuess.lat, myGuess.lng]);
      if (oppGuess && oppGuess.lat !== null) obstacles.push([oppGuess.lat, oppGuess.lng]);

      // B. 你的预测插旗 (金黄色针式图钉)
      if (myGuess && myGuess.lat !== null) {
        boundsPoints.push([myGuess.lat, myGuess.lng]);
        const myMarker = L.marker([myGuess.lat, myGuess.lng], {
          icon: createGuessPinIcon(),
          zIndexOffset: 1500,
        });
        markerGroup.addLayer(myMarker);

        // 连线与距离徽章 (动态计算避让坐标，彻底杜绝遮挡插旗与虚线)
        L.polyline([[myGuess.lat, myGuess.lng], [targetLat, targetLng]], {
          color: "#d97706",
          dashArray: "6, 6",
          weight: 3.5,
          opacity: 0.9,
        }).addTo(markerGroup);

        const myBadgeCoord = getOptimalBadgeCoord(
          myGuess.lat,
          myGuess.lng,
          targetLat,
          targetLng,
          obstacles,
          0.35
        );
        obstacles.push(myBadgeCoord); // 将己方徽章也记录为障碍物，防止敌方徽章重叠

        L.marker(myBadgeCoord, {
          icon: createDistanceBadgeIcon(myGuess.dist, myGuess.score, false),
          zIndexOffset: 1800,
        }).addTo(markerGroup);
      }

      // C. 对手的预测插旗 (冰蓝色针式图钉)
      if (oppGuess && oppGuess.lat !== null) {
        boundsPoints.push([oppGuess.lat, oppGuess.lng]);
        const oppMarker = L.marker([oppGuess.lat, oppGuess.lng], {
          icon: createOpponentPinIcon(opponent?.name),
          zIndexOffset: 1400,
        });
        markerGroup.addLayer(oppMarker);

        // 连线与距离徽章 (智能避开己方徽章、目标点与双方图钉)
        L.polyline([[oppGuess.lat, oppGuess.lng], [targetLat, targetLng]], {
          color: "#7c3aed",
          dashArray: "6, 6",
          weight: 3.5,
          opacity: 0.9,
        }).addTo(markerGroup);

        const oppBadgeCoord = getOptimalBadgeCoord(
          oppGuess.lat,
          oppGuess.lng,
          targetLat,
          targetLng,
          obstacles,
          0.65
        );

        L.marker(oppBadgeCoord, {
          icon: createDistanceBadgeIcon(oppGuess.dist, oppGuess.score, true),
          zIndexOffset: 1750,
        }).addTo(markerGroup);
      }

      // 地图自动自适应聚焦到包含所有点的范围
      if (boundsPoints.length > 1) {
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [60, 60], maxZoom: 14 });
      }
    }
  }, [gameState, myPin, myLocked, roundResult, opponent]);

  // ==========================================================================
  // 回合完成判定与成绩揭晓 (彻底杜绝双方交卷后无法结算或取到旧闭包的 Bug)
  // ==========================================================================
  const triggerRoundReveal = useCallback((mySub, oppSub, roundIdx) => {
    // 停止 15s 紧急倒计时
    if (urgentTimerRef.current) clearTimeout(urgentTimerRef.current);
    setUrgentSeconds(null);
    setUrgentTriggeredBy(null);

    const fallbackPool = getFilteredQuestions(authorFilterRef.current);
    const questions = matchQuestionsRef.current.length > 0 ? matchQuestionsRef.current : fallbackPool;
    const curQ = questions[roundIdx] ?? questions[currentRoundIndexRef.current];
    if (!curQ) {
      console.warn("Could not find question for round", roundIdx);
      return;
    }

    const targetLat = curQ.exactLat ?? curQ.center[1];
    const targetLng = curQ.exactLng ?? curQ.center[0];

    // GeoGuessr / 图寻 扣血伤害计算
    const myScore = mySub.score || 0;
    const oppScore = oppSub.score || 0;
    const diff = Math.abs(myScore - oppScore);
    const multiplier = matchModeRef.current === "HP" ? getRoundMultiplier(roundIdx) : 1.0;
    const damage = Math.round(diff * multiplier);

    let nextMyHp = myHpRef.current;
    let nextOppHp = opponentHpRef.current;
    let isKo = false;

    if (matchModeRef.current === "HP") {
      if (myScore > oppScore) {
        nextOppHp = Math.max(0, nextOppHp - damage);
        sfx.playHit();
      } else if (oppScore > myScore) {
        nextMyHp = Math.max(0, nextMyHp - damage);
        sfx.playDamage();
      }
      setMyHp(nextMyHp);
      myHpRef.current = nextMyHp;
      setOpponentHp(nextOppHp);
      opponentHpRef.current = nextOppHp;
      if (nextMyHp <= 0 || nextOppHp <= 0) {
        isKo = true;
      }
    }

    const res = {
      roundIndex: roundIdx,
      targetLat,
      targetLng,
      targetCity: curQ.cityName,
      targetCountry: TRAD_TO_SIMP_COUNTRIES[curQ.countryName] || curQ.countryName,
      myGuess: {
        lat: mySub.lat,
        lng: mySub.lng,
        dist: mySub.dist,
        score: mySub.score,
      },
      oppGuess: {
        lat: oppSub.lat,
        lng: oppSub.lng,
        dist: oppSub.dist,
        score: oppSub.score,
      },
      damage,
      multiplier,
      myHp: nextMyHp,
      oppHp: nextOppHp,
      isKo,
    };

    setRoundResult(res);
    setMyTotalScore((prev) => prev + (mySub.score || 0));
    setOpponentTotalScore((prev) => prev + (oppSub.score || 0));
    setMatchHistory((prev) => [...prev, res]);
    updateGameState("ROUND_REVEAL");
    sfx.playReveal();

    // 启动 10 秒自动跳转下一题倒计时 (给予玩家更充裕的复盘与看图时间)
    setAutoAdvanceSec(10);
  }, []);

  const checkRoundCompletion = useCallback(
    (submissions, roundIdx) => {
      const mySub = submissions[playerId];
      // 匹配非自己的任意玩家提交
      const oppId = Object.keys(submissions).find((k) => k !== playerId);
      const oppSub = oppId ? submissions[oppId] : null;

      if (mySub && oppSub) {
        triggerRoundReveal(mySub, oppSub, roundIdx);
      }
    },
    [playerId, triggerRoundReveal]
  );

  // 15 秒绝杀倒计时时钟
  useEffect(() => {
    if (urgentSeconds === null) return;

    if (urgentSeconds > 0) {
      urgentTimerRef.current = setTimeout(() => {
        sfx.playUrgentTick();
        setUrgentSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (urgentSeconds === 0) {
      handleForceSubmitOnTimeout();
    }

    return () => {
      if (urgentTimerRef.current) clearTimeout(urgentTimerRef.current);
    };
  }, [urgentSeconds]);

  // 15s 超时强制提交
  const handleForceSubmitOnTimeout = useCallback(() => {
    if (myLockedRef.current) return;
    const fallbackPool = getFilteredQuestions(authorFilterRef.current);
    const questions = matchQuestionsRef.current.length > 0 ? matchQuestionsRef.current : fallbackPool;
    const curQ = questions[currentRoundIndexRef.current];
    if (!curQ) return;

    const targetLat = curQ.exactLat ?? curQ.center[1];
    const targetLng = curQ.exactLng ?? curQ.center[0];

    let dist = 20000;
    let score = 0;
    let guessCoords = null;

    if (myPinRef.current) {
      dist = calculateDistanceKm(myPinRef.current.lat, myPinRef.current.lng, targetLat, targetLng);
      score = calculateBattleScore(dist);
      guessCoords = myPinRef.current;
    }

    setMyLocked(true);
    myLockedRef.current = true;
    sfx.playLock();

    const mySubmission = {
      playerId,
      roundIndex: currentRoundIndexRef.current,
      lat: guessCoords ? guessCoords.lat : null,
      lng: guessCoords ? guessCoords.lng : null,
      dist,
      score,
    };

    // 关键：本地立即写入自己数据！
    roundSubmissionsRef.current[playerId] = mySubmission;

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "player_locked",
        payload: { playerId, roundIndex: currentRoundIndexRef.current },
      });
      channelRef.current.send({
        type: "broadcast",
        event: "round_submit",
        payload: mySubmission,
      });
    }

    checkRoundCompletion(roundSubmissionsRef.current, currentRoundIndexRef.current);
  }, [playerId, checkRoundCompletion]);

  // 玩家主动点击“确认提交锁定”
  const handleLockInGuess = () => {
    if (myLockedRef.current || !myPinRef.current) return;
    const fallbackPool = getFilteredQuestions(authorFilterRef.current);
    const questions = matchQuestionsRef.current.length > 0 ? matchQuestionsRef.current : fallbackPool;
    const curQ = questions[currentRoundIndexRef.current];
    if (!curQ) return;

    setMyLocked(true);
    myLockedRef.current = true;
    sfx.playLock();

    const targetLat = curQ.exactLat ?? curQ.center[1];
    const targetLng = curQ.exactLng ?? curQ.center[0];
    const dist = calculateDistanceKm(myPinRef.current.lat, myPinRef.current.lng, targetLat, targetLng);
    const score = calculateBattleScore(dist);

    const mySubmission = {
      playerId,
      roundIndex: currentRoundIndexRef.current,
      lat: myPinRef.current.lat,
      lng: myPinRef.current.lng,
      dist,
      score,
    };

    // 关键：本地立即记录自己的成绩！
    roundSubmissionsRef.current[playerId] = mySubmission;

    if (channelRef.current) {
      // 广播通知：A. 告知对手我已锁定 (触发对手 15 秒绝杀倒计时)
      channelRef.current.send({
        type: "broadcast",
        event: "player_locked",
        payload: { playerId, roundIndex: currentRoundIndexRef.current },
      });

      // 广播通知：B. 发送自己的成绩数据
      channelRef.current.send({
        type: "broadcast",
        event: "round_submit",
        payload: mySubmission,
      });
    }

    // 检查对手是否在之前就已经交卷了
    checkRoundCompletion(roundSubmissionsRef.current, currentRoundIndexRef.current);
  };

  // 自动倒计时进入下一题
  useEffect(() => {
    if (gameState !== "ROUND_REVEAL" || autoAdvanceSec === null) return;
    if (autoAdvanceSec > 0) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvanceSec((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    } else if (autoAdvanceSec === 0) {
      handleNextRound();
    }
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [gameState, autoAdvanceSec]);

  // 本地切题/终局控制 (彻底杜绝第一局结束误判 GAME_OVER 的 Bug)
  const advanceToRound = useCallback((targetRoundIdx) => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    setAutoAdvanceSec(null);

    // 扣血制模式：若任一方血量已清零，立即判定 K.O. 结算！
    if (matchModeRef.current === "HP" && (myHpRef.current <= 0 || opponentHpRef.current <= 0)) {
      updateGameState("GAME_OVER");
      sfx.playVictory();
      return;
    }

    const totalRounds = matchQuestionsRef.current.length > 0
      ? matchQuestionsRef.current.length
      : (matchModeRef.current === "HP" ? 30 : 10);
    const nextIdx = targetRoundIdx !== undefined ? targetRoundIdx : currentRoundIndexRef.current + 1;

    // 经典积分制模式：10 题定胜负
    if (matchModeRef.current === "POINTS" && nextIdx >= 10) {
      updateGameState("GAME_OVER");
      sfx.playVictory();
      return;
    }

    if (nextIdx >= totalRounds) {
      updateGameState("GAME_OVER");
      sfx.playVictory();
      return;
    }

    // 防抖与去重：如果当前已经处于该目标回合且正在答题，避免由于双方重复广播导致重复跳题
    if (currentRoundIndexRef.current === nextIdx && gameStateRef.current === "PLAYING") {
      return;
    }

    updateRoundIndex(nextIdx);
    setMyPin(null);
    myPinRef.current = null;
    setMyLocked(false);
    myLockedRef.current = false;
    setOpponentLocked(false);
    setUrgentSeconds(null);
    setUrgentTriggeredBy(null);
    setRoundResult(null);
    roundSubmissionsRef.current = {};
    updateGameState("PLAYING");

    if (mapInstanceRef.current) {
      if (battleMediaModeRef.current === "streetview") {
        if (streetViewRegionRef.current === "domestic") {
          mapInstanceRef.current.setView([35.8617, 104.1954], 4);
        } else {
          mapInstanceRef.current.setView([25.0, 15.0], 2);
        }
      } else {
        mapInstanceRef.current.setView([48.8566, 2.3522], 4);
      }
    }
  }, []);

  // 玩家手动或自动点击“进入下一题”
  const handleNextRound = () => {
    const nextIdx = currentRoundIndexRef.current + 1;
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync_next_round",
        payload: { nextRoundIndex: nextIdx },
      });
    }
    advanceToRound(nextIdx);
  };

  // 保持事件代理 Ref 在每次渲染时同步为最新引用 (彻底杜绝 Supabase 频道长期运行的闭包失效)
  handlersRef.current = {
    onPlayerLocked: (payload) => {
      if (payload.playerId !== playerId) {
        setOpponentLocked(true);
        if (!myLockedRef.current) {
          setUrgentSeconds(15);
          setUrgentTriggeredBy("opponent");
          sfx.playUrgentTick();
        }
      }
    },
    onRoundSubmit: (payload) => {
      if (payload.playerId !== playerId) {
        setOpponentLocked(true);
        roundSubmissionsRef.current[payload.playerId] = payload;
        checkRoundCompletion(
          roundSubmissionsRef.current,
          payload.roundIndex ?? currentRoundIndexRef.current
        );
      }
    },
    onSyncNextRound: (payload) => {
      const targetIdx =
        typeof payload?.nextRoundIndex === "number"
          ? payload.nextRoundIndex
          : currentRoundIndexRef.current + 1;
      advanceToRound(targetIdx);
    },
    onStartGame: (payload) => {
      const qs = (payload.questions && payload.questions.length > 0)
        ? payload.questions
        : (payload.questionIds || [])
            .map((id) => findQuestionById(id))
            .filter(Boolean);
      if (payload.matchMode) {
        setMatchMode(payload.matchMode);
        matchModeRef.current = payload.matchMode;
      }
      if (payload.battleMediaMode) {
        updateBattleMediaMode(payload.battleMediaMode);
      }
      if (payload.movementAllowed !== undefined) {
        updateMovementAllowed(payload.movementAllowed);
      }
      setMyHp(6000);
      setOpponentHp(6000);
      myHpRef.current = 6000;
      opponentHpRef.current = 6000;
      updateMatchQuestions(qs);
      updateRoundIndex(0);
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      myPinRef.current = null;
      setMyLocked(false);
      myLockedRef.current = false;
      setOpponentLocked(false);
      setRoundResult(null);
      roundSubmissionsRef.current = {};
      updateGameState("PLAYING");
      handleResetMapView();
      sfx.playMatchFound();
    },
    onRematchStart: (payload) => {
      const qs = (payload.questions && payload.questions.length > 0)
        ? payload.questions
        : (payload.questionIds || [])
            .map((id) => findQuestionById(id))
            .filter(Boolean);
      if (payload.matchMode) {
        setMatchMode(payload.matchMode);
        matchModeRef.current = payload.matchMode;
      }
      if (payload.battleMediaMode) {
        updateBattleMediaMode(payload.battleMediaMode);
      }
      if (payload.movementAllowed !== undefined) {
        updateMovementAllowed(payload.movementAllowed);
      }
      setMyHp(6000);
      setOpponentHp(6000);
      myHpRef.current = 6000;
      opponentHpRef.current = 6000;
      updateMatchQuestions(qs);
      updateRoundIndex(0);
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      myPinRef.current = null;
      setMyLocked(false);
      myLockedRef.current = false;
      setOpponentLocked(false);
      setRoundResult(null);
      roundSubmissionsRef.current = {};
      updateGameState("PLAYING");
      handleResetMapView();
      sfx.playMatchFound();
    },
  };

  // ==========================================================================
  // 对战房间连接与通信 (Supabase Realtime Channel)
  // ==========================================================================
  const setupRoomChannel = useCallback(
    (targetRoomId, amIHost, questionsArr, oppObj) => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setRoomId(targetRoomId);
      setIsHost(amIHost);
      setOpponent(oppObj);
      updateMatchQuestions(questionsArr);
      updateRoundIndex(0);
      setMyHp(6000);
      setOpponentHp(6000);
      myHpRef.current = 6000;
      opponentHpRef.current = 6000;
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      myPinRef.current = null;
      setMyLocked(false);
      myLockedRef.current = false;
      setOpponentLocked(false);
      setUrgentSeconds(null);
      setUrgentTriggeredBy(null);
      setRoundResult(null);
      roundSubmissionsRef.current = {};

      const channel = supabase.channel(`travel_battle_room_${targetRoomId}`, {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: playerId },
        },
      });

      // 注册所有广播监听 (代理到 handlersRef，保证永远执行最新逻辑)
      channel
        .on("broadcast", { event: "player_locked" }, ({ payload }) => {
          handlersRef.current.onPlayerLocked?.(payload);
        })
        .on("broadcast", { event: "round_submit" }, ({ payload }) => {
          handlersRef.current.onRoundSubmit?.(payload);
        })
        .on("broadcast", { event: "sync_next_round" }, ({ payload }) => {
          handlersRef.current.onSyncNextRound?.(payload);
        })
        .on("broadcast", { event: "start_game" }, ({ payload }) => {
          handlersRef.current.onStartGame?.(payload);
        })
        .on("broadcast", { event: "rematch_start" }, ({ payload }) => {
          handlersRef.current.onRematchStart?.(payload);
        })
        // 注册在场状态监听 (好友加入 / 房主发现好友 / 对手断线)
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          for (const key in state) {
            const item = state[key]?.[0];
            if (item && item.playerId !== playerId) {
              setOpponent({ id: item.playerId, name: item.playerName });
            }
          }
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          const opp = newPresences.find((p) => p.playerId !== playerId);
          if (opp) {
            setOpponent({ id: opp.playerId, name: opp.playerName });
          }
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          const oppLeft = leftPresences.some((p) => p.playerId !== playerId);
          if (oppLeft) {
            setOpponent(null);
            setGameState((curState) => {
              if (curState === "PLAYING" || curState === "ROUND_REVEAL") {
                alert("⚠️ 对手已退出对局！你获得了本场对战的胜利。");
                return "LOBBY";
              }
              return curState;
            });
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel.track({ playerId, playerName });
          }
        });

      channelRef.current = channel;
    },
    [playerId, playerName]
  );

  // ==========================================================================
  // 快速随机匹配机制 (Matchmaking Lobby)
  // ==========================================================================
  const startQuickMatch = () => {
    updateGameState("MATCHING");

    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }

    const lobby = supabase.channel("travel_battle_lobby", {
      config: { presence: { key: playerId } },
    });

    lobby
      .on("presence", { event: "sync" }, () => {
        const state = lobby.presenceState();
        const waitingPlayers = [];
        for (const key in state) {
          const item = state[key]?.[0];
          if (item && item.playerId) waitingPlayers.push(item);
        }

        // 当等待队列中有 2 名玩家时，决定谁当 Host 并撮合对局
        if (waitingPlayers.length >= 2) {
          waitingPlayers.sort((a, b) => a.playerId.localeCompare(b.playerId));
          const p1 = waitingPlayers[0];
          const p2 = waitingPlayers[1];

          if (playerId === p1.playerId) {
            const newRoomId = "duel_" + Math.random().toString(36).substring(2, 8);
            const qCount = matchModeRef.current === "HP" ? 30 : 10;
            const chosen = pickBattleQuestions(
              battleMediaModeRef.current,
              getActiveQuestionFilter(),
              qCount
            );
            const questionIds = chosen.map((q) => q.id);

            lobby.send({
              type: "broadcast",
              event: "match_found",
              payload: {
                roomId: newRoomId,
                hostId: p1.playerId,
                hostName: p1.playerName,
                guestId: p2.playerId,
                guestName: p2.playerName,
                questionIds,
                questions: chosen,
                matchMode: matchModeRef.current,
                battleMediaMode: battleMediaModeRef.current,
                movementAllowed: movementAllowedRef.current,
              },
            });

            supabase.removeChannel(lobby);
            lobbyChannelRef.current = null;
            setupRoomChannel(newRoomId, true, chosen, { id: p2.playerId, name: p2.playerName });
            updateGameState("PLAYING");
            handleResetMapView();
            sfx.playMatchFound();
          }
        }
      })
      .on("broadcast", { event: "match_found" }, ({ payload }) => {
        if (payload.guestId === playerId) {
          supabase.removeChannel(lobby);
          lobbyChannelRef.current = null;
          if (payload.matchMode) {
            setMatchMode(payload.matchMode);
            matchModeRef.current = payload.matchMode;
          }
          if (payload.battleMediaMode) {
            updateBattleMediaMode(payload.battleMediaMode);
          }
          if (payload.movementAllowed !== undefined) {
            updateMovementAllowed(payload.movementAllowed);
          }
          const qs = (payload.questions && payload.questions.length > 0)
            ? payload.questions
            : (payload.questionIds || [])
                .map((id) => findQuestionById(id))
                .filter(Boolean);
          setupRoomChannel(payload.roomId, false, qs, {
            id: payload.hostId,
            name: payload.hostName,
          });
          updateGameState("PLAYING");
          handleResetMapView();
          sfx.playMatchFound();
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          lobby.track({ playerId, playerName, joinedAt: Date.now() });
        }
      });

    lobbyChannelRef.current = lobby;
  };

  const cancelQuickMatch = () => {
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    updateGameState("LOBBY");
    setTimeout(() => {
      const target = document.getElementById("travel-game-section");
      if (target) {
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 60);
  };

  // ==========================================================================
  // 好友房间开黑机制 (Private Room Code)
  // ==========================================================================
  const createFriendRoom = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const qCount = matchModeRef.current === "HP" ? 30 : 10;
    const chosen = pickBattleQuestions(
      battleMediaModeRef.current,
      getActiveQuestionFilter(),
      qCount
    );
    matchQuestionsRef.current = chosen;
    setupRoomChannel(code, true, chosen, null);
    updateGameState("ROOM_WAITING");
  };

  const joinFriendRoom = () => {
    const code = inputRoomCode.trim();
    if (!code) {
      alert("请输入 6 位好友房间码");
      return;
    }
    setupRoomChannel(code, false, [], null);
    updateGameState("ROOM_WAITING");
  };

  const startFriendMatchAsHost = () => {
    if (!opponent) {
      alert("请等待好友加入房间后再开始！");
      return;
    }
    if (channelRef.current) {
      const qIds = matchQuestionsRef.current.map((q) => q.id);
      channelRef.current.send({
        type: "broadcast",
        event: "start_game",
        payload: {
          questionIds: qIds,
          questions: matchQuestionsRef.current,
          matchMode: matchModeRef.current,
          battleMediaMode: battleMediaModeRef.current,
          movementAllowed: movementAllowedRef.current,
        },
      });
      updateRoundIndex(0);
      setMyHp(6000);
      setOpponentHp(6000);
      myHpRef.current = 6000;
      opponentHpRef.current = 6000;
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      myPinRef.current = null;
      setMyLocked(false);
      myLockedRef.current = false;
      setOpponentLocked(false);
      setRoundResult(null);
      roundSubmissionsRef.current = {};
      updateGameState("PLAYING");
      handleResetMapView();
      sfx.playMatchFound();
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?duel=${roomId}#travel-game-section`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // 申请再来一局
  const handleRematch = () => {
    if (channelRef.current) {
      const qCount = matchModeRef.current === "HP" ? 30 : 10;
      const newQs = pickBattleQuestions(
        battleMediaModeRef.current,
        getActiveQuestionFilter(),
        qCount
      );
      const questionIds = newQs.map((q) => q.id);
      channelRef.current.send({
        type: "broadcast",
        event: "rematch_start",
        payload: {
          questionIds,
          questions: newQs,
          matchMode: matchModeRef.current,
          battleMediaMode: battleMediaModeRef.current,
          movementAllowed: movementAllowedRef.current,
        },
      });
      updateMatchQuestions(newQs);
      updateRoundIndex(0);
      setMyHp(6000);
      setOpponentHp(6000);
      myHpRef.current = 6000;
      opponentHpRef.current = 6000;
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      myPinRef.current = null;
      setMyLocked(false);
      myLockedRef.current = false;
      setOpponentLocked(false);
      setRoundResult(null);
      roundSubmissionsRef.current = {};
      updateGameState("PLAYING");
      handleResetMapView();
      sfx.playMatchFound();
    }
  };

  const returnToLobby = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    setIsImmersive(false);
    updateGameState("LOBBY");
    setRoomId("");
    setOpponent(null);
    updateMatchQuestions([]);
    updateRoundIndex(0);
    setMyTotalScore(0);
    setOpponentTotalScore(0);
    setMatchHistory([]);
    setMyPin(null);
    myPinRef.current = null;
    setMyLocked(false);
    myLockedRef.current = false;
    setOpponentLocked(false);
    setRoundResult(null);
    roundSubmissionsRef.current = {};

    // 确保返回大厅后，页面平滑滚动并锁定在实时对战游戏区域，杜绝跳到其他板块
    setTimeout(() => {
      const target = document.getElementById("travel-game-section");
      if (target) {
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 60);
  };

  const questionsList = matchQuestionsRef.current.length > 0 ? matchQuestionsRef.current : matchQuestions;
  const currentQ = questionsList[currentRoundIndex] || null;

  return (
    <div
      className={`battle-master-wrapper ${
        isImmersive &&
        (gameState === "PLAYING" ||
          gameState === "ROUND_REVEAL" ||
          gameState === "GAME_OVER")
          ? "immersive-mode"
          : ""
      } ${gameState === "GAME_OVER" ? "game-over" : ""}`}
    >
      {/* 顶部标题栏与题库选择 (对齐实景图寻与地图盲填) */}
      {gameState !== "PLAYING" &&
        gameState !== "ROUND_REVEAL" &&
        gameState !== "GAME_OVER" && (
        <div className="travel-game-header-row">
          <div className="travel-game-title-group">
            <h2 className="notes-hero-title">
              {battleMediaMode === "streetview" ? (
                <Globe2 className="notes-hero-icon" size={24} />
              ) : (
                <Swords className="notes-hero-icon" size={24} />
              )}
              <span className="game-hero-brand-text">GEO GUESS PK</span>
              <span className="notes-title-sub">
                {battleMediaMode === "streetview"
                  ? "全球 360° 街景 · 实时对决"
                  : "旅行图寻 · 实时对局"}
              </span>
            </h2>
            <p className="travel-game-subtitle">
              <Sparkles size={16} className="game-sub-icon" />
              <span>
                {battleMediaMode === "streetview"
                  ? "根据全球真实 360° 全景街景探索地理细节，双人实时同题对抗，决胜千里！"
                  : "根据真实旅拍照片探索地理细节，双人实时同题对抗，决胜千里！"}
              </span>
            </p>
          </div>

          {/* 顶部操作群组：玩家代号 + 音效切换 + 题库/区域分类选项卡 */}
          <div className="travel-game-header-actions">
            {/* 玩家当前代号胶囊 */}
            <div
              className="game-player-badge-pill"
              title="当前玩家代号 (点击可快速修改)"
              onClick={() => {
                const newName = prompt("请输入您的玩家代号或昵称：", playerName);
                if (newName !== null && newName.trim()) {
                  handlePlayerNameChange(newName.trim());
                }
              }}
            >
              <User size={13} className="player-badge-icon" />
              <span className="player-badge-name">{playerName}</span>
            </div>

            {/* 音效控制按钮 */}
            <button
              type="button"
              className="game-sound-toggle-btn"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "开启音效" : "静音"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* 题库 / 区域分类选项卡 */}
            <div className="travel-bank-tabs-wrapper">
              <span className="travel-bank-label">
                {battleMediaMode === "streetview" ? "区域:" : "题库:"}
              </span>
              <div className="travel-game-category-tabs">
                {battleMediaMode === "streetview" ? (
                  <>
                    <button
                      type="button"
                      className={`game-tab-btn ${streetViewRegion === "global" ? "active" : ""}`}
                      onClick={() => updateStreetViewRegion("global")}
                      title="全球各地海量 360° 真实街景 (国内 + 国外，全库收录 2,290+ 题并直连 150 万+ 全球开放全景池)"
                    >
                      全球
                    </button>
                    <button
                      type="button"
                      className={`game-tab-btn ${streetViewRegion === "domestic" ? "active" : ""}`}
                      onClick={() => updateStreetViewRegion("domestic")}
                      title="中国国内名胜、高校与城市街道 360° 真实街景 (涵盖全国各省市)"
                    >
                      国内
                    </button>
                    <button
                      type="button"
                      className={`game-tab-btn ${streetViewRegion === "international" ? "active" : ""}`}
                      onClick={() => updateStreetViewRegion("international")}
                      title="国外世界各大洲 360° 真实街景 (跨越欧亚美非各大名胜)"
                    >
                      国外
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`game-tab-btn ${authorFilter === "Xiao" ? "active" : ""}`}
                      onClick={() => setAuthorFilter("Xiao")}
                      title="Xiao 拍摄的照片 (共 4,365 张)"
                    >
                      Xiao
                    </button>
                    <button
                      type="button"
                      className={`game-tab-btn ${authorFilter === "Tang" ? "active" : ""}`}
                      onClick={() => setAuthorFilter("Tang")}
                      title="Tang 拍摄的照片 (共 502 张)"
                    >
                      Tang
                    </button>
                    <button
                      type="button"
                      className={`game-tab-btn ${authorFilter === "Xiao&Tang" ? "active" : ""}`}
                      onClick={() => setAuthorFilter("Xiao&Tang")}
                      title="Xiao 与 Tang 两人照片合集 (共 4,867 张)"
                    >
                      Xiao & Tang
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主游戏交互卡片容器 (1:1 对齐实景图寻 travel-game-card 样式) */}
      {(gameState === "LOBBY" || gameState === "MATCHING" || gameState === "ROOM_WAITING") && (
        <div className="travel-game-card">
          {/* ==================================================================
              阶段 1：对战大厅 (LOBBY)
              ================================================================== */}
          {gameState === "LOBBY" && (
            <div className="game-welcome-banner">
              <div className="game-welcome-content">
                <div className="game-welcome-badge">
                  <Swords size={15} />
                  <span>1v1 实时在线对战玩法</span>
                </div>
                <h3>欢迎来到双人图寻对决！</h3>
                <p className="game-welcome-desc">
                  {battleMediaMode === "streetview"
                    ? "基于全球真实 360° 全景街景，支持鼠标自由拖拽环视、俯仰观察与高倍滚轮变焦。在华为地图上插下您的图钉，率先交卷施加 15 秒绝杀倒计时，决胜千里！"
                    : "从真实旅程中精选实景照片，双人实时同题对抗。考验观察力与手速的时刻到了——在华为地图上插下您的图钉，率先交卷施加 15 秒绝杀倒计时，决胜千里！"}
                </p>

                {/* 对战媒介模式选择：360° 全球真实街景 VS 旅拍照片 */}
                <div className="battle-media-mode-switcher">
                  <button
                    type="button"
                    className={`media-mode-btn ${battleMediaMode === "streetview" ? "active" : ""}`}
                    onClick={() => updateBattleMediaMode("streetview")}
                  >
                    <Globe2 size={16} />
                    <span>🌐 360° 真实街景 PK (推荐 · 沉浸式图寻)</span>
                  </button>
                  <button
                    type="button"
                    className={`media-mode-btn ${battleMediaMode === "photo" ? "active" : ""}`}
                    onClick={() => updateBattleMediaMode("photo")}
                  >
                    <Camera size={16} />
                    <span>📸 旅拍照片对决 (Xiao & Tang)</span>
                  </button>
                </div>

                {/* 玩家昵称输入与赛制玩法选择卡片 (与实景图寻 game-player-setup-card 风格一致) */}
                <div className="game-player-setup-card battle-lobby-setup-card">
                  <div className="player-setup-left">
                    <div className="player-avatar-badge">
                      <User size={18} />
                    </div>
                    <div className="player-input-group">
                      <label htmlFor="battle-welcome-player-input">探险家昵称 / 玩家名称</label>
                      <input
                        id="battle-welcome-player-input"
                        type="text"
                        className="welcome-player-input"
                        placeholder="输入您的昵称 (默认: 探险家-XXXX)"
                        maxLength={16}
                        value={playerName}
                        onChange={(e) => handlePlayerNameChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 赛制玩法快速切换 */}
                  <div className="battle-lobby-rule-pills">
                    <button
                      type="button"
                      className={`battle-lobby-rule-pill ${matchMode === "HP" ? "active" : ""}`}
                      onClick={() => setMatchMode("HP")}
                      title="主流电竞赛制：初始 6000 血，按分差扣血淘汰"
                    >
                      <Swords size={14} />
                      <span>巅峰血量对决 (6000 HP)</span>
                    </button>
                    <button
                      type="button"
                      className={`battle-lobby-rule-pill ${matchMode === "POINTS" ? "active" : ""}`}
                      onClick={() => setMatchMode("POINTS")}
                      title="经典积分赛：10 题定胜负，累计总分高者获胜"
                    >
                      <Trophy size={14} />
                      <span>经典积分赛 (10 题)</span>
                    </button>
                  </div>
                </div>

                {/* 3步规则指引 (1:1 对齐实景图寻三栏数字方块) */}
                <div className="game-rules-grid">
                  <div className="game-rule-item">
                    <div className="rule-icon-box">1</div>
                    <div>
                      <strong>
                        {battleMediaMode === "streetview"
                          ? "360° 自由拖拽环视街景"
                          : "自由观察实景图片"}
                      </strong>
                      <p>
                        {battleMediaMode === "streetview"
                          ? "按住鼠标左键全方位拖拽观察周围路牌、建筑风格与自然风貌，滚轮放大细节。"
                          : "鼠标放在照片上滑动滚轮放大细节，判断照片所在拍摄位置。"}
                      </p>
                    </div>
                  </div>
                  <div className="game-rule-item">
                    <div className="rule-icon-box">2</div>
                    <div>
                      <strong>华为地图预测插旗</strong>
                      <p>在地图上插下预测图钉，率先交卷施加 15 秒绝杀倒计时！</p>
                    </div>
                  </div>
                  <div className="game-rule-item">
                    <div className="rule-icon-box">3</div>
                    <div>
                      <strong>
                        {matchMode === "HP" ? "实时伤害扣血竞技 (6000 HP)" : "实测距离积分挑战 (10 题)"}
                      </strong>
                      <p>
                        {matchMode === "HP"
                          ? "双方初始 6,000 血量按分差扣血，第 5 题起启动伤害倍率，直至一方淘汰！"
                          : "共 10 题定胜负，单题最高 5,000 分，累计总分高者获胜。"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 对战行动按钮组 */}
                <div className="game-welcome-actions battle-welcome-actions">
                  <button
                    type="button"
                    className="game-primary-btn start-btn"
                    onClick={startQuickMatch}
                  >
                    <Zap size={18} />
                    以「{playerName || "旅行探险家"}」开始快速对战
                  </button>

                  {/* 好友专属房间（单行清爽设计） */}
                  <div className="battle-lobby-friend-row">
                    <button
                      type="button"
                      className="battle-friend-btn"
                      onClick={createFriendRoom}
                    >
                      <Sparkles size={15} />
                      <span>创建私人房间</span>
                    </button>
                    <span className="battle-friend-divider">或</span>
                    <div className="battle-friend-join-group">
                      <input
                        type="text"
                        className="battle-friend-code-input"
                        placeholder="输入6位房间码"
                        value={inputRoomCode}
                        onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                        maxLength={6}
                      />
                      <button
                        type="button"
                        className="battle-room-join-btn"
                        onClick={joinFriendRoom}
                      >
                        加入
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              阶段 2：快速匹配中 (MATCHING)
              ================================================================== */}
          {gameState === "MATCHING" && (
            <div className="game-welcome-banner">
              <div className="game-welcome-content">
                <div className="battle-matching-overlay">
                  <div className="battle-radar-circle">
                    <Zap size={36} color="#7c3aed" />
                  </div>
                  <h3 style={{ fontSize: "1.6rem", fontWeight: 900, marginBottom: "8px" }}>
                    正在寻找对手...
                  </h3>
                  <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "28px" }}>
                    已连接至在线匹配大厅，请保持页面开启，匹配成功将自动开启对决
                  </p>
                  <button
                    type="button"
                    className="game-secondary-btn"
                    style={{ padding: "10px 28px", fontSize: "0.95rem" }}
                    onClick={cancelQuickMatch}
                  >
                    取消匹配
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              阶段 3：好友房间等待中 (ROOM_WAITING)
              ================================================================== */}
          {gameState === "ROOM_WAITING" && (
            <div className="game-welcome-banner">
              <div className="game-welcome-content">
                <div className="game-welcome-badge">
                  <Users size={15} />
                  <span>专属房间: {roomId}</span>
                </div>
                <h3 style={{ fontSize: "1.7rem", fontWeight: 900, marginBottom: "12px" }}>
                  {isHost ? "邀请好友加入对局" : "已加入房间，等待房主开始"}
                </h3>

                {isHost && (
                  <div style={{ marginBottom: "24px" }}>
                    <p style={{ color: "#64748b", marginBottom: "16px", fontSize: "0.95rem" }}>
                      复制下方链接发送给好友，对方点击即可直达本房间：
                    </p>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "#f1f5f9",
                        padding: "8px 16px",
                        borderRadius: "12px",
                        border: "1.5px solid #e2e8f0",
                      }}
                    >
                      <span style={{ fontSize: "1.3rem", fontWeight: 900, letterSpacing: "0.1em" }}>
                        {roomId}
                      </span>
                      <button
                        type="button"
                        className="game-primary-btn"
                        style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                        onClick={copyInviteLink}
                      >
                        {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                        {copiedLink ? "已复制链接" : "复制邀请链接"}
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "24px",
                    margin: "24px 0 32px 0",
                    flexWrap: "wrap",
                  }}
                >
                  <div className="battle-player-pill" style={{ padding: "10px 20px" }}>
                    <UserCheck size={18} color="#16a34a" /> 房主: {playerName} (你)
                  </div>
                  <div className="battle-player-pill" style={{ padding: "10px 20px" }}>
                    {opponent ? (
                      <>
                        <UserCheck size={18} color="#7c3aed" /> 对手: {opponent.name} (已就绪)
                      </>
                    ) : (
                      <>
                        <Clock size={18} color="#94a3b8" /> 等待好友加入...
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                  {isHost ? (
                    <button
                      type="button"
                      className="game-primary-btn"
                      style={{ padding: "12px 28px" }}
                      disabled={!opponent}
                      onClick={startFriendMatchAsHost}
                    >
                      <Swords size={18} /> 开始对决
                    </button>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: "0.95rem", alignSelf: "center" }}>
                      已就绪，正在等待房主点击开始...
                    </div>
                  )}
                  <button
                    type="button"
                    className="game-secondary-btn"
                    style={{ padding: "12px 24px" }}
                    onClick={returnToLobby}
                  >
                    退出房间
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          阶段 4 & 5：对战进行中 (PLAYING) 与 回合揭晓 (ROUND_REVEAL)
          ================================================================== */}
      {(gameState === "PLAYING" || gameState === "ROUND_REVEAL") && currentQ && (
        <div className="battle-play-area">
          {/* 电竞级 1v1 对决顶栏 (HUD - 极简平铺架构：两侧无框平铺展开，中央 3 键位于轮次上方) */}
          <div className="battle-esports-hud">
            {/* 左侧：我方 (YOU) 平铺排布 */}
            <div className="battle-hud-flat-combatant you">
              <div className="combatant-avatar-box">
                <div className="combatant-avatar you">
                  <div className="avatar-ring you" />
                  <Crown size={22} className="avatar-badge-icon" />
                  <span className="avatar-role-tag you">我方</span>
                </div>
                {myLocked && <div className="combatant-locked-dot" title="已锁定" />}
              </div>
              <div className="combatant-meta">
                <div className="combatant-name-row">
                  <span className="combatant-name" title={playerName}>{playerName}</span>
                  <span className={`combatant-status ${myLocked ? "locked" : "thinking"}`}>
                    {myLocked ? "已锁定" : "答题中"}
                  </span>
                </div>

                {matchMode === "HP" ? (
                  <div className="combatant-hp-row">
                    <div className="combatant-hp-text you">
                      <Heart size={12} fill="#d97706" color="#d97706" />
                      <span className="hp-val-cur">{myHp}</span>
                      <span className="hp-val-sep">/</span>
                      <span className="hp-val-max">6000</span>
                      <span className="hp-val-unit">HP</span>
                    </div>
                    <div className="combatant-hp-track">
                      <div
                        className={`combatant-hp-fill ${myHp > 3500 ? "healthy" : myHp > 1500 ? "warning" : "danger"}`}
                        style={{ width: `${Math.max(0, Math.min(100, (myHp / 6000) * 100))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="combatant-score you">{myTotalScore.toLocaleString()} 分</div>
                )}
              </div>
            </div>

            {/* 中央：操作按钮在上方，轮次与倍率在下方 (绝杀倒计时触发时原地高能切换) */}
            <div className="battle-hud-center-arena">
              {urgentSeconds !== null && gameState === "PLAYING" ? (
                <div className="battle-hud-urgent-countdown">
                  <div className="urgent-top-line">
                    <div className="urgent-meta-wrap">
                      <ShieldAlert size={15} color="#ef4444" />
                      <span className="urgent-hazard-tag">ALERT</span>
                      <span className="urgent-title-text">
                        {urgentTriggeredBy === "opponent" ? "对手率先交卷！绝杀倒计时" : "我方率先交卷！对手倒计时"}
                      </span>
                    </div>
                    <div className="urgent-neon-clock">{urgentSeconds}s</div>
                  </div>
                  <div className="urgent-laser-track">
                    <div
                      className="urgent-laser-fill"
                      style={{ width: `${Math.max(0, Math.min(100, (urgentSeconds / 15) * 100))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="battle-hud-center-stack">
                  {/* 控制按钮组 (全屏切换、静音、退出) 放置在轮次上方 */}
                  <div className="battle-hud-center-tools">
                    <button
                      type="button"
                      className="battle-center-btn"
                      onClick={() => setIsImmersive((prev) => !prev)}
                      title={isImmersive ? "退出全屏对战" : "进入全屏对战"}
                    >
                      {isImmersive ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                      type="button"
                      className="battle-center-btn"
                      onClick={() => setIsMuted((prev) => !prev)}
                      title={isMuted ? "开启音效" : "静音"}
                    >
                      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <button
                      type="button"
                      className="battle-center-btn exit"
                      onClick={() => {
                        if (window.confirm("确定要离开当前对局返回大厅吗？")) {
                          returnToLobby();
                        }
                      }}
                      title="离开房间"
                    >
                      <Home size={14} />
                    </button>
                  </div>

                  {/* 下方：轮次与倍率胶囊 */}
                  <div className="duel-match-hub">
                    <div className="duel-round-pill">
                      <Sparkles size={12} color="#f59e0b" />
                      <span className="round-prefix">ROUND</span>
                      <span className="round-number">{currentRoundIndex + 1}</span>
                      {matchMode === "POINTS" && (
                        <span className="round-total">/{matchQuestionsRef.current.length || matchQuestions.length || 10}</span>
                      )}
                    </div>
                    {matchMode === "HP" ? (
                      (() => {
                        const mult = getRoundMultiplier(currentRoundIndex);
                        return (
                          <div className={`duel-multiplier-chip ${mult > 1.0 ? "boosted" : "normal"}`}>
                            {mult > 1.0 ? <Flame size={12} color="#ef4444" /> : <Zap size={12} />}
                            <span>{mult.toFixed(1)}x {mult > 1.0 ? "绝杀倍率" : "常规倍率"}</span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="duel-points-pill">10 题经典赛</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：敌方 (RIVAL) 平铺排布 (镜像对称) */}
            <div className="battle-hud-flat-combatant opp">
              <div className="combatant-avatar-box">
                <div className="combatant-avatar opp">
                  <div className="avatar-ring opp" />
                  <Swords size={22} className="avatar-badge-icon" />
                  <span className="avatar-role-tag opp">对手</span>
                </div>
                {opponentLocked && <div className="combatant-locked-dot" title="对手已交卷" />}
              </div>
              <div className="combatant-meta opp">
                <div className="combatant-name-row opp">
                  <span className="combatant-name" title={opponent?.name || "对手"}>
                    {opponent?.name || "对手"}
                  </span>
                  <span className={`combatant-status ${opponentLocked ? "locked" : "thinking"}`}>
                    {opponentLocked ? "已锁定" : "思考中"}
                  </span>
                </div>

                {matchMode === "HP" ? (
                  <div className="combatant-hp-row opp">
                    <div className="combatant-hp-track">
                      <div
                        className={`combatant-hp-fill ${opponentHp > 3500 ? "healthy" : opponentHp > 1500 ? "warning" : "danger"}`}
                        style={{ width: `${Math.max(0, Math.min(100, (opponentHp / 6000) * 100))}%` }}
                      />
                    </div>
                    <div className="combatant-hp-text opp" style={{ justifyContent: "flex-end" }}>
                      <Heart size={12} fill="#7c3aed" color="#7c3aed" />
                      <span className="hp-val-cur">{opponentHp}</span>
                      <span className="hp-val-sep">/</span>
                      <span className="hp-val-max">6000</span>
                      <span className="hp-val-unit">HP</span>
                    </div>
                  </div>
                ) : (
                  <div className="combatant-score opp">{opponentTotalScore.toLocaleString()} 分</div>
                )}
              </div>
            </div>
          </div>

          {/* 核心分屏游戏区 */}
          <div className="battle-play-grid">
            {/* 视觉展示区：支持 360° 球面全景或旅拍照片滚轮变焦 */}
            <div className="battle-photo-container">
              {battleMediaMode === "streetview" ? (
                <StreetViewViewer
                  panoUrl={currentQ?.panoUrl}
                  initialHeading={currentQ?.initialHeading || 0}
                />
              ) : (
                <BattlePhotoZoomer
                  photoUrl={currentQ?.photoUrl}
                  photoUrlHd={currentQ?.photoUrlHd}
                  alt="对决实景照片"
                />
              )}
            </div>

            {/* 交互地图选点区 */}
            <div className="battle-map-container">
              <div
                ref={mapContainerRef}
                className={`battle-leaflet-map ${gameState === "PLAYING" && !myLocked ? "crosshair-cursor" : ""}`}
              />

              {/* 实景图寻同款：顶部浮动准星指示徽标 */}
              {gameState === "PLAYING" && !myLocked && (
                <div className="battle-map-pin-hint-badge">
                  <Crosshair size={13} />
                  <span>{myPin ? "点击地图可更换标注位置" : "点击地图任意位置标出预测地点"}</span>
                </div>
              )}

              {/* 地图右上角快捷控制按钮区：复位欧洲视角 */}
              {gameState === "PLAYING" && (
                <div className="battle-map-overlay-controls">
                  <button
                    type="button"
                    className="battle-map-overlay-btn"
                    onClick={handleResetMapView}
                    title="复位地图视角"
                  >
                    <RotateCcw size={14} />
                    <span>复位视角</span>
                  </button>
                </div>
              )}

              {/* 确认提交按钮 (居中极简悬浮，移除了冗余提示黑框) */}
              {gameState === "PLAYING" && (
                <div className="battle-map-bottom-bar">
                  <button
                    type="button"
                    className={`battle-submit-btn ${myLocked ? "locked" : ""}`}
                    disabled={!myPin || myLocked}
                    onClick={handleLockInGuess}
                  >
                    {myLocked ? (
                      <>
                        <Check size={20} /> 已锁定答案 (等待对手)
                      </>
                    ) : (
                      <>
                        <Check size={20} /> 确认提交锁定
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 回合结算揭晓悬浮卡片 (ROUND_REVEAL - 零下移滚动，悬浮停靠在画面底部中央) */}
          {gameState === "ROUND_REVEAL" && roundResult && (() => {
            const myScore = roundResult.myGuess?.score ?? 0;
            const oppScore = roundResult.oppGuess?.score ?? 0;
            const verdict = myScore > oppScore ? "win" : myScore < oppScore ? "lose" : "tie";
            const verdictText =
              verdict === "win"
                ? "🎉 本回合获胜！"
                : verdict === "lose"
                ? "⚠️ 本回合惜败"
                : "🤝 势均力敌 (平局)";

            const isHpMode = matchMode === "HP";
            const damage = roundResult.damage ?? 0;
            const multiplier = roundResult.multiplier ?? 1.0;
            const isKo = roundResult.isKo ?? false;

            return (
              <div className="battle-reveal-overlay-card">
                {/* 左侧：目标地与战况战损 */}
                <div className="reveal-left-col">
                  <div className="reveal-location-header">
                    <CountryFlag countryName={roundResult.targetCountry} size={34} />
                    <div className="reveal-place-text">
                      <span className="reveal-place-sub">真实拍摄地点</span>
                      <span className="reveal-place-title">
                        {roundResult.targetCountry} · {roundResult.targetCity}
                      </span>
                    </div>
                  </div>

                  {/* 战果横幅 */}
                  <div className={`reveal-combat-banner ${isKo ? "ko" : verdict}`}>
                    {isKo ? (
                      <>
                        <span className="banner-icon">⚡</span>
                        <div className="banner-text-wrap">
                          <span className="banner-title">绝杀 K.O. 判定！</span>
                          <span className="banner-sub">
                            {verdict === "win" ? "对手血量见底，你获得了胜利！" : "我方血量见底，对决终结"}
                          </span>
                        </div>
                      </>
                    ) : verdict === "win" ? (
                      <>
                        <span className="banner-icon">🏆</span>
                        <div className="banner-text-wrap">
                          <span className="banner-title">本回合胜利</span>
                          {isHpMode ? (
                            <span className="banner-sub">
                              对手受到 {damage} HP 伤害 (倍率{multiplier.toFixed(1)}x)
                            </span>
                          ) : (
                            <span className="banner-sub">本回合领先 {myScore - oppScore} 分</span>
                          )}
                        </div>
                      </>
                    ) : verdict === "lose" ? (
                      <>
                        <span className="banner-icon">⚔️</span>
                        <div className="banner-text-wrap">
                          <span className="banner-title">本回合失败</span>
                          {isHpMode ? (
                            <span className="banner-sub">
                              我方受到 {damage} HP 伤害 (倍率{multiplier.toFixed(1)}x)
                            </span>
                          ) : (
                            <span className="banner-sub">本回合落后 {oppScore - myScore} 分</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="banner-icon">🛡️</span>
                        <div className="banner-text-wrap">
                          <span className="banner-title">势均力敌</span>
                          <span className="banner-sub">双方平局 (0 伤害)</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 中间：双雄数据对比竞技场 */}
                <div className="reveal-showdown-arena">
                  {/* 我方战绩 */}
                  <div className={`showdown-fighter you ${myScore > oppScore ? "winner" : ""}`}>
                    <div className="fighter-head">
                      <span className="fighter-badge you">我方</span>
                      <span className="fighter-name" title={playerName}>{playerName}</span>
                    </div>
                    <div className="fighter-score you">
                      <span className="score-prefix">+</span>
                      <span className="score-val">{myScore.toLocaleString()}</span>
                      <span className="score-unit">分</span>
                    </div>
                    <div className="fighter-meta">
                      <span className="fighter-dist">误差 {formatDistance(roundResult.myGuess.dist)}</span>
                      {isHpMode && (
                        <span className="fighter-hp you">
                          <Heart size={10} fill="#f59e0b" color="#f59e0b" />
                          剩余血量 {roundResult.myHp ?? myHp} HP
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 中间 VS 决斗标 */}
                  <div className="showdown-vs-column">
                    <div className="vs-badge-circle">VS</div>
                    {isHpMode && <span className="vs-mult-pill">{multiplier.toFixed(1)}x</span>}
                  </div>

                  {/* 敌方战绩 */}
                  <div className={`showdown-fighter opp ${oppScore > myScore ? "winner" : ""}`}>
                    <div className="fighter-head opp">
                      <span className="fighter-name" title={opponent?.name || "对手"}>{opponent?.name || "对手"}</span>
                      <span className="fighter-badge opp">对手</span>
                    </div>
                    <div className="fighter-score opp">
                      <span className="score-prefix">+</span>
                      <span className="score-val">{oppScore.toLocaleString()}</span>
                      <span className="score-unit">分</span>
                    </div>
                    <div className="fighter-meta opp">
                      <span className="fighter-dist">误差 {formatDistance(roundResult.oppGuess.dist)}</span>
                      {isHpMode && (
                        <span className="fighter-hp opp">
                          <Heart size={10} fill="#7c3aed" color="#7c3aed" />
                          剩余血量 {roundResult.oppHp ?? opponentHp} HP
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右侧：下一题操作按钮 */}
                <button
                  type="button"
                  className="battle-reveal-next-btn"
                  onClick={handleNextRound}
                >
                  <span>
                    {isKo
                      ? "查看终局胜负 (K.O.)"
                      : isHpMode
                      ? `进入第 ${currentRoundIndex + 2} 题`
                      : currentRoundIndex + 1 < (matchQuestionsRef.current.length || matchQuestions.length || 10)
                      ? `进入第 ${currentRoundIndex + 2} 题`
                      : "查看最终赛果"}
                  </span>
                  {autoAdvanceSec !== null && (
                    <span className="reveal-auto-countdown">{autoAdvanceSec}s</span>
                  )}
                  <ArrowRight size={18} />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ==================================================================
          阶段 6：终局大结算 (GAME_OVER)
          ================================================================== */}
      {gameState === "GAME_OVER" && (
        <div className="battle-gameover-card">
          {matchMode === "HP" ? (
            (() => {
              const youWon = opponentHp <= 0 || myHp > opponentHp;
              const tie = myHp === opponentHp;
              return (
                <>
                  <div className="battle-victory-trophy">
                    {youWon ? "🏆" : tie ? "🤝" : "⚔️"}
                  </div>

                  <h2
                    className={`battle-victory-title ${youWon ? "win" : tie ? "tie" : "lose"}`}
                  >
                    {youWon ? "K.O. 绝杀胜出！VICTORY" : tie ? "势均力敌！DRAW" : "K.O. 棋差一招！DEFEAT"}
                  </h2>

                  <p className="battle-victory-subtitle">
                    历经 {matchHistory.length} 轮惊险刺激的 6000 HP 扣血淘汰赛，巅峰决战最终赛果如下：
                  </p>

                  <div className="battle-total-score-box">
                    <div className="battle-total-card you">
                      <span className="label">我方剩余血量 ({playerName})</span>
                      <span className="val" style={{ color: youWon ? "#16a34a" : "#dc2626" }}>
                        {myHp.toLocaleString()} <span style={{ fontSize: "1.1rem" }}>HP</span>
                      </span>
                    </div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#cbd5e1" }}>VS</div>
                    <div className="battle-total-card opponent">
                      <span className="label">敌方剩余血量 ({opponent?.name || "对手"})</span>
                      <span className="val" style={{ color: opponentHp <= 0 ? "#dc2626" : "#7c3aed" }}>
                        {opponentHp.toLocaleString()} <span style={{ fontSize: "1.1rem" }}>HP</span>
                      </span>
                    </div>
                  </div>

                  {/* 详细逐题伤害复盘列表 */}
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 800, textAlign: "left", marginBottom: "14px" }}>
                    对决逐题伤害复盘 ({matchHistory.length} 轮)
                  </h4>
                  <div className="battle-review-table-wrapper">
                    <table className="battle-review-table">
                      <thead>
                        <tr>
                          <th>回合</th>
                          <th>目标城市</th>
                          <th>我方得分 / 误差</th>
                          <th>敌方得分 / 误差</th>
                          <th>伤害结算 (倍率)</th>
                          <th>战局走向</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchHistory.map((item, idx) => {
                          const youWonRound = item.myGuess.score > item.oppGuess.score;
                          const tieRound = item.myGuess.score === item.oppGuess.score;
                          const mult = item.multiplier ?? 1.0;
                          const dmg = item.damage ?? 0;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 800 }}>第 {idx + 1} 题</td>
                              <td className="target-city-col">
                                <div className="target-city-inner">
                                  <CountryFlag countryName={item.targetCountry} size={20} />
                                  <span>{item.targetCountry} · {item.targetCity}</span>
                                </div>
                              </td>
                              <td style={{ color: "#d97706", fontWeight: 700 }}>
                                +{item.myGuess.score}分 ({formatDistance(item.myGuess.dist)})
                              </td>
                              <td style={{ color: "#7c3aed", fontWeight: 700 }}>
                                +{item.oppGuess.score}分 ({formatDistance(item.oppGuess.dist)})
                              </td>
                              <td style={{ fontWeight: 800 }}>
                                {youWonRound ? (
                                  <span style={{ color: "#16a34a" }}>💥 对手受到 {dmg} HP 伤害 (倍率{mult.toFixed(1)}x)</span>
                                ) : tieRound ? (
                                  <span style={{ color: "#64748b" }}>0 伤害 (平局)</span>
                                ) : (
                                  <span style={{ color: "#dc2626" }}>💔 我方受到 {dmg} HP 伤害 (倍率{mult.toFixed(1)}x)</span>
                                )}
                              </td>
                              <td>
                                {youWonRound ? (
                                  <span style={{ color: "#16a34a", fontWeight: 800 }}>🏆 我方胜出</span>
                                ) : tieRound ? (
                                  <span style={{ color: "#64748b", fontWeight: 700 }}>平局</span>
                                ) : (
                                  <span style={{ color: "#dc2626", fontWeight: 700 }}>敌方胜出</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <div className="battle-victory-trophy">
                {myTotalScore > opponentTotalScore ? "🏆" : myTotalScore < opponentTotalScore ? "⚔️" : "🤝"}
              </div>

              <h2
                className={`battle-victory-title ${
                  myTotalScore > opponentTotalScore
                    ? "win"
                    : myTotalScore < opponentTotalScore
                    ? "lose"
                    : "tie"
                }`}
              >
                {myTotalScore > opponentTotalScore
                  ? "大获全胜！VICTORY"
                  : myTotalScore < opponentTotalScore
                  ? "棋差一招！DEFEAT"
                  : "势均力敌！DRAW"}
              </h2>

              <p className="battle-victory-subtitle">
                10 回合 Tang 欧洲纪行图寻对决全部结束，总分累计如下：
              </p>

              <div className="battle-total-score-box">
                <div className="battle-total-card you">
                  <span className="label">我方总积分 ({playerName})</span>
                  <span className="val">{myTotalScore.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#cbd5e1" }}>VS</div>
                <div className="battle-total-card opponent">
                  <span className="label">敌方总积分 ({opponent?.name || "对手"})</span>
                  <span className="val">{opponentTotalScore.toLocaleString()}</span>
                </div>
              </div>

              {/* 10 题复盘列表 */}
              <h4 style={{ fontSize: "1.1rem", fontWeight: 800, textAlign: "left", marginBottom: "14px" }}>
                对决逐题详细复盘 (10 题)
              </h4>
              <div className="battle-review-table-wrapper">
                <table className="battle-review-table">
                  <thead>
                    <tr>
                      <th>回合</th>
                      <th>目标城市</th>
                      <th>你的误差 / 得分</th>
                      <th>对手误差 / 得分</th>
                      <th>回合结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchHistory.map((item, idx) => {
                      const youWon = item.myGuess.score > item.oppGuess.score;
                      const tie = item.myGuess.score === item.oppGuess.score;
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 800 }}>第 {idx + 1} 题</td>
                          <td className="target-city-col">
                            <div className="target-city-inner">
                              <CountryFlag countryName={item.targetCountry} size={20} />
                              <span>{item.targetCountry} · {item.targetCity}</span>
                            </div>
                          </td>
                          <td style={{ color: "#d97706", fontWeight: 700 }}>
                            {formatDistance(item.myGuess.dist)} (+{item.myGuess.score}分)
                          </td>
                          <td style={{ color: "#7c3aed", fontWeight: 700 }}>
                            {formatDistance(item.oppGuess.dist)} (+{item.oppGuess.score}分)
                          </td>
                          <td>
                            {youWon ? (
                              <span style={{ color: "#16a34a", fontWeight: 800 }}>🏆 你胜出</span>
                            ) : tie ? (
                              <span style={{ color: "#64748b", fontWeight: 700 }}>平局</span>
                            ) : (
                              <span style={{ color: "#7c3aed", fontWeight: 700 }}>对手胜出</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="battle-gameover-actions">
            <button
              type="button"
              className="battle-action-btn primary"
              style={{ maxWidth: "220px" }}
              onClick={handleRematch}
            >
              <RotateCcw size={18} /> 再战一局
            </button>
            <button
              type="button"
              className="battle-action-btn secondary"
              style={{ maxWidth: "200px" }}
              onClick={returnToLobby}
            >
              <Home size={18} /> 返回对战大厅
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
