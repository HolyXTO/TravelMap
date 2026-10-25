import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  RotateCcw,
  Trophy,
  Sparkles,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Globe,
  Compass,
  Award,
  ArrowRight,
  RefreshCw,
  Navigation,
  Crosshair,
  Clock,
  User,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Medal,
} from "lucide-react";
import gameData from "./data/guessGameData.json";
import initialLeaderboards from "./data/initialLeaderboards.json";
import { supabase } from "./lib/supabase";

// Calculate Great Circle Distance in KM using Haversine formula (precise with decimal precision)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Official GeoGuessr scoring algorithm
// Mathematical Formula: Score = round(5000 * exp(-10 * d / D))
// Parameters:
// - d: geodesic distance in kilometers (calculated via Haversine formula)
// - D: map scale parameter in kilometers
//      * Global (全球): 14,916.862 km (official GeoGuessr World Map constant)
//      * Domestic (国内 - 中国): 5,200 km (China territory bounding box diagonal)
//      * Foreign (国外): 7,500 km (destinations bounding scale across Europe & Middle East)
// - Perfect 5K Buffer:
//      * Global: <= 150 meters (0.15 km) yields maximum 5,000 points
//      * Domestic: <= 25 meters (0.025 km) yields maximum 5,000 points
//      * Foreign: <= 50 meters (0.05 km) yields maximum 5,000 points
function calculateGeoScore(distanceKm, category = "global") {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;

  // Perfect score threshold (5,000 points buffer)
  let perfectThreshold = 0.15; // 150m for world
  let D = 14916.862; // GeoGuessr standard World map parameter (km)

  if (category === "domestic") {
    perfectThreshold = 0.025; // 25m for domestic map
    D = 5200.0; // China bounding box diagonal (km)
  } else if (category === "foreign") {
    perfectThreshold = 0.05; // 50m for foreign map
    D = 14916.862; // Worldwide foreign destinations scale (spanning Europe, Asia, Oceania)
  }

  if (distanceKm <= perfectThreshold) {
    return 5000;
  }

  if (distanceKm >= D) {
    return 0;
  }

  const rawScore = 5000 * Math.exp((-10 * distanceKm) / D);
  const score = Math.round(rawScore);
  return Math.max(0, Math.min(5000, score));
}

// Strict distance feedback based purely on precision (km / meters)
// Note: Evaluates distance error objectively without administrative boundary assertions.
function getDistanceFeedback(distKm) {
  if (distKm <= 0.15) {
    return {
      status: "correct",
      title: "🎯 完美命中！分毫不差",
      subtitle: "实测误差在 150 米以内，达成满分级极高精度",
    };
  }
  if (distKm <= 2.0) {
    return {
      status: "correct",
      title: "🎯 极度精准！令人惊叹",
      subtitle: "实测误差在 2 公里以内，定位极为精确",
    };
  }
  if (distKm <= 25.0) {
    return {
      status: "correct",
      title: "🌟 非常接近！绝佳判断",
      subtitle: "实测误差在 25 公里以内，定位非常准",
    };
  }
  if (distKm <= 100.0) {
    return {
      status: "close",
      title: "👍 比较接近！方向良好",
      subtitle: "实测误差在 100 公里以内，把握住了关键地理特征",
    };
  }
  if (distKm <= 500.0) {
    return {
      status: "close",
      title: "🧭 略有偏差！继续加油",
      subtitle: "实测误差在 500 公里以内，大致方位基本吻合",
    };
  }
  if (distKm <= 2000.0) {
    return {
      status: "incorrect",
      title: "✈️ 偏差较大！",
      subtitle: "实测误差超出千公里，偏离目标位置较远",
    };
  }
  return {
    status: "incorrect",
    title: "❌ 偏差巨大！",
    subtitle: "实测误差数千公里，相隔遥远",
  };
}

// Format distance error string (meters or km)
function formatDistance(distKm) {
  if (distKm === null || distKm === undefined) return "0 米";
  if (distKm < 1.0) {
    const meters = Math.max(1, Math.round(distKm * 1000));
    return `${meters} 米`;
  }
  if (distKm < 100) {
    return `${distKm.toFixed(1)} 公里`;
  }
  return `${Math.round(distKm)} 公里`;
}

// Format timestamp into Beijing Time (UTC+8, Asia/Shanghai) in "YYYY-MM-DD HH:mm"
function formatBeijingTime(dateStr) {
  if (!dateStr) return "近期";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return String(dateStr).slice(0, 16).replace("T", " ");
    }
    const formatter = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value || "";
    const m = parts.find((p) => p.type === "month")?.value || "";
    const day = parts.find((p) => p.type === "day")?.value || "";
    let h = parts.find((p) => p.type === "hour")?.value || "";
    if (h === "24") h = "00";
    const min = parts.find((p) => p.type === "minute")?.value || "";
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch (e) {
    return String(dateStr).slice(0, 16).replace("T", " ");
  }
}

// Country flag URL resolver
function getCountryFlagUrl(countryName) {
  if (!countryName) return "";
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}flags/circle-195/${encodeURIComponent(countryName)}.png`;
}

// Fisher-Yates (Knuth) Unbiased Shuffle Algorithm
function fisherYatesShuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Session-level unplayed deck management for strictly equal photo probability and zero repetition
const DECK_STORAGE_VERSION = "v11_";
const DECK_STORAGE_KEY_PREFIX = `travel_guess_deck_${DECK_STORAGE_VERSION}`;

// Purge any stale deck caches from older versions (v1, v2, ..., v10, etc.)
function cleanupStaleDecks() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("travel_guess_deck_") && !key.startsWith(DECK_STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {
    // Ignore storage errors
  }
}

function getOrInitDeck(category, allQuestions) {
  cleanupStaleDecks();

  let pool = allQuestions;
  if (category === "domestic") {
    pool = allQuestions.filter((q) => q.region === "domestic");
  } else if (category === "foreign") {
    pool = allQuestions.filter((q) => q.region === "foreign");
  }

  const poolIds = pool.map((q) => q.id);
  const poolIdSet = new Set(poolIds);
  const storageKey = `${DECK_STORAGE_KEY_PREFIX}${category}_${pool.length}`;

  // Try reading from sessionStorage
  try {
    const storedJson = sessionStorage.getItem(storageKey);
    if (storedJson) {
      const storedDeck = JSON.parse(storedJson);
      if (Array.isArray(storedDeck)) {
        // Keep valid unplayed IDs
        const validDeck = storedDeck.filter((id) => poolIdSet.has(id));
        if (validDeck.length > 0) {
          return validDeck;
        }
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }

  // Reshuffle the entire pool uniformly with Fisher-Yates algorithm
  const newDeck = fisherYatesShuffle(poolIds);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(newDeck));
  } catch (e) {}
  return newDeck;
}

// Draw 10 questions with strict equal probability, continuous replenishing deck cycle, and city diversity
function generateRoundQuestions(category, allQuestions) {
  let pool = allQuestions;
  if (category === "domestic") {
    pool = allQuestions.filter((q) => q.region === "domestic");
  } else if (category === "foreign") {
    pool = allQuestions.filter((q) => q.region === "foreign");
  }

  const poolIds = pool.map((q) => q.id);
  const questionMap = new Map(pool.map((q) => [q.id, q]));
  const storageKey = `${DECK_STORAGE_KEY_PREFIX}${category}_${pool.length}`;

  let deck = getOrInitDeck(category, allQuestions);

  // If remaining cards in deck are fewer than 10, continuously replenish by appending a newly shuffled cycle
  // (Zero cards discarded: every single photo in the pool is played before repeating)
  if (deck.length < 10) {
    deck = [...deck, ...fisherYatesShuffle(poolIds)];
  }

  // Draw 10 items from top of deck, enforcing max 2 photos per city within the single 10-question round
  const selectedQuestions = [];
  const cityCount = new Map();
  const skippedForThisRound = [];

  while (selectedQuestions.length < 10 && deck.length > 0) {
    const qId = deck.shift();
    const q = questionMap.get(qId);
    if (q) {
      const cCityCount = cityCount.get(q.cityId) || 0;
      if (cCityCount < 2) {
        selectedQuestions.push(q);
        cityCount.set(q.cityId, cCityCount + 1);
        continue;
      }
    }
    // Skipped solely due to city quota in this single round
    skippedForThisRound.push(qId);
  }

  // If deck ran out before reaching 10 (fallback fill from skipped cards)
  while (selectedQuestions.length < 10 && skippedForThisRound.length > 0) {
    const qId = skippedForThisRound.shift();
    const q = questionMap.get(qId);
    if (q) {
      selectedQuestions.push(q);
    }
  }

  // Append skipped cards to the back of the deck so they don't bunch up in the next round
  deck = [...deck, ...skippedForThisRound];

  // Update sessionStorage with remaining deck
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(deck));
  } catch (e) {}

  return fisherYatesShuffle(selectedQuestions);
}

// =========================================================================
// Interactive Photo Zoomer with Correct Center-Relative Wheel Zoom & Pan
// =========================================================================
function InteractivePhotoZoomer({ photoUrl, photoUrlHd, alt }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1.0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const translateStartRef = useRef({ x: 0, y: 0 });
  const [isHdLoaded, setIsHdLoaded] = useState(false);

  // Preload 4K HD photo in background
  useEffect(() => {
    setIsHdLoaded(false);
    setScale(1.0);
    setTranslate({ x: 0, y: 0 });

    if (!photoUrlHd) return;
    const img = new Image();
    img.src = photoUrlHd;
    img.onload = () => setIsHdLoaded(true);
  }, [photoUrl, photoUrlHd]);

  // Non-passive wheel listener with center-relative anchor math
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

      // Cursor offset from center of viewport
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

          // Clamping bounds to prevent photo from leaving viewport
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

  // Drag to pan when zoomed
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

  // Double click toggles between 1.0x and 2.5x
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

  // Step zoom buttons
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

  // Dynamic resolution selection:
  // If scale > 1.6 and HD image is loaded, use 2800px 4K HD photo; otherwise use standard 1440px photo
  const activeSrc = isHdLoaded && scale > 1.6 ? photoUrlHd : photoUrl;

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

      {/* Floating HUD Controls on Photo */}
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
          {scale > 1.01 && (
            <button
              type="button"
              onClick={resetZoom}
              title="复位 (1x)"
              className="reset-btn"
            >
              1x
            </button>
          )}
        </div>
      </div>

      {/* Subtle Hint */}
      {scale <= 1.01 && (
        <div className="photo-wheel-hint">
          <span>🖱️ 鼠标滚轮缩放细节 · 拖拽平移</span>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Real Pushpin Icons (图钉) - Needle Tip Points Exactly at Clicked Lat/Lng
// =========================================================================

// User Guess Pushpin (图钉): sharp tip at (19, 48), label below pin
function createGuessPinIcon() {
  return L.divIcon({
    className: "game-div-icon-wrapper",
    html: `
      <div class="geoguessr-needle-pin guess">
        <div class="pin-head-bubble">
          <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="pin-drop-shadow" x="-30%" y="-20%" width="160%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="rgba(0,0,0,0.4)" />
              </filter>
              <linearGradient id="guess-pin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#d97706" />
              </linearGradient>
            </defs>
            <path d="M19 48 C19 48, 35 30, 35 19 C35 10.163, 27.837 3, 19 3 C10.163 3, 3 10.163, 3 19 C3 30, 19 48, 19 48 Z" fill="url(#guess-pin-grad)" stroke="#ffffff" stroke-width="2.5" filter="url(#pin-drop-shadow)" />
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

// Target Location Pushpin (真实拍摄点图钉): sharp tip at (19, 48), label above pin
function createTargetPinIcon(cityName) {
  return L.divIcon({
    className: "game-div-icon-wrapper",
    html: `
      <div class="geoguessr-needle-pin target">
        <div class="pin-head-bubble target">
          <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="target-drop-shadow" x="-30%" y="-20%" width="160%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="rgba(0,0,0,0.4)" />
              </filter>
              <linearGradient id="target-pin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
              </linearGradient>
            </defs>
            <path d="M19 48 C19 48, 35 30, 35 19 C35 10.163, 27.837 3, 19 3 C10.163 3, 3 10.163, 3 19 C3 30, 19 48, 19 48 Z" fill="url(#target-pin-grad)" stroke="#ffffff" stroke-width="2.5" filter="url(#target-drop-shadow)" />
            <circle cx="19" cy="19" r="8.5" fill="#ffffff" />
            <circle cx="19" cy="19" r="5" fill="#059669" />
            <circle cx="19" cy="19" r="2" fill="#ffffff" />
          </svg>
          <div class="needle-pin-label target">真实位置 · ${cityName || "实际拍摄地"}</div>
        </div>
        <div class="target-ground-ripple"></div>
        <div class="target-ground-ripple delayed"></div>
      </div>
    `,
    iconSize: [38, 50],
    iconAnchor: [19, 48],
  });
}

// =========================================================================
// Leaderboard & Player Storage Management (Rankings)
// =========================================================================
const LEADERBOARDS_STORAGE_KEY = "travel_guess_leaderboards_v2";
const PLAYER_NAME_STORAGE_KEY = "travel_guess_player_name_v2";

const IGNORED_LEADERBOARD_RECORD_IDS = new Set([
  "rec-1792565086300-nngfx",
  "rec-1792565696239-u7bga",
  "rec-1792566161133-hbz4k"
]);

const CATEGORY_LABELS = {
  global: "全球排行榜",
  domestic: "国内排行榜",
  foreign: "国外排行榜",
};

function mergeCategoryRecords(listA, listB) {
  const a = Array.isArray(listA) ? listA : [];
  const b = Array.isArray(listB) ? listB : [];
  const seen = new Set();
  const merged = [];
  for (const item of [...a, ...b]) {
    if (
      item &&
      item.id &&
      !seen.has(item.id) &&
      !IGNORED_LEADERBOARD_RECORD_IDS.has(item.id) &&
      !item.id.startsWith("test-") &&
      (!item.playerName || !item.playerName.startsWith("test-"))
    ) {
      seen.add(item.id);
      merged.push(item);
    }
  }
  merged.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.avgDist !== y.avgDist) return x.avgDist - y.avgDist;
    return new Date(y.date) - new Date(x.date);
  });
  return merged;
}

function mergeAllBoards(b1, b2) {
  return {
    global: mergeCategoryRecords(b1?.global, b2?.global),
    domestic: mergeCategoryRecords(b1?.domestic, b2?.domestic),
    foreign: mergeCategoryRecords(b1?.foreign, b2?.foreign),
  };
}

async function fetchCloudLeaderboards() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("travel_guess_leaderboards")
      .select("*")
      .order("score", { ascending: false })
      .order("avg_dist", { ascending: true })
      .order("date", { ascending: false })
      .limit(2000);

    if (error || !Array.isArray(data)) {
      return null;
    }

    const grouped = { global: [], domestic: [], foreign: [] };
    for (const row of data) {
      if (
        !row.id ||
        row.id.startsWith("test-") ||
        row.id.startsWith("mapfill-") ||
        (row.player_name && row.player_name.startsWith("test-")) ||
        IGNORED_LEADERBOARD_RECORD_IDS.has(row.id)
      ) {
        continue;
      }
      const cat = row.category || "global";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        id: row.id,
        playerName: row.player_name,
        score: row.score,
        category: cat,
        date: row.date,
        bestDist: row.best_dist,
        avgDist: row.avg_dist,
        history: Array.isArray(row.history) ? row.history : [],
      });
    }
    return grouped;
  } catch (e) {
    return null;
  }
}

async function uploadRecordToCloud(record) {
  if (!supabase || !record || IGNORED_LEADERBOARD_RECORD_IDS.has(record.id)) return;
  if (record.id?.startsWith("test-") || record.playerName?.startsWith("test-")) return;
  try {
    const payload = {
      id: record.id,
      category: record.category || "global",
      player_name: record.playerName || "旅行探险家",
      score: record.score,
      date: record.date || new Date().toISOString(),
      best_dist: record.bestDist ?? 0,
      avg_dist: record.avgDist ?? 0,
      history: Array.isArray(record.history) ? record.history : [],
    };
    // 优先使用标准 insert（只需 insert 策略权限，避免因未开启 update 策略导致 RLS 42501 拦截）
    const { error: insertErr } = await supabase.from("travel_guess_leaderboards").insert(payload);
    if (insertErr) {
      if (insertErr.code === "23505") {
        // 主键已存在，说明云端已有该记录，无需重复写入
        return;
      }
      // 兜底尝试 upsert
      const { error: upsertErr } = await supabase
        .from("travel_guess_leaderboards")
        .upsert(payload, { onConflict: "id" });
      if (upsertErr) {
        console.warn("Cloud leaderboard upload error:", upsertErr);
      }
    }
  } catch (e) {
    console.warn("Cloud leaderboard upload exception:", e);
  }
}

function loadStoredLeaderboards() {
  const fallback = {
    global: Array.isArray(initialLeaderboards?.global) ? initialLeaderboards.global : [],
    domestic: Array.isArray(initialLeaderboards?.domestic) ? initialLeaderboards.domestic : [],
    foreign: Array.isArray(initialLeaderboards?.foreign) ? initialLeaderboards.foreign : [],
  };

  try {
    const raw = localStorage.getItem(LEADERBOARDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const cleaned = mergeAllBoards(parsed, fallback);
      try {
        localStorage.setItem(LEADERBOARDS_STORAGE_KEY, JSON.stringify(cleaned));
      } catch (err) {}
      return cleaned;
    }
  } catch (e) {}

  return fallback;
}

function saveStoredLeaderboards(data) {
  try {
    localStorage.setItem(LEADERBOARDS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function checkAndInsertLeaderboard(category, newRecord) {
  const allBoards = loadStoredLeaderboards();
  const list = allBoards[category] || [];

  const filtered = list.filter((r) => r.id !== newRecord.id);
  const combined = [...filtered, newRecord];

  combined.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.avgDist !== b.avgDist) return a.avgDist - b.avgDist;
    return new Date(b.date) - new Date(a.date);
  });

  const rankIndex = combined.findIndex((r) => r.id === newRecord.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : 1;
  const totalCount = combined.length;

  allBoards[category] = combined;
  saveStoredLeaderboards(allBoards);

  return { qualified: true, rank, totalCount, updatedBoards: allBoards };
}

// =========================================================================
// Main TravelGuessGame Component - GeoGuessr Style Pin-Drop Gameplay
// =========================================================================
export default function TravelGuessGame({ mapPlaces, placeLookup, searchPlaces }) {
  const [activeCategory, setActiveCategory] = useState("global");
  const [gameState, setGameState] = useState("idle"); // "idle" | "playing" | "finished"

  // Question counts by category for UI badges and tabs
  const categoryCounts = useMemo(() => {
    const all = gameData.questions || [];
    let domestic = 0;
    let foreign = 0;
    for (const q of all) {
      if (q.region === "domestic") domestic++;
      else if (q.region === "foreign") foreign++;
    }
    return {
      global: all.length,
      domestic,
      foreign,
    };
  }, []);

  const [roundQuestions, setRoundQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Player Name State (persisted in localStorage)
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "旅行探险家";
    } catch (e) {
      return "旅行探险家";
    }
  });

  // Leaderboard Modal & Detail State
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [selectedLeaderboardCat, setSelectedLeaderboardCat] = useState("global");
  const [selectedMatchDetail, setSelectedMatchDetail] = useState(null);
  const [leaderboards, setLeaderboards] = useState(() => loadStoredLeaderboards());
  const [newRankAchieved, setNewRankAchieved] = useState(null);

  // Asynchronously synchronize leaderboards with Supabase cloud
  const syncWithCloud = useCallback(async () => {
    const cloudBoards = await fetchCloudLeaderboards();
    if (cloudBoards) {
      setLeaderboards((prev) => {
        const merged = mergeAllBoards(prev, cloudBoards);
        saveStoredLeaderboards(merged);
        return merged;
      });
    }

    // Back-sync any un-uploaded local records to Supabase
    try {
      const local = loadStoredLeaderboards();
      for (const cat of ["global", "domestic", "foreign"]) {
        for (const item of local[cat] || []) {
          uploadRecordToCloud(item);
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    syncWithCloud();
  }, [syncWithCloud]);

  useEffect(() => {
    if (isLeaderboardOpen) {
      syncWithCloud();
    }
  }, [isLeaderboardOpen, syncWithCloud]);

  const handlePlayerNameChange = (val) => {
    setPlayerName(val);
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, val);
    } catch (e) {}
  };

  // GeoGuessr Pin Drop State
  const [guessPin, setGuessPin] = useState(null); // { lat, lng }
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [score, setScore] = useState(0); // Max 50,000 (5,000 per question)

  // Map DOM and Leaflet Layer Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const guessMarkerRef = useRef(null);
  const revealLayerRef = useRef(null);
  const feedbackRef = useRef(null);
  feedbackRef.current = currentFeedback;

  const currentQuestion = roundQuestions[currentIndex] || null;

  // Start new game round
  const startNewGame = useCallback(
    (category = activeCategory) => {
      const questions = generateRoundQuestions(category, gameData.questions);
      setRoundQuestions(questions);
      setCurrentIndex(0);
      setGuessPin(null);
      setCurrentFeedback(null);
      setHistory([]);
      setScore(0);
      setNewRankAchieved(null);
      setGameState("playing");
    },
    [activeCategory]
  );

  const getCategoryDefaultView = useCallback((category) => {
    if (category === "domestic") {
      return { center: [34.5, 108.5], zoom: 4 };
    }
    if (category === "foreign") {
      return { center: [20.0, 50.0], zoom: 2 };
    }
    return { center: [28.0, 55.0], zoom: 2 };
  }, []);

  // Initialize Leaflet Map once when entering "playing" state
  useEffect(() => {
    if (gameState !== "playing" || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const { center, zoom } = getCategoryDefaultView(activeCategory);
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
      });

      // 华为 Petal Maps 高清底图 (tuxun.fun 图寻同款底图，具备高清视网膜渲染与全球中文地名注记)
      const HUAWEI_MAP_TILE_URL =
        "https://maprastertile-drcn.dbankcdn.cn/display-service/v1/online-render/getTile/26.02.03.16/{z}/{x}/{y}/?language=zh&p=46&scale=2&mapType=ROADMAP&presetStyleId=standard&pattern=JPG&key=DAEDANitav6P7Q0lWzCzKkLErbrJG4kS1u%2FCpEe5ZyxW5u0nSkb40bJ%2BYAugRN03fhf0BszLS1rCrzAogRHDZkxaMrloaHPQGO6LNg==";

      const tileLayer = L.tileLayer(HUAWEI_MAP_TILE_URL, {
        minZoom: 1,
        maxZoom: 18,
        tileSize: 256,
        zoomOffset: 0,
      }).addTo(map);

      // 瓦片容灾兜底保障机制
      tileLayer.on("tileerror", (e) => {
        if (e.tile && !e.tile.__fallback) {
          e.tile.__fallback = true;
          const { x, y, z } = e.coords;
          e.tile.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        }
      });

      // 缩放控件置于左上角 (对标 tuxun.fun 独立圆形缩放按钮)
      L.control.zoom({ position: "topleft" }).addTo(map);

      revealLayerRef.current = L.featureGroup().addTo(map);

      // Map Click: GeoGuessr Pin Drop (only when not in feedback mode)
      map.on("click", (e) => {
        if (feedbackRef.current) return;
        const { lat, lng } = e.latlng;
        setGuessPin({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
        });
      });

      mapInstanceRef.current = map;

      // Invalidate size once map element is confirmed rendered
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        guessMarkerRef.current = null;
        revealLayerRef.current = null;
      }
    };
  }, [gameState, activeCategory, getCategoryDefaultView]);

  // Update Guess Pin Marker on Map (Teardrop Pushpin with sharp tip at click point)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || gameState !== "playing") return;

    if (!guessPin) {
      if (guessMarkerRef.current) {
        guessMarkerRef.current.remove();
        guessMarkerRef.current = null;
      }
      return;
    }

    if (!guessMarkerRef.current) {
      const marker = L.marker([guessPin.lat, guessPin.lng], {
        icon: createGuessPinIcon(),
        draggable: !currentFeedback,
        zIndexOffset: 1000,
      }).addTo(map);

      marker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        setGuessPin({
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        });
      });

      guessMarkerRef.current = marker;
    } else {
      guessMarkerRef.current.setLatLng([guessPin.lat, guessPin.lng]);
      if (currentFeedback) {
        guessMarkerRef.current.dragging?.disable();
      } else {
        guessMarkerRef.current.dragging?.enable();
      }
    }
  }, [guessPin, currentFeedback, gameState]);

  // Dedicated Effect for Revealing Guess vs Target on Map with GeoGuessr Visuals & Animation
  useEffect(() => {
    const map = mapInstanceRef.current;
    const revealGroup = revealLayerRef.current;
    if (!map || !revealGroup) return;

    revealGroup.clearLayers();

    if (currentFeedback) {
      const { guessLat, guessLng, targetLat, targetLng, distanceKm, roundScore, cityName } =
        currentFeedback;

      // 1. Target Actual Point Pushpin (Emerald Green with Target Bullseye, Label Above)
      const targetMarker = L.marker([targetLat, targetLng], {
        icon: createTargetPinIcon(cityName),
        zIndexOffset: 1200,
      });
      revealGroup.addLayer(targetMarker);

      // 2. Animated flight line connecting guess and actual point
      const latlngs = [
        [guessLat, guessLng],
        [targetLat, targetLng],
      ];

      const polyline = L.polyline(latlngs, {
        color: "#2563eb",
        weight: 3.5,
        opacity: 0.9,
        dashArray: "10, 10",
        className: "geoguessr-dash-line",
      });
      revealGroup.addLayer(polyline);

      // 3. Midpoint Distance & Score Pill Badge (Only on map if distance >= 5km to avoid blocking close pins!)
      if (distanceKm >= 5.0) {
        const midLat = (guessLat + targetLat) / 2;
        const midLng = (guessLng + targetLng) / 2;
        const midMarker = L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: "game-distance-label-wrapper",
            html: `<div class="geoguessr-midpoint-badge">
                     <span class="mid-dist">⚡ 误差 ${formatDistance(distanceKm)}</span>
                     <span class="mid-score">+${roundScore.toLocaleString()}分</span>
                   </div>`,
            iconSize: [210, 32],
            iconAnchor: [105, 16],
          }),
        });
        revealGroup.addLayer(midMarker);
      }

      // 4. Smooth fitBounds to frame both pushpins comfortably
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, {
        padding: [80, 80],
        maxZoom: 14,
        animate: true,
        duration: 1.2,
      });

      // Ensure leaflet tiles stay properly clipped
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }
  }, [currentFeedback]);

  // Reset Map view
  const handleResetMapView = () => {
    if (!mapInstanceRef.current) return;
    const { center, zoom } = getCategoryDefaultView(activeCategory);
    mapInstanceRef.current.flyTo(center, zoom, { duration: 0.8 });
  };

  // Submit / Confirm Guess
  const handleConfirmGuess = () => {
    if (!guessPin || !currentQuestion || currentFeedback) return;

    const targetLat = currentQuestion.exactLat ?? currentQuestion.center[1];
    const targetLng = currentQuestion.exactLng ?? currentQuestion.center[0];

    const distKm = calculateDistanceKm(guessPin.lat, guessPin.lng, targetLat, targetLng);
    const roundScore = calculateGeoScore(distKm, activeCategory);

    const feedback = {
      guessLat: guessPin.lat,
      guessLng: guessPin.lng,
      targetLat,
      targetLng,
      distanceKm: distKm,
      roundScore,
      cityName: currentQuestion.cityName,
      countryName: currentQuestion.countryName,
      photoUrl: currentQuestion.photoUrl,
      shootTime: currentQuestion.shootTime,
      altitude: currentQuestion.altitude,
      originalFileName: currentQuestion.originalFileName,
    };

    setCurrentFeedback(feedback);
    setScore((prev) => prev + roundScore);
    setHistory((prev) => [...prev, feedback]);
  };

  // Next Question
  const handleNextQuestion = () => {
    if (currentIndex + 1 < roundQuestions.length) {
      setCurrentIndex((prev) => prev + 1);
      setGuessPin(null);
      setCurrentFeedback(null);

      // Clear reveal layers on map
      if (revealLayerRef.current) {
        revealLayerRef.current.clearLayers();
      }
      if (guessMarkerRef.current) {
        guessMarkerRef.current.remove();
        guessMarkerRef.current = null;
      }

      // Smoothly fly back to category overview
      if (mapInstanceRef.current) {
        const { center, zoom } = getCategoryDefaultView(activeCategory);
        mapInstanceRef.current.flyTo(center, zoom, { duration: 0.8 });
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 150);
      }
    } else {
      // 10 题结束：结算本轮总成绩，并自动核对是否打入前 10 名排行榜
      const dists = history.map((h) => h.distanceKm);
      const minD = dists.length > 0 ? Math.min(...dists) : 0;
      const avgD = dists.length > 0 ? dists.reduce((a, b) => a + b, 0) / dists.length : 0;

      const record = {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playerName: (playerName || "").trim() || "旅行探险家",
        score: score,
        category: activeCategory,
        date: new Date().toISOString(),
        bestDist: minD,
        avgDist: avgD,
        history: [...history],
      };

      const res = checkAndInsertLeaderboard(activeCategory, record);
      setNewRankAchieved({
        rank: res.rank,
        total: res.totalCount,
        recordId: record.id,
      });
      setLeaderboards(res.updatedBoards);

      // Asynchronously upload record to Supabase cloud and re-sync
      uploadRecordToCloud(record).then(async () => {
        const cloud = await fetchCloudLeaderboards();
        if (cloud) {
          setLeaderboards((prev) => {
            const merged = mergeAllBoards(prev, cloud);
            saveStoredLeaderboards(merged);
            const cloudList = merged[activeCategory] || [];
            const cloudRank = cloudList.findIndex((r) => r.id === record.id) + 1;
            if (cloudRank > 0) {
              setNewRankAchieved({
                rank: cloudRank,
                total: cloudList.length,
                recordId: record.id,
              });
            }
            return merged;
          });
        }
      });

      setGameState("finished");
    }
  };

  // Switch Category Tab (仅切换选中的分类，不自动开局；进行中对局切换前先确认)
  const handleCategoryChange = (cat) => {
    if (cat === activeCategory) return;
    if (gameState === "playing" || gameState === "round_result") {
      if (!window.confirm("当前挑战正在进行中，切换题库将重置本轮答题进度，确定切换？")) {
        return;
      }
      setGameState("idle");
      setRoundQuestions([]);
      setCurrentIndex(0);
      setGuessPin(null);
      setCurrentFeedback(null);
      setHistory([]);
      setScore(0);
    }
    setActiveCategory(cat);
  };

  // Best guess and average distance calculation
  const stats = useMemo(() => {
    if (history.length === 0) return { bestDist: 0, bestScore: 0, avgDist: 0 };
    const dists = history.map((h) => h.distanceKm);
    const minD = Math.min(...dists);
    const avgD = dists.reduce((a, b) => a + b, 0) / dists.length;
    const bestS = Math.max(...history.map((h) => h.roundScore));
    return {
      bestDist: minD,
      bestScore: bestS,
      avgDist: avgD,
    };
  }, [history]);

  // Current feedback metadata based on real distance
  const currentFeedbackMeta = currentFeedback
    ? getDistanceFeedback(currentFeedback.distanceKm)
    : null;

  return (
    <section className="travel-game-section" id="travel-guess-section">
      {/* 顶部标题栏与题库选择 */}
      <div className="travel-game-header-row">
        <div className="travel-game-title-group">
          <h2 className="notes-hero-title">
            <Compass className="notes-hero-icon" size={24} />
            <span className="game-hero-brand-text">GEO GUESS</span>
            <span className="notes-title-sub">旅行图寻 · 经纬探索</span>
          </h2>
          <p className="travel-game-subtitle">
            <Sparkles size={16} className="game-sub-icon" />
            <span>
              根据真实旅拍照片探索地理细节，在世界地图自由插旗测距，单题最高 5,000 分
            </span>
          </p>
        </div>

        {/* 顶部操作群组：玩家代号 + 排行榜入口 + 题库分类选项卡 */}
        <div className="travel-game-header-actions">
          {/* 玩家当前名称展示胶囊 */}
          <div
            className="game-player-badge-pill"
            title="当前玩家代号 (点击可快速修改)"
            onClick={() => {
              if (gameState === "idle") {
                const el = document.getElementById("welcome-player-input");
                if (el) el.focus();
              } else {
                const newName = prompt("请输入您的玩家代号或昵称：", playerName);
                if (newName !== null && newName.trim()) {
                  handlePlayerNameChange(newName.trim());
                }
              }
            }}
          >
            <User size={13} className="player-badge-icon" />
            <span className="player-badge-name">{playerName}</span>
          </div>

          {/* 荣耀排行榜按钮 */}
          <button
            type="button"
            className="game-leaderboard-btn"
            onClick={() => {
              setSelectedLeaderboardCat(activeCategory);
              setSelectedMatchDetail(null);
              setIsLeaderboardOpen(true);
            }}
            title="查看全球/国内/国外荣耀排行榜"
          >
            <Trophy size={15} />
            <span>排行榜</span>
          </button>

          {/* 题库分类选项卡 (全球 / 国内 / 国外) */}
          <div className="travel-game-category-tabs">
            <button
              type="button"
              className={`game-tab-btn ${activeCategory === "global" ? "active" : ""}`}
              onClick={() => handleCategoryChange("global")}
            >
              全球
            </button>
            <button
              type="button"
              className={`game-tab-btn ${activeCategory === "domestic" ? "active" : ""}`}
              onClick={() => handleCategoryChange("domestic")}
            >
              国内
            </button>
            <button
              type="button"
              className={`game-tab-btn ${activeCategory === "foreign" ? "active" : ""}`}
              onClick={() => handleCategoryChange("foreign")}
            >
              国外
            </button>
          </div>
        </div>
      </div>

      {/* 主游戏交互卡片容器 */}
      <div className="travel-game-card">
        {/* ==================== 1. 欢迎 / 规则就绪界面 (IDLE) ==================== */}
        {gameState === "idle" && (
          <div className="game-welcome-banner">
            <div className="game-welcome-content">
              <div className="game-welcome-badge">
                <Globe size={15} />
                <span>GeoGuessr 经典自由插旗玩法</span>
              </div>
              <h3>欢迎来到旅行图寻世界！</h3>
              <p className="game-welcome-desc">
                从真实旅程中精选千余张实景照片。考验观察力与地理直觉的时刻到了——仔细观察照片中的细节并猜测位置，在地图上插下您的图钉，挑战 50,000 分大满贯！
              </p>

              {/* 玩家昵称输入设置区 */}
              <div className="game-player-setup-card">
                <div className="player-setup-left">
                  <div className="player-avatar-badge">
                    <User size={18} />
                  </div>
                  <div className="player-input-group">
                    <label htmlFor="welcome-player-input">探险家昵称 / 玩家名称</label>
                    <input
                      id="welcome-player-input"
                      type="text"
                      className="welcome-player-input"
                      placeholder="输入您的昵称 (默认: 旅行探险家)"
                      maxLength={16}
                      value={playerName}
                      onChange={(e) => handlePlayerNameChange(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="welcome-check-leaderboard-btn"
                  onClick={() => {
                    setSelectedLeaderboardCat(activeCategory);
                    setSelectedMatchDetail(null);
                    setIsLeaderboardOpen(true);
                  }}
                  title="查看历史排行榜"
                >
                  <Trophy size={16} />
                  <span>查看排行榜</span>
                </button>
              </div>

              <div className="game-rules-grid">
                <div className="game-rule-item">
                  <div className="rule-icon-box">1</div>
                  <div>
                    <strong>自由观察实景图片</strong>
                    <p>鼠标放在照片上滑动滚轮放大细节，判断照片所在拍摄位置。</p>
                  </div>
                </div>
                <div className="game-rule-item">
                  <div className="rule-icon-box">2</div>
                  <div>
                    <strong>地图任意位置插旗</strong>
                    <p>在右侧地图上自由缩放拖拽，点击插下猜测位置的图钉，支持拖动微调位置。</p>
                  </div>
                </div>
                <div className="game-rule-item">
                  <div className="rule-icon-box">3</div>
                  <div>
                    <strong>实测距离积分 (50,000分)</strong>
                    <p>真实经纬度测距连线，单题最高 5,000 分，越接近实际拍摄点得分越高！</p>
                  </div>
                </div>
              </div>

              <div className="game-welcome-actions">
                <button
                  type="button"
                  className="game-primary-btn start-btn"
                  onClick={() => startNewGame()}
                >
                  <Compass size={18} />
                  以「{playerName || "旅行探险家"}」开始挑战 (10 题)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. 答题进行中状态 (PLAYING) ==================== */}
        {gameState === "playing" && currentQuestion && (
          <div className="game-arena-layout">
            {/* 顶栏进度与实时计分 */}
            <div className="game-arena-topbar">
              <div className="arena-progress-info">
                <span className="arena-question-counter">
                  第 <strong>{currentIndex + 1}</strong> / {roundQuestions.length} 题
                </span>
                <div className="arena-progress-bar-bg">
                  <div
                    className="arena-progress-bar-fill"
                    style={{
                      width: `${((currentIndex + 1) / roundQuestions.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="arena-topbar-right">
                <span className="arena-pool-tag">
                  {activeCategory === "global"
                    ? "全球题库"
                    : activeCategory === "domestic"
                    ? "国内题库"
                    : "国外题库"}
                </span>
                <span className="arena-score-tag">
                  <Trophy size={14} className="score-icon" />
                  当前总分：<strong>{score.toLocaleString()}</strong> / 50,000
                </span>
                <button
                  type="button"
                  className="game-secondary-btn small-btn"
                  onClick={() => startNewGame()}
                  title="重新洗牌开始新一局"
                >
                  <RotateCcw size={13} />
                  重新发牌
                </button>
              </div>
            </div>

            {/* 核心分栏区域：左侧滚轮缩放照片，右侧 GeoGuessr 自由插旗地图 */}
            <div className="game-arena-split">
              {/* 左侧：可滚轮放大与拖拽的交互照片 */}
              <div className="game-photo-panel">
                <InteractivePhotoZoomer
                  photoUrl={currentQuestion.photoUrl}
                  photoUrlHd={currentQuestion.photoUrlHd}
                  alt="旅行图寻线索照片"
                />

                {/* 照片下方操作与反馈栏 */}
                <div className="game-control-deck">
                  {!currentFeedback ? (
                    /* 答题阶段：插旗确认 */
                    <div className="deck-active-phase">
                      <div className="deck-selection-status">
                        {guessPin ? (
                          <div className="selection-pill active">
                            <span className="pin-symbol">📍</span>
                            <span>
                              已标记位置：
                              <strong>
                                {guessPin.lat > 0 ? `${guessPin.lat}°N` : `${Math.abs(guessPin.lat)}°S`},{" "}
                                {guessPin.lng > 0 ? `${guessPin.lng}°E` : `${Math.abs(guessPin.lng)}°W`}
                              </strong>
                              <span className="hint-sub">（可拖动图钉修改）</span>
                            </span>
                          </div>
                        ) : (
                          <div className="selection-pill empty">
                            <span>👉 请在右侧地图上点击任意位置插旗标记您的猜测</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className={`game-primary-btn confirm-btn ${
                          !guessPin ? "disabled" : ""
                        }`}
                        disabled={!guessPin}
                        onClick={handleConfirmGuess}
                      >
                        <Check size={16} />
                        确认插旗 (提交猜测)
                      </button>
                    </div>
                  ) : (
                    /* 反馈阶段：显示实测距离与基于真实距离的精准评级 */
                    <div
                      className={`deck-feedback-banner ${currentFeedbackMeta.status}`}
                    >
                      <div className="feedback-message-row">
                        <div
                          className={`feedback-icon-box ${currentFeedbackMeta.status}`}
                        >
                          {currentFeedbackMeta.status === "correct" ? (
                            <Check size={20} />
                          ) : currentFeedbackMeta.status === "close" ? (
                            <Navigation size={18} />
                          ) : (
                            <X size={20} />
                          )}
                        </div>

                        <div className="feedback-text-content">
                          <div className="feedback-score-headline">
                            <h4>{currentFeedbackMeta.title}</h4>
                            <span className="round-score-pill">
                              +{currentFeedback.roundScore.toLocaleString()} 分
                            </span>
                          </div>

                          <div className="feedback-details-row">
                            <span className="distance-badge-pill">
                              误差距离：<strong>{formatDistance(currentFeedback.distanceKm)}</strong>
                            </span>

                            {/* 左侧国旗 + 右侧城市名 */}
                            <div className="feedback-flag-city-row">
                              <span className="label">实际位置：</span>
                              <img
                                src={getCountryFlagUrl(currentFeedback.countryName)}
                                alt={currentFeedback.countryName}
                                className="city-flag-badge"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <strong>{currentFeedback.cityName}</strong>
                            </div>

                            {/* 拍摄时间如果存在 */}
                            {currentFeedback.shootTime && (
                              <span className="feedback-meta-chip">
                                <Clock size={11} />
                                {currentFeedback.shootTime.slice(0, 10).replace(/:/g, "-")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="game-primary-btn next-btn"
                        onClick={handleNextQuestion}
                      >
                        {currentIndex + 1 < roundQuestions.length ? (
                          <>
                            下一题 <ArrowRight size={16} />
                          </>
                        ) : (
                          <>
                            查看结算战报 <Trophy size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧：纯净 GeoGuessr 世界地图 (自由插旗与精准连线) */}
              <div className="game-map-panel">
                <div
                  className={`game-map-wrapper ${!currentFeedback ? "crosshair-cursor" : ""}`}
                  ref={mapContainerRef}
                />

                {/* 地图悬浮提示 */}
                {!currentFeedback && !guessPin && (
                  <div className="map-pin-hint-badge">
                    <Crosshair size={13} />
                    <span>点击地图任意位置插旗</span>
                  </div>
                )}

                <div className="game-map-overlay-controls">
                  <button
                    type="button"
                    className="map-overlay-btn"
                    onClick={handleResetMapView}
                    title="复位地图视角"
                  >
                    <RotateCcw size={14} />
                    <span>复位视角</span>
                  </button>
                </div>

                {/* 华为地图版权与审图号徽章 (对标 tuxun.fun 底图规范) */}
                <div
                  className="petal-attribution-pill"
                  title="底图服务：华为 Petal Maps · 审图号：GS(2022)2885号"
                >
                  <span className="petal-attribution-text">华为地图</span>
                  <span className="petal-attribution-icon">ℹ</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. 结算与复盘画面 (FINISHED) ==================== */}
        {gameState === "finished" && (
          <div className="game-finished-screen">
            <div className="finished-celebration-hero">
              <div className="trophy-glow-avatar">
                <Trophy size={42} />
              </div>
              <h3>本轮挑战圆满完成！</h3>

              <div className="finished-score-display">
                <span className="score-number">{score.toLocaleString()}</span>
                <span className="score-total">/ 50,000 分</span>
              </div>

              <p className="finished-rating-title">
                {score >= 48000
                  ? "👑 满贯神探 · 50,000 分殿堂级活地图！"
                  : score >= 42000
                  ? "🏆 地理宗师 · 洞察秋毫的超级巡航旅者！"
                  : score >= 32000
                  ? "🧭 资深领航 · 敏锐直觉渐入佳境！"
                  : score >= 20000
                  ? "🗺️ 探索先锋 · 熟悉大好河山的风土人情！"
                  : "🌱 漫游见习生 · 多玩几局重温足迹的美好时光！"}
              </p>

              {/* 核心战绩数据胶囊 */}
              <div className="finished-stats-grid">
                <div className="stat-pill">
                  <span className="stat-label">最佳一击误差</span>
                  <strong className="stat-value highlight">
                    {formatDistance(stats.bestDist)}
                  </strong>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">单题最高得分</span>
                  <strong className="stat-value">
                    {stats.bestScore.toLocaleString()} 分
                  </strong>
                </div>
                <div className="stat-pill">
                  <span className="stat-label">全场平均误差</span>
                  <strong className="stat-value">
                    {formatDistance(stats.avgDist)}
                  </strong>
                </div>
              </div>

              {/* 全量排行榜排名成就横幅 */}
              {newRankAchieved && (
                <div className={`finished-top10-banner rank-level-${newRankAchieved.rank <= 3 ? "podium" : newRankAchieved.rank <= 10 ? "top10" : "general"}`}>
                  <div className={`top10-trophy-badge rank-badge-${newRankAchieved.rank <= 3 ? newRankAchieved.rank : newRankAchieved.rank <= 10 ? "top10" : "general"}`}>
                    {newRankAchieved.rank === 1 ? (
                      <span className="medal-icon gold">🥇</span>
                    ) : newRankAchieved.rank === 2 ? (
                      <span className="medal-icon silver">🥈</span>
                    ) : newRankAchieved.rank === 3 ? (
                      <span className="medal-icon bronze">🥉</span>
                    ) : newRankAchieved.rank <= 10 ? (
                      <Trophy size={18} />
                    ) : (
                      <Award size={18} />
                    )}
                    <span>#{newRankAchieved.rank}</span>
                  </div>
                  <div className="top10-banner-info">
                    <h4>
                      {newRankAchieved.rank <= 3 ? "🎉 登顶三甲高光！" : newRankAchieved.rank <= 10 ? "🎉 跻身十强之列！" : "🎉 战绩收录成功！"}
                      恭喜「<strong>{playerName}</strong>」！以{" "}
                      <strong>{score.toLocaleString()}</strong> 分位列【
                      {CATEGORY_LABELS[activeCategory]}】<span className="no-break-rank-phrase">第 {newRankAchieved.rank} 名</span>
                      <small style={{ marginLeft: "8px", fontWeight: "normal", color: "#64748b" }}>
                        (全网共 {newRankAchieved.total} 场记录)
                      </small>
                    </h4>
                    <p>
                      战绩已实时同步保存至云端，从任何设备均可查阅完整排行榜，支持随时点击对局复盘查看 10 题真实轨迹
                    </p>
                  </div>
                  <button
                    type="button"
                    className="top10-view-btn"
                    onClick={() => {
                      setSelectedLeaderboardCat(activeCategory);
                      setSelectedMatchDetail(null);
                      setIsLeaderboardOpen(true);
                    }}
                  >
                    查看完整榜单
                  </button>
                </div>
              )}

              <div className="finished-actions-row">
                <button
                  type="button"
                  className="game-primary-btn"
                  onClick={() => startNewGame()}
                >
                  <RefreshCw size={16} />
                  再战一轮 (10 题)
                </button>
                <button
                  type="button"
                  className="game-secondary-btn"
                  onClick={() => {
                    setSelectedLeaderboardCat(activeCategory);
                    setSelectedMatchDetail(null);
                    setIsLeaderboardOpen(true);
                  }}
                >
                  <Trophy size={16} />
                  查看排行榜 (共 {(leaderboards[activeCategory] || []).length} 场)
                </button>
              </div>
            </div>

            {/* 10 题全量复盘明细 (左侧国旗，右侧城市名，实测误差与得分) */}
            <div className="game-review-section">
              <div className="review-section-header">
                <h4>
                  <Award size={18} /> 全部 10 道题目实测复盘
                </h4>
                <span>
                  总得分：<strong>{score.toLocaleString()}</strong> / 50,000 分
                </span>
              </div>

              <div className="game-review-grid">
                {history.map((item, idx) => {
                  const fInfo = getDistanceFeedback(item.distanceKm);
                  return (
                    <div
                      key={idx}
                      className={`review-card ${fInfo.status}`}
                    >
                      <div className="review-card-thumb">
                        <img
                          src={item.photoUrl}
                          alt={`第 ${idx + 1} 题照片`}
                          loading="lazy"
                        />
                      </div>
                      <div className="review-card-info">
                        <div className="review-card-header">
                          <span className="review-idx">#{idx + 1}</span>
                          <span className={`review-badge ${fInfo.status}`}>
                            +{item.roundScore.toLocaleString()} 分
                          </span>
                        </div>

                        {/* 正确城市：左边小国旗，右边城市名 */}
                        <div className="review-answer-row">
                          <span className="label">拍摄地点：</span>
                          <div className="city-flag-group">
                            <img
                              src={getCountryFlagUrl(item.countryName)}
                              alt={item.countryName}
                              className="city-flag-badge"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <strong className="answer-text correct">{item.cityName}</strong>
                          </div>
                        </div>

                        {/* 实测误差 */}
                        <div className="review-answer-row">
                          <span className="label">实测误差：</span>
                          <span
                            className={`review-distance-error ${
                              item.distanceKm <= 25 ? "close" : ""
                            }`}
                          >
                            {formatDistance(item.distanceKm)}
                          </span>
                        </div>

                        {/* 拍摄时间 */}
                        {item.shootTime && (
                          <div className="review-meta-time">
                            <Clock size={10} />
                            <span>{item.shootTime.slice(0, 10).replace(/:/g, "-")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== 4. 荣耀排行榜弹窗 ==================== */}
      {isLeaderboardOpen && (
        <div
          className="game-modal-overlay"
          onClick={() => {
            setIsLeaderboardOpen(false);
            setSelectedMatchDetail(null);
          }}
        >
          <div
            className="game-modal-card leaderboard-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗顶部标题 */}
            <div className="game-modal-header">
              <div className="modal-title-left">
                <div className="modal-icon-glow">
                  <Trophy size={22} />
                </div>
                <div>
                  <h3 className="modal-headline">荣耀排行榜</h3>
                  <p className="modal-subtext">
                    全网玩家历史战绩总榜 · 支持点击任意纪录查看该局对局实景复盘
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => {
                  setIsLeaderboardOpen(false);
                  setSelectedMatchDetail(null);
                }}
                title="关闭"
              >
                <X size={20} />
              </button>
            </div>

            {/* 弹窗内容区：分为列表视图与对局详情复盘视图 */}
            <div className="game-modal-body">
              {!selectedMatchDetail ? (
                /* 列表视图 */
                <div className="leaderboard-list-view">
                  {/* 下拉分类切换栏 */}
                  <div className="leaderboard-dropdown-bar">
                    <div className="dropdown-label-group">
                      <Filter size={15} />
                      <span>榜单分类：</span>
                    </div>
                    <div className="dropdown-select-wrapper">
                      <select
                        className="leaderboard-category-select"
                        value={selectedLeaderboardCat}
                        onChange={(e) => setSelectedLeaderboardCat(e.target.value)}
                      >
                        <option value="global">🌍 全球排行榜 (Global Rankings)</option>
                        <option value="domestic">🇨🇳 国内排行榜 (Domestic Rankings)</option>
                        <option value="foreign">✈️ 国外排行榜 (Foreign Rankings)</option>
                      </select>
                      <ChevronDown size={14} className="select-arrow" />
                    </div>
                    <span className="leaderboard-count-tag">
                      已收录全部 {(leaderboards[selectedLeaderboardCat] || []).length} 场对局纪录
                    </span>
                  </div>

                  {/* 全量对局记录列表 */}
                  <div className="leaderboard-rows-container">
                    {(leaderboards[selectedLeaderboardCat] || []).length > 0 ? (
                      (leaderboards[selectedLeaderboardCat] || []).map((entry, index) => {
                        const rank = index + 1;
                        const isMyRecord = entry.id === newRankAchieved?.recordId;
                        return (
                          <div
                            key={entry.id || index}
                            className={`leaderboard-row-card rank-${rank} ${isMyRecord ? "current-record-glow" : ""}`}
                            onClick={() => setSelectedMatchDetail(entry)}
                            title="点击查看此局 10 题对局实景复盘"
                          >
                            <div className={`leaderboard-rank-badge rank-badge-${rank}`}>
                              {rank === 1 ? (
                                <span className="medal-icon gold" title="第 1 名 · 冠军">🥇</span>
                              ) : rank === 2 ? (
                                <span className="medal-icon silver" title="第 2 名 · 亚军">🥈</span>
                              ) : rank === 3 ? (
                                <span className="medal-icon bronze" title="第 3 名 · 季军">🥉</span>
                              ) : (
                                <span className="rank-num">#{rank}</span>
                              )}
                            </div>

                            <div className="leaderboard-player-meta">
                              <div className="player-title-row">
                                <span className="player-avatar-mini">
                                  <User size={15} />
                                </span>
                                <strong className="player-display-name">
                                  {entry.playerName}
                                </strong>
                                {isMyRecord && (
                                  <span className="my-record-pill">本次对局</span>
                                )}
                              </div>
                              <div className="player-sub-meta-chips">
                                <span className="meta-chip time-chip" title="对局时间（北京时间 UTC+8）">
                                  <Calendar size={13} />
                                  <span>{formatBeijingTime(entry.date)}</span>
                                </span>
                                <span className="meta-chip accuracy-chip" title="本局十题中的单题最佳误差">
                                  <Navigation size={13} />
                                  <span>最佳误差</span>
                                  <strong>{formatDistance(entry.bestDist)}</strong>
                                </span>
                                <span className="meta-chip avg-chip" title="本局十题的平均地理误差">
                                  <Compass size={13} />
                                  <span>平均误差</span>
                                  <strong>{formatDistance(entry.avgDist)}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="leaderboard-score-right">
                              <span className="leaderboard-score-val">
                                {entry.score.toLocaleString()}
                                <small>分</small>
                              </span>
                              <div className="view-detail-btn-pill">
                                <span>查看对局</span>
                                <ChevronRight size={14} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="leaderboard-empty-box">
                        <Trophy size={48} className="empty-trophy" />
                        <h4>该榜单暂无对局记录</h4>
                        <p>完成一轮 10 题探索，您的绝佳战绩将自动收录入榜！</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 对局详情复盘视图 (点击某一条记录后打开) */
                <div className="leaderboard-match-detail-view">
                  <div className="match-detail-header-bar">
                    <button
                      type="button"
                      className="back-btn"
                      onClick={() => setSelectedMatchDetail(null)}
                    >
                      <ArrowLeft size={16} />
                      <span>返回排行榜列表</span>
                    </button>
                    <div className="match-detail-title-info">
                      <strong>「{selectedMatchDetail.playerName}」</strong>
                      <span>
                        对局复盘 · 得分：
                        <em className="score-hl">{selectedMatchDetail.score.toLocaleString()}</em> 分
                      </span>
                    </div>
                  </div>

                  {/* 核心战绩数据胶囊 */}
                  <div className="finished-stats-grid match-detail-stats">
                    <div className="stat-pill">
                      <span className="stat-label">最佳一击误差</span>
                      <strong className="stat-value highlight">
                        {formatDistance(selectedMatchDetail.bestDist)}
                      </strong>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-label">全场平均误差</span>
                      <strong className="stat-value">
                        {formatDistance(selectedMatchDetail.avgDist)}
                      </strong>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-label">对局时间 (北京时间)</span>
                      <strong className="stat-value date">
                        {formatBeijingTime(selectedMatchDetail.date)}
                      </strong>
                    </div>
                  </div>

                  {/* 10 题复盘列表 */}
                  <div className="game-review-grid match-detail-review-grid">
                    {(selectedMatchDetail.history || []).map((item, idx) => {
                      const fInfo = getDistanceFeedback(item.distanceKm);
                      return (
                        <div key={idx} className={`review-card ${fInfo.status}`}>
                          <div className="review-card-thumb">
                            <img
                              src={item.photoUrl}
                              alt={`第 ${idx + 1} 题照片`}
                              loading="lazy"
                            />
                          </div>
                          <div className="review-card-info">
                            <div className="review-card-header">
                              <span className="review-idx">#{idx + 1}</span>
                              <span className={`review-badge ${fInfo.status}`}>
                                +{item.roundScore.toLocaleString()} 分
                              </span>
                            </div>
                            <div className="review-answer-row">
                              <span className="label">拍摄地点：</span>
                              <div className="city-flag-group">
                                <img
                                  src={getCountryFlagUrl(item.countryName)}
                                  alt={item.countryName}
                                  className="city-flag-badge"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                <strong className="answer-text correct">
                                  {item.cityName}
                                </strong>
                              </div>
                            </div>
                            <div className="review-answer-row">
                              <span className="label">实测误差：</span>
                              <span
                                className={`review-distance-error ${
                                  item.distanceKm <= 25 ? "close" : ""
                                }`}
                              >
                                {formatDistance(item.distanceKm)}
                              </span>
                            </div>
                            {item.shootTime && (
                              <div className="review-meta-time">
                                <Clock size={10} />
                                <span>{item.shootTime.slice(0, 10).replace(/:/g, "-")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
