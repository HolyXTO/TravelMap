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
  UserCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import gameData from "./data/guessGameData.json";
import { supabase } from "./lib/supabase";
import "./battleStyles.css";

// 严格限定对战题库：仅采用第十一批 Tang 的照片 (共 502 张欧洲精选照片)
const TANG_QUESTIONS = gameData.questions.filter((q) => q.author === "Tang");

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

// 随机洗牌选取 10 道题目
function pick10TangQuestions() {
  const pool = [...TANG_QUESTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 10);
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
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#0284c7" />
              </linearGradient>
            </defs>
            <path d="M19 48 C19 48, 35 30, 35 19 C35 10.163, 27.837 3, 19 3 C10.163 3, 3 10.163, 3 19 C3 30, 19 48, 19 48 Z" fill="url(#battle-opp-pin-grad)" stroke="#ffffff" stroke-width="2.5" filter="url(#battle-opp-drop-shadow)" />
            <circle cx="19" cy="19" r="8" fill="#ffffff" />
            <circle cx="19" cy="19" r="4.5" fill="#0284c7" />
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

// 目标真实拍摄点 (翡翠绿针式图钉，带雷达波纹)
function createTargetPinIcon(cityName) {
  return L.divIcon({
    className: "game-div-icon-wrapper",
    html: `
      <div class="geoguessr-needle-pin target">
        <div class="pin-head-bubble target">
          <svg width="38" height="50" viewBox="0 0 38 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="battle-target-drop-shadow" x="-30%" y="-20%" width="160%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="rgba(0,0,0,0.4)" />
              </filter>
              <linearGradient id="battle-target-pin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#059669" />
              </linearGradient>
            </defs>
            <path d="M19 48 C19 48, 35 30, 35 19 C35 10.163, 27.837 3, 19 3 C10.163 3, 3 10.163, 3 19 C3 30, 19 48, 19 48 Z" fill="url(#battle-target-pin-grad)" stroke="#ffffff" stroke-width="2.5" filter="url(#battle-target-drop-shadow)" />
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

// 连线中点距离与得分标签
function createDistanceBadgeIcon(distKm, score) {
  return L.divIcon({
    className: "game-distance-label-wrapper",
    html: `
      <div class="geoguessr-midpoint-badge">
        <span class="mid-dist">📏 误差 ${formatDistance(distKm)}</span>
        <span class="mid-score">+${score.toLocaleString()}分</span>
      </div>
    `,
    iconSize: [0, 0],
  });
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
          {scale > 1.01 && (
            <button type="button" onClick={resetZoom} title="复位 (1x)" className="reset-btn">
              1x
            </button>
          )}
        </div>
      </div>

      {scale <= 1.01 && (
        <div className="photo-wheel-hint">
          <span>🖱️ 鼠标滚轮缩放细节 · 拖拽平移</span>
        </div>
      )}
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

  // 关键：存放当前回合双方的提交数据 { [playerId]: { playerId, roundIndex, lat, lng, dist, score } }
  const roundSubmissionsRef = useRef({});

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
  const handleNameChange = (e) => {
    const val = e.target.value.trim().substring(0, 12);
    setPlayerName(val || "探险家");
    localStorage.setItem("travel_battle_player_name", val || "探险家");
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

      // 玩家点击地图放置图钉
      map.on("click", (e) => {
        if (myLocked) return; // 锁定后不可再修改
        const { lat, lng } = e.latlng;
        setMyPin({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 });
      });

      mapInstanceRef.current = map;
    }

    // 重新调整地图尺寸
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);
  }, [gameState, myLocked]);

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

    // 2. 回合揭晓阶段：同时绘制 目标真实针式图钉、你的插旗、对手插旗、中点得分与虚线
    if (gameState === "ROUND_REVEAL" && roundResult) {
      const { targetLat, targetLng, myGuess, oppGuess, targetCity } = roundResult;
      const boundsPoints = [[targetLat, targetLng]];

      // A. 目标真实点 (翡翠绿针式图钉 + 雷达波纹动画)
      const targetMarker = L.marker([targetLat, targetLng], {
        icon: createTargetPinIcon(targetCity),
        zIndexOffset: 2000,
      });
      markerGroup.addLayer(targetMarker);

      // B. 你的预测插旗 (金黄色针式图钉)
      if (myGuess && myGuess.lat !== null) {
        boundsPoints.push([myGuess.lat, myGuess.lng]);
        const myMarker = L.marker([myGuess.lat, myGuess.lng], {
          icon: createGuessPinIcon(),
          zIndexOffset: 1500,
        });
        markerGroup.addLayer(myMarker);

        // 连线与中点距离徽章
        L.polyline([[myGuess.lat, myGuess.lng], [targetLat, targetLng]], {
          color: "#d97706",
          dashArray: "6, 6",
          weight: 3.5,
          opacity: 0.9,
        }).addTo(markerGroup);

        const midLat = (myGuess.lat + targetLat) / 2;
        const midLng = (myGuess.lng + targetLng) / 2;
        L.marker([midLat, midLng], {
          icon: createDistanceBadgeIcon(myGuess.dist, myGuess.score),
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

        // 连线与中点距离徽章
        L.polyline([[oppGuess.lat, oppGuess.lng], [targetLat, targetLng]], {
          color: "#0284c7",
          dashArray: "6, 6",
          weight: 3.5,
          opacity: 0.9,
        }).addTo(markerGroup);

        const midLat2 = (oppGuess.lat + targetLat) / 2;
        const midLng2 = (oppGuess.lng + targetLng) / 2;
        L.marker([midLat2, midLng2], {
          icon: createDistanceBadgeIcon(oppGuess.dist, oppGuess.score),
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
  // 回合完成判定与成绩揭晓 (彻底修复双方交卷后无法结算的 Bug)
  // ==========================================================================
  const triggerRoundReveal = useCallback(
    (mySub, oppSub, roundIdx) => {
      const curQ = matchQuestions[roundIdx];
      if (!curQ) return;

      // 停止 15s 紧急倒计时
      if (urgentTimerRef.current) clearTimeout(urgentTimerRef.current);
      setUrgentSeconds(null);
      setUrgentTriggeredBy(null);

      const targetLat = curQ.exactLat ?? curQ.center[1];
      const targetLng = curQ.exactLng ?? curQ.center[0];

      const res = {
        roundIndex: roundIdx,
        targetLat,
        targetLng,
        targetCity: curQ.cityName,
        targetCountry: curQ.countryName,
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
      };

      setRoundResult(res);
      setMyTotalScore((prev) => prev + mySub.score);
      setOpponentTotalScore((prev) => prev + oppSub.score);
      setMatchHistory((prev) => [...prev, res]);
      setGameState("ROUND_REVEAL");
      sfx.playReveal();

      // 重置本回合缓存并启动 5 秒自动跳转
      roundSubmissionsRef.current = {};
      setAutoAdvanceSec(5);
    },
    [matchQuestions]
  );

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
    if (myLocked) return;
    const curQ = matchQuestions[currentRoundIndex];
    if (!curQ) return;

    const targetLat = curQ.exactLat ?? curQ.center[1];
    const targetLng = curQ.exactLng ?? curQ.center[0];

    let dist = 20000;
    let score = 0;
    let guessCoords = null;

    if (myPin) {
      dist = calculateDistanceKm(myPin.lat, myPin.lng, targetLat, targetLng);
      score = calculateBattleScore(dist);
      guessCoords = myPin;
    }

    setMyLocked(true);
    sfx.playLock();

    const mySubmission = {
      playerId,
      roundIndex: currentRoundIndex,
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
        payload: { playerId, roundIndex: currentRoundIndex },
      });
      channelRef.current.send({
        type: "broadcast",
        event: "round_submit",
        payload: mySubmission,
      });
    }

    checkRoundCompletion(roundSubmissionsRef.current, currentRoundIndex);
  }, [myLocked, matchQuestions, currentRoundIndex, myPin, playerId, checkRoundCompletion]);

  // 玩家主动点击“确认提交锁定”
  const handleLockInGuess = () => {
    if (myLocked || !myPin) return;
    const curQ = matchQuestions[currentRoundIndex];
    if (!curQ) return;

    setMyLocked(true);
    sfx.playLock();

    const targetLat = curQ.exactLat ?? curQ.center[1];
    const targetLng = curQ.exactLng ?? curQ.center[0];
    const dist = calculateDistanceKm(myPin.lat, myPin.lng, targetLat, targetLng);
    const score = calculateBattleScore(dist);

    const mySubmission = {
      playerId,
      roundIndex: currentRoundIndex,
      lat: myPin.lat,
      lng: myPin.lng,
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
        payload: { playerId, roundIndex: currentRoundIndex },
      });

      // 广播通知：B. 发送自己的成绩数据
      channelRef.current.send({
        type: "broadcast",
        event: "round_submit",
        payload: mySubmission,
      });
    }

    // 检查对手是否在之前就已经交卷了
    checkRoundCompletion(roundSubmissionsRef.current, currentRoundIndex);
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

  // 本地执行切题
  const advanceToNextRoundLocally = useCallback(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    setAutoAdvanceSec(null);

    setCurrentRoundIndex((prev) => {
      if (prev + 1 < matchQuestions.length) {
        setMyPin(null);
        setMyLocked(false);
        setOpponentLocked(false);
        setUrgentSeconds(null);
        setUrgentTriggeredBy(null);
        setRoundResult(null);
        roundSubmissionsRef.current = {};
        setGameState("PLAYING");
        return prev + 1;
      } else {
        setGameState("GAME_OVER");
        sfx.playVictory();
        return prev;
      }
    });
  }, [matchQuestions.length]);

  // 玩家手动或自动点击“进入下一题”
  const handleNextRound = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "sync_next_round",
        payload: { nextRoundIndex: currentRoundIndex + 1 },
      });
    }
    advanceToNextRoundLocally();
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
      setMatchQuestions(questionsArr);
      setCurrentRoundIndex(0);
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      setMyLocked(false);
      setOpponentLocked(false);
      setUrgentSeconds(null);
      roundSubmissionsRef.current = {};

      const channel = supabase.channel(`travel_battle_room_${targetRoomId}`, {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: playerId },
        },
      });

      // 注册所有广播监听 (必须在 subscribe 之前)
      channel
        .on("broadcast", { event: "player_locked" }, ({ payload }) => {
          if (payload.playerId !== playerId) {
            setOpponentLocked(true);
            setMyLocked((alreadyLocked) => {
              if (!alreadyLocked) {
                setUrgentSeconds(15);
                setUrgentTriggeredBy("opponent");
                sfx.playUrgentTick();
              }
              return alreadyLocked;
            });
          }
        })
        .on("broadcast", { event: "round_submit" }, ({ payload }) => {
          if (payload.playerId !== playerId) {
            setOpponentLocked(true);
            roundSubmissionsRef.current[payload.playerId] = payload;
            checkRoundCompletion(roundSubmissionsRef.current, payload.roundIndex);
          }
        })
        .on("broadcast", { event: "sync_next_round" }, () => {
          advanceToNextRoundLocally();
        })
        .on("broadcast", { event: "start_game" }, ({ payload }) => {
          const qs = payload.questionIds
            .map((id) => TANG_QUESTIONS.find((q) => q.id === id))
            .filter(Boolean);
          setMatchQuestions(qs);
          setGameState("PLAYING");
          sfx.playMatchFound();
        })
        .on("broadcast", { event: "rematch_start" }, ({ payload }) => {
          const qs = payload.questionIds
            .map((id) => TANG_QUESTIONS.find((q) => q.id === id))
            .filter(Boolean);
          setMatchQuestions(qs);
          setCurrentRoundIndex(0);
          setMyTotalScore(0);
          setOpponentTotalScore(0);
          setMatchHistory([]);
          setMyPin(null);
          setMyLocked(false);
          setOpponentLocked(false);
          setRoundResult(null);
          roundSubmissionsRef.current = {};
          setGameState("PLAYING");
          sfx.playMatchFound();
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
    [playerId, playerName, checkRoundCompletion, advanceToNextRoundLocally]
  );

  // ==========================================================================
  // 快速随机匹配机制 (Matchmaking Lobby)
  // ==========================================================================
  const startQuickMatch = () => {
    setGameState("MATCHING");

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
            const chosen10 = pick10TangQuestions();
            const questionIds = chosen10.map((q) => q.id);

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
              },
            });

            supabase.removeChannel(lobby);
            lobbyChannelRef.current = null;
            setupRoomChannel(newRoomId, true, chosen10, { id: p2.playerId, name: p2.playerName });
            setGameState("PLAYING");
            sfx.playMatchFound();
          }
        }
      })
      .on("broadcast", { event: "match_found" }, ({ payload }) => {
        if (payload.guestId === playerId) {
          supabase.removeChannel(lobby);
          lobbyChannelRef.current = null;
          const qs = payload.questionIds
            .map((id) => TANG_QUESTIONS.find((q) => q.id === id))
            .filter(Boolean);
          setupRoomChannel(payload.roomId, false, qs, {
            id: payload.hostId,
            name: payload.hostName,
          });
          setGameState("PLAYING");
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
    setGameState("LOBBY");
  };

  // ==========================================================================
  // 好友房间开黑机制 (Private Room Code)
  // ==========================================================================
  const createFriendRoom = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const chosen10 = pick10TangQuestions();
    setupRoomChannel(code, true, chosen10, null);
    setGameState("ROOM_WAITING");
  };

  const joinFriendRoom = () => {
    const code = inputRoomCode.trim();
    if (!code) {
      alert("请输入 6 位好友房间码");
      return;
    }
    setupRoomChannel(code, false, [], null);
    setGameState("ROOM_WAITING");
  };

  const startFriendMatchAsHost = () => {
    if (!opponent) {
      alert("请等待好友加入房间后再开始！");
      return;
    }
    if (channelRef.current) {
      const qIds = matchQuestions.map((q) => q.id);
      channelRef.current.send({
        type: "broadcast",
        event: "start_game",
        payload: { questionIds: qIds },
      });
      setGameState("PLAYING");
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
      const new10 = pick10TangQuestions();
      const questionIds = new10.map((q) => q.id);
      channelRef.current.send({
        type: "broadcast",
        event: "rematch_start",
        payload: { questionIds },
      });
      setMatchQuestions(new10);
      setCurrentRoundIndex(0);
      setMyTotalScore(0);
      setOpponentTotalScore(0);
      setMatchHistory([]);
      setMyPin(null);
      setMyLocked(false);
      setOpponentLocked(false);
      setRoundResult(null);
      roundSubmissionsRef.current = {};
      setGameState("PLAYING");
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
    setGameState("LOBBY");
    setRoomId("");
    setOpponent(null);
  };

  const currentQ = matchQuestions[currentRoundIndex] || null;

  return (
    <div className="battle-master-wrapper">
      {/* 顶部状态与品牌栏 */}
      <header className="battle-header-bar">
        <div className="battle-brand">
          <div className="battle-brand-icon">
            <Swords size={22} />
          </div>
          <div>
            <div className="battle-brand-title">
              1v1 实时图寻对决
              <span className="battle-brand-tag">Tang 欧洲精选专场</span>
            </div>
            <div className="battle-brand-sub">实时同题对抗 · 先交卷施加 15s 绝杀倒计时</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="battle-player-pill">
            <span style={{ width: 8, height: 8, background: "#22c55e", borderRadius: "50%" }}></span>
            <span>{playerName}</span>
          </div>

          <button
            type="button"
            className="battle-sound-btn"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "开启音效" : "静音"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* ==================================================================
          阶段 1：对战大厅 (LOBBY)
          ================================================================== */}
      {gameState === "LOBBY" && (
        <div className="battle-lobby-card">
          <div className="battle-lobby-hero-badge">
            <Zap size={15} /> 实时竞技全新上线
          </div>
          <h2 className="battle-lobby-title">极速双人图寻对决</h2>
          <p className="battle-lobby-desc">
            两位玩家同时在线，随机抽取 10 道相同的欧洲精选照片。谁先锁定答案，对方即刻进入 15
            秒倒计时绝杀！分秒必争，得分最高者胜出。
          </p>

          <div className="battle-nickname-box">
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>你的昵称:</span>
            <input
              type="text"
              className="battle-nickname-input"
              value={playerName}
              onChange={handleNameChange}
              maxLength={12}
            />
          </div>

          <div className="battle-modes-grid">
            {/* 模式 A：快速匹配 */}
            <div className="battle-mode-panel">
              <div>
                <div className="battle-mode-icon quick">
                  <Zap size={26} />
                </div>
                <div className="battle-mode-name">随机快速匹配</div>
                <div className="battle-mode-details">
                  一键接入全网在线对战大厅，系统将自动为你寻找旗鼓相当的对手并瞬时开局。
                </div>
              </div>
              <button
                type="button"
                className="battle-action-btn primary"
                onClick={startQuickMatch}
              >
                <Zap size={18} /> 开始匹配对手
              </button>
            </div>

            {/* 模式 B：好友房间开黑 */}
            <div className="battle-mode-panel">
              <div>
                <div className="battle-mode-icon friend">
                  <Users size={26} />
                </div>
                <div className="battle-mode-name">好友专属房间</div>
                <div className="battle-mode-details">
                  创建 6 位私人房间码或生成链接发给好友，支持一键点开直接进房 1v1 单挑。
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="battle-action-btn secondary"
                  onClick={createFriendRoom}
                  style={{ marginBottom: "10px" }}
                >
                  <Sparkles size={17} /> 创建私人房间
                </button>

                <div className="battle-room-input-row">
                  <input
                    type="text"
                    className="battle-room-input"
                    placeholder="输入6位房间码"
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <button
                    type="button"
                    className="battle-action-btn primary"
                    style={{ width: "auto", padding: "10px 16px" }}
                    onClick={joinFriendRoom}
                  >
                    加入
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="battle-rules-summary">
            <span>🎯 题库范围：502 张 Tang 欧洲纪行实景精选</span>
            <span>⚡ 题量：每局 10 回合</span>
            <span>⏱️ 绝杀机制：首个提交后触发 15 秒倒计时</span>
          </div>
        </div>
      )}

      {/* ==================================================================
          阶段 2：快速匹配中 (MATCHING)
          ================================================================== */}
      {gameState === "MATCHING" && (
        <div className="battle-lobby-card">
          <div className="battle-matching-overlay">
            <div className="battle-radar-circle">
              <Zap size={36} color="#ea580c" />
            </div>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "8px" }}>
              正在寻找对手...
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "28px" }}>
              已连接至匹配池，请保持页面开启，匹配成功将自动开启对决
            </p>
            <button
              type="button"
              className="battle-action-btn secondary"
              style={{ maxWidth: "200px" }}
              onClick={cancelQuickMatch}
            >
              取消匹配
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================
          阶段 3：好友房间等待中 (ROOM_WAITING)
          ================================================================== */}
      {gameState === "ROOM_WAITING" && (
        <div className="battle-lobby-card">
          <div style={{ padding: "20px 0" }}>
            <div className="battle-lobby-hero-badge">
              <Users size={16} /> 专属房间: {roomId}
            </div>
            <h3 style={{ fontSize: "1.6rem", fontWeight: 900, marginBottom: "12px" }}>
              {isHost ? "邀请好友加入对局" : "已加入房间，等待房主开始"}
            </h3>

            {isHost && (
              <div style={{ marginBottom: "24px" }}>
                <p style={{ color: "#64748b", marginBottom: "16px" }}>
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
                  }}
                >
                  <span style={{ fontSize: "1.3rem", fontWeight: 900, letterSpacing: "0.1em" }}>
                    {roomId}
                  </span>
                  <button
                    type="button"
                    className="battle-action-btn primary"
                    style={{ width: "auto", padding: "8px 14px", fontSize: "0.85rem" }}
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
              }}
            >
              <div className="battle-player-pill" style={{ padding: "10px 20px" }}>
                <UserCheck size={18} color="#16a34a" /> 房主: {playerName} (你)
              </div>
              <div className="battle-player-pill" style={{ padding: "10px 20px" }}>
                {opponent ? (
                  <>
                    <UserCheck size={18} color="#2563eb" /> 对手: {opponent.name} (已就绪)
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
                  className="battle-action-btn primary"
                  style={{ maxWidth: "240px" }}
                  disabled={!opponent}
                  onClick={startFriendMatchAsHost}
                >
                  <Swords size={18} /> 开始对决
                </button>
              ) : (
                <div style={{ color: "#64748b", fontSize: "0.95rem" }}>
                  已就绪，正在等待房主点击开始...
                </div>
              )}
              <button
                type="button"
                className="battle-action-btn secondary"
                style={{ maxWidth: "160px" }}
                onClick={returnToLobby}
              >
                退出房间
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          阶段 4 & 5：对战进行中 (PLAYING) 与 回合揭晓 (ROUND_REVEAL)
          ================================================================== */}
      {(gameState === "PLAYING" || gameState === "ROUND_REVEAL") && currentQ && (
        <div>
          {/* 实时比分 HUD */}
          <div className="battle-hud-panel">
            <div className="battle-scoreboard">
              {/* 你 */}
              <div className="battle-score-player you">
                <div className="battle-score-avatar">你</div>
                <div className="battle-score-info">
                  <div className="battle-score-name">
                    {playerName}
                    {myLocked && (
                      <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 800 }}>
                        ✓ 已交卷
                      </span>
                    )}
                  </div>
                  <div className="battle-score-pts">{myTotalScore.toLocaleString()}</div>
                </div>
              </div>

              <div className="battle-vs-badge">VS</div>

              {/* 对手 */}
              <div className="battle-score-player opponent">
                <div className="battle-score-avatar">{opponent?.name?.substring(0, 1) || "敌"}</div>
                <div className="battle-score-info">
                  <div className="battle-score-name">
                    {opponent?.name || "对手"}
                    {opponentLocked && (
                      <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 800 }}>
                        ✓ 已交卷
                      </span>
                    )}
                  </div>
                  <div className="battle-score-pts">{opponentTotalScore.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* 回合数 */}
            <div className="battle-round-badge">
              <Sparkles size={16} color="#f97316" />
              第 {currentRoundIndex + 1} / {matchQuestions.length} 题
            </div>
          </div>

          {/* 15 秒绝杀倒计时紧急横幅 */}
          {urgentSeconds !== null && gameState === "PLAYING" && (
            <div className="battle-urgent-timer-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ShieldAlert size={24} />
                <span>
                  {urgentTriggeredBy === "opponent"
                    ? "对手已率先交卷！触发 15 秒绝杀倒计时，请尽快选择答案："
                    : "你已交卷！对手进入 15 秒绝杀倒计时："}
                </span>
              </div>
              <div className="battle-urgent-sec">{urgentSeconds}s</div>
            </div>
          )}

          {/* 核心分屏游戏区 */}
          <div className="battle-play-grid">
            {/* 照片展示区：支持鼠标滚轮缩放、双击缩放、拖拽平移与高清无缝切换 */}
            <div className="battle-photo-container">
              <BattlePhotoZoomer
                photoUrl={currentQ.photoUrl}
                photoUrlHd={currentQ.photoUrlHd}
                alt="对决实景照片"
              />

              <div className="battle-author-tag">
                <span>📸 Tang 欧洲精选</span>
                <span>·</span>
                <span>{currentQ.shootTime?.substring(0, 10) || "欧洲实拍"}</span>
              </div>
            </div>

            {/* 交互地图选点区 */}
            <div className="battle-map-container">
              <div ref={mapContainerRef} className="battle-leaflet-map" />

              {/* 选点提示与确认提交按钮 */}
              {gameState === "PLAYING" && (
                <div className="battle-map-bottom-bar">
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.85)",
                      backdropFilter: "blur(8px)",
                      color: "#ffffff",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    {myPin ? "已放置图钉，确认无误后点击提交" : "点击地图任意位置标出你预测的地点"}
                  </div>

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

          {/* 回合结算揭晓弹窗条 (ROUND_REVEAL) */}
          {gameState === "ROUND_REVEAL" && roundResult && (
            <div className="battle-reveal-modal">
              <div className="battle-reveal-location">
                <div className="battle-reveal-title">
                  🎯 正确位置：{roundResult.targetCountry} · {roundResult.targetCity}
                </div>
                <div className="battle-reveal-subtitle">
                  双方预测点位已在地图揭晓，虚线标记各自误差
                </div>
              </div>

              <div className="battle-reveal-scores">
                <div className="battle-reveal-card you">
                  <span className="name">你 ({playerName})</span>
                  <span className="pts">+{roundResult.myGuess.score} 分</span>
                  <span className="dist">误差: {formatDistance(roundResult.myGuess.dist)}</span>
                </div>

                <div className="battle-reveal-card opponent">
                  <span className="name">{opponent?.name || "对手"}</span>
                  <span className="pts">+{roundResult.oppGuess.score} 分</span>
                  <span className="dist">误差: {formatDistance(roundResult.oppGuess.dist)}</span>
                </div>
              </div>

              <button type="button" className="battle-next-btn" onClick={handleNextRound}>
                <span>
                  {currentRoundIndex + 1 < matchQuestions.length
                    ? `进入第 ${currentRoundIndex + 2} 题`
                    : "查看最终赛果"}
                  {autoAdvanceSec !== null && ` (${autoAdvanceSec}s)`}
                </span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          阶段 6：终局大结算 (GAME_OVER)
          ================================================================== */}
      {gameState === "GAME_OVER" && (
        <div className="battle-gameover-card">
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
              <span className="label">你 ({playerName})</span>
              <span className="val">{myTotalScore.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#cbd5e1" }}>VS</div>
            <div className="battle-total-card opponent">
              <span className="label">{opponent?.name || "对手"}</span>
              <span className="val">{opponentTotalScore.toLocaleString()}</span>
            </div>
          </div>

          {/* 10 题复盘列表 */}
          <h4 style={{ fontSize: "1.1rem", fontWeight: 800, textAlign: "left", marginBottom: "14px" }}>
            对决逐题详细复盘 (10 题)
          </h4>
          <div style={{ overflowX: "auto" }}>
            <table className="battle-review-table">
              <thead>
                <tr>
                  <th>回合</th>
                  <th>目标城市</th>
                  <th>你的误差 / 得分</th>
                  <th>对手误差 / 得分</th>
                  <th>本回合优胜</th>
                </tr>
              </thead>
              <tbody>
                {matchHistory.map((item, idx) => {
                  const youWon = item.myGuess.score > item.oppGuess.score;
                  const tie = item.myGuess.score === item.oppGuess.score;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 800 }}>第 {idx + 1} 题</td>
                      <td>
                        {item.targetCountry} · {item.targetCity}
                      </td>
                      <td style={{ color: "#d97706", fontWeight: 700 }}>
                        {formatDistance(item.myGuess.dist)} (+{item.myGuess.score}分)
                      </td>
                      <td style={{ color: "#0284c7", fontWeight: 700 }}>
                        {formatDistance(item.oppGuess.dist)} (+{item.oppGuess.score}分)
                      </td>
                      <td>
                        {youWon ? (
                          <span style={{ color: "#16a34a", fontWeight: 800 }}>🏆 你胜出</span>
                        ) : tie ? (
                          <span style={{ color: "#64748b", fontWeight: 700 }}>平局</span>
                        ) : (
                          <span style={{ color: "#0284c7", fontWeight: 700 }}>对手胜出</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
