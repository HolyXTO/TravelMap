import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Play,
  RotateCcw,
  Flag,
  Trophy,
  Clock,
  Check,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  X,
  ChevronRight,
  ChevronDown,
  ListFilter,
  Search,
  AlertCircle,
  Share2,
  User,
  Calendar,
  Zap,
  Award,
  CheckCircle2,
  Globe2,
  Home,
  Map as MapIcon,
} from "lucide-react";
import gameData from "./data/chinaPrefecturesGameData.json";

// 七大地理大区排序与色彩
const REGION_CONFIG = [
  { name: "全部", key: "all" },
  { name: "华东", key: "华东", color: "#2563eb" },
  { name: "华北", key: "华北", color: "#059669" },
  { name: "华中", key: "华中", color: "#d97706" },
  { name: "华南", key: "华南", color: "#dc2626" },
  { name: "西南", key: "西南", color: "#7c3aed" },
  { name: "西北", key: "西北", color: "#0891b2" },
  { name: "东北", key: "东北", color: "#4f46e5" },
];

// 初始高光荣誉榜预设纪录
const INITIAL_FILL_LEADERBOARD = [
  {
    id: "record-1",
    playerName: "Tang & Xiao",
    score: 389,
    total: 389,
    elapsedSeconds: 765, // 12分45秒
    apm: 30,
    date: "2026-10-15T14:20:00.000Z",
    title: "🎖️ 神级巡抚 · 行走大英豪",
  },
  {
    id: "record-2",
    playerName: "华夏游侠",
    score: 362,
    total: 389,
    elapsedSeconds: 980, // 16分20秒
    apm: 22,
    date: "2026-10-12T10:15:00.000Z",
    title: "🎖️ 神级巡抚 · 行走大英豪",
  },
  {
    id: "record-3",
    playerName: "地理博主阿杰",
    score: 318,
    total: 389,
    elapsedSeconds: 840,
    apm: 23,
    date: "2026-10-10T19:40:00.000Z",
    title: "🎖️ 神级巡抚 · 行走大英豪",
  },
  {
    id: "record-4",
    playerName: "行者无疆",
    score: 285,
    total: 389,
    elapsedSeconds: 720,
    apm: 24,
    date: "2026-10-08T09:30:00.000Z",
    title: "🌟 华夏探险家 · 博闻强识",
  },
  {
    id: "record-5",
    playerName: "山海漫步",
    score: 215,
    total: 389,
    elapsedSeconds: 610,
    apm: 21,
    date: "2026-10-05T16:00:00.000Z",
    title: "🌟 华夏探险家 · 博闻强识",
  },
];

function MapFillGame() {
  const { metadata, items, aliasMap } = gameData;
  const totalCount = metadata.totalCount || items.length;

  // 模式选择：中国地图 (当前) / 全球地图 (开发中) / 省级地图 (开发中)
  const [activeMapMode, setActiveMapMode] = useState("china");

  // 玩家昵称
  const [playerName, setPlayerName] = useState(() => {
    try {
      return (
        localStorage.getItem("map_fill_player_name") ||
        localStorage.getItem("geoguessr_player_name") ||
        "旅行探险家"
      );
    } catch {
      return "旅行探险家";
    }
  });

  // 排行榜列表
  const [leaderboard, setLeaderboard] = useState(() => {
    try {
      const saved = localStorage.getItem("china_map_fill_leaderboard");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load map fill leaderboard:", e);
    }
    return INITIAL_FILL_LEADERBOARD;
  });

  // 核心游戏状态：'idle' (初始主界面/欢迎页) | 'playing' (答题中) | 'surrendered' (交卷揭晓) | 'completed' (完美通关)
  const [gameState, setGameState] = useState("idle");
  const [guessedIds, setGuessedIds] = useState(new Set());
  const [inputVal, setInputVal] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastGuessedCity, setLastGuessedCity] = useState(null);
  const [toast, setToast] = useState(null);

  // 界面状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [activeRegionTab, setActiveRegionTab] = useState("all");
  const [hoveredCity, setHoveredCity] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // SVG 地图平移与缩放 (Pan & Zoom)
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const zoomRef = useRef({ scale: 1, x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const mapSvgContainerRef = useRef(null);
  const svgRef = useRef(null);
  const svgGroupRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const toastTimerRef = useRef(null);

  // 同步 zoom 到 ref 并更新 DOM 节点属性
  useEffect(() => {
    zoomRef.current = zoom;
    if (svgGroupRef.current) {
      svgGroupRef.current.setAttribute(
        "transform",
        `translate(${zoom.x}, ${zoom.y}) scale(${zoom.scale})`
      );
    }
  }, [zoom]);

  // 修改玩家名
  const handlePlayerNameChange = (newName) => {
    const trimmed = (newName || "").trim() || "旅行探险家";
    setPlayerName(trimmed);
    try {
      localStorage.setItem("map_fill_player_name", trimmed);
    } catch (e) {
      console.warn(e);
    }
  };

  // 快速查找 Map
  const cityById = useMemo(() => {
    const map = new Map();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  // 按省份和区域对城市进行归类分组
  const regionGrouped = useMemo(() => {
    const regions = {};
    REGION_CONFIG.slice(1).forEach((r) => {
      regions[r.name] = { count: 0, guessed: 0, provinces: {} };
    });

    items.forEach((item) => {
      const reg = item.region || "其他";
      const prov = item.province || "其他";
      if (!regions[reg]) {
        regions[reg] = { count: 0, guessed: 0, provinces: {} };
      }
      regions[reg].count++;
      if (guessedIds.has(item.id)) {
        regions[reg].guessed++;
      }

      if (!regions[reg].provinces[prov]) {
        regions[reg].provinces[prov] = [];
      }
      regions[reg].provinces[prov].push(item);
    });

    return regions;
  }, [items, guessedIds]);

  // 浮动轻提示
  const showToast = useCallback((msg, type = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  // 计时器控制
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // 评级称号
  const getRatingTitle = (count) => {
    if (count >= 389) return "🏆 九州至尊 · 华夏活地图";
    if (count >= 300) return "🎖️ 神级巡抚 · 行走大英豪";
    if (count >= 200) return "🌟 华夏探险家 · 博闻强识";
    if (count >= 100) return "🧭 进阶旅人 · 见多识广";
    if (count >= 40) return "🎒 启程行者 · 渐入佳境";
    return "🌱 初出茅庐 · 继续探索";
  };

  // 保存成绩至荣誉排行榜
  const recordToLeaderboard = useCallback(
    (count, seconds) => {
      if (count <= 0) return;
      const minutes = Math.max(seconds / 60, 0.1);
      const apm = Math.round(count / minutes);
      const newEntry = {
        id: `rec-${Date.now()}`,
        playerName: playerName || "旅行探险家",
        score: count,
        total: totalCount,
        elapsedSeconds: seconds,
        apm,
        date: new Date().toISOString(),
        title: getRatingTitle(count),
      };

      setLeaderboard((prev) => {
        const next = [...prev, newEntry];
        next.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.elapsedSeconds - b.elapsedSeconds;
        });
        const trimmed = next.slice(0, 15);
        try {
          localStorage.setItem("china_map_fill_leaderboard", JSON.stringify(trimmed));
        } catch (e) {
          console.warn("Failed to persist leaderboard:", e);
        }
        return trimmed;
      });
    },
    [playerName, totalCount]
  );

  // 开始新挑战 (从主界面或重开进入答题界面)
  const handleStartGame = () => {
    setGuessedIds(new Set());
    setElapsedSeconds(0);
    setInputVal("");
    setLastGuessedCity(null);
    setGameState("playing");
    setShowResultModal(false);
    setZoom({ scale: 1, x: 0, y: 0 });
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 120);
  };

  // 返回主界面 (退出当前挑战)
  const handleReturnToLobby = () => {
    if (gameState === "playing" && guessedIds.size > 0) {
      if (!window.confirm("当前挑战正在进行中，确认返回主界面吗？当前进度将重置。")) {
        return;
      }
    }
    setGameState("idle");
    setGuessedIds(new Set());
    setElapsedSeconds(0);
    setInputVal("");
    setLastGuessedCity(null);
    setShowResultModal(false);
    setZoom({ scale: 1, x: 0, y: 0 });
  };

  // 结束挑战并交卷揭晓
  const handleSurrender = () => {
    if (gameState !== "playing") return;
    setGameState("surrendered");
    setShowResultModal(true);
    recordToLeaderboard(guessedIds.size, elapsedSeconds);
    showToast("已揭晓全图未填行政区，可在地图中自由复盘探索！", "warning");
  };

  // 重新开始当前局
  const handleRestart = () => {
    if (window.confirm("确定要重新开始一局吗？当前进度将重置。")) {
      handleStartGame();
    }
  };

  // 输入监听与命中判定（极速 0 延迟秒清）
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputVal(val);

    if (gameState !== "playing") return;

    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;

    // 查找别名表
    const matchedId = aliasMap[trimmed];
    if (matchedId) {
      if (guessedIds.has(matchedId)) {
        const city = cityById.get(matchedId);
        showToast(`「${city ? city.name : matchedId}」之前已经填过啦！`, "warning");
        setInputVal("");
        return;
      }

      // 命中新行政区！
      const targetCity = cityById.get(matchedId);
      const nextSet = new Set(guessedIds);
      nextSet.add(matchedId);
      setGuessedIds(nextSet);
      setLastGuessedCity(targetCity);
      setInputVal(""); // 极速清空输入框，支持无阻打字连击

      showToast(`🎯 成功点亮：${targetCity.name} (${targetCity.province})`, "success");

      // 达成 100% 完美通关
      if (nextSet.size === totalCount) {
        setGameState("completed");
        setShowResultModal(true);
        recordToLeaderboard(totalCount, elapsedSeconds);
        showToast("🎉 恭喜！你已完整点亮中国全部 389 个行政区！", "success");
      }
    }
  };

  // =========================================================================
  // 精准以鼠标光标为中心的等比丝滑缩放引擎 (Zoom to Mouse Position)
  // =========================================================================
  useEffect(() => {
    const container = mapSvgContainerRef.current;
    if (!container) return;

    let syncStateTimer = null;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const svg = svgRef.current;
      if (!svg) return;

      const ctm = svg.getScreenCTM();
      if (!ctm) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(ctm.inverse());

      // 计算平滑指数缩放倍率：支持鼠标滚轮与高精度触控板
      const zoomDelta = -e.deltaY * 0.0022;
      const zoomFactor = Math.min(Math.max(Math.exp(zoomDelta), 0.72), 1.38);

      const current = zoomRef.current;
      const newScale = Math.min(Math.max(current.scale * zoomFactor, 0.6), 12);

      // 以光标在 SVG 用户视口坐标系中的实际几何点为锚点
      const newX = svgP.x - (svgP.x - current.x) * (newScale / current.scale);
      const newY = svgP.y - (svgP.y - current.y) * (newScale / current.scale);

      zoomRef.current = { scale: newScale, x: newX, y: newY };

      // 120 FPS 绕过 React 直接硬件加速更新
      if (svgGroupRef.current) {
        svgGroupRef.current.setAttribute(
          "transform",
          `translate(${newX}, ${newY}) scale(${newScale})`
        );
      }

      if (syncStateTimer) clearTimeout(syncStateTimer);
      syncStateTimer = setTimeout(() => {
        setZoom({ scale: newScale, x: newX, y: newY });
      }, 80);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (syncStateTimer) clearTimeout(syncStateTimer);
    };
  }, [gameState]);

  // =========================================================================
  // 120 FPS 极速跟手拖拽漫游引擎 (Direct DOM Pan)
  // =========================================================================
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // 仅左键拖拽
    const svg = svgRef.current;
    if (!svg) return;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const startSvgP = pt.matrixTransform(ctm.inverse());
    const startTransform = { ...zoomRef.current };

    isDraggingRef.current = true;
    setIsDragging(true);

    const handleWindowMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const curPt = svg.createSVGPoint();
      curPt.x = moveEvent.clientX;
      curPt.y = moveEvent.clientY;
      const curCtm = svg.getScreenCTM();
      if (!curCtm) return;
      const curSvgP = curPt.matrixTransform(curCtm.inverse());

      const dx = curSvgP.x - startSvgP.x;
      const dy = curSvgP.y - startSvgP.y;

      const nextX = startTransform.x + dx;
      const nextY = startTransform.y + dy;

      zoomRef.current.x = nextX;
      zoomRef.current.y = nextY;

      if (svgGroupRef.current) {
        svgGroupRef.current.setAttribute(
          "transform",
          `translate(${nextX}, ${nextY}) scale(${zoomRef.current.scale})`
        );
      }
    };

    const handleWindowMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setZoom({ ...zoomRef.current });
      }
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  };

  // 工具栏缩放按钮：以视口中心 (400, 240) 为基准
  const handleZoomIn = () => {
    const current = zoomRef.current;
    const newScale = Math.min(current.scale * 1.3, 12);
    const cx = 400;
    const cy = 240;
    const newX = cx - (cx - current.x) * (newScale / current.scale);
    const newY = cy - (cy - current.y) * (newScale / current.scale);

    zoomRef.current = { scale: newScale, x: newX, y: newY };
    if (svgGroupRef.current) {
      svgGroupRef.current.setAttribute(
        "transform",
        `translate(${newX}, ${newY}) scale(${newScale})`
      );
    }
    setZoom({ scale: newScale, x: newX, y: newY });
  };

  const handleZoomOut = () => {
    const current = zoomRef.current;
    const newScale = Math.max(current.scale * 0.76, 0.6);
    const cx = 400;
    const cy = 240;
    const newX = cx - (cx - current.x) * (newScale / current.scale);
    const newY = cy - (cy - current.y) * (newScale / current.scale);

    zoomRef.current = { scale: newScale, x: newX, y: newY };
    if (svgGroupRef.current) {
      svgGroupRef.current.setAttribute(
        "transform",
        `translate(${newX}, ${newY}) scale(${newScale})`
      );
    }
    setZoom({ scale: newScale, x: newX, y: newY });
  };

  const handleResetZoom = () => {
    zoomRef.current = { scale: 1, x: 0, y: 0 };
    if (svgGroupRef.current) {
      svgGroupRef.current.setAttribute("transform", "translate(0, 0) scale(1)");
    }
    setZoom({ scale: 1, x: 0, y: 0 });
  };

  // 聚焦到指定城市
  const handleFocusCity = (city) => {
    if (!city || !city.bbox) return;
    const targetScale = 3.5;
    const cx = 400;
    const cy = 240;
    const offsetX = cx - city.bbox.cx * targetScale;
    const offsetY = cy - city.bbox.cy * targetScale;
    zoomRef.current = { scale: targetScale, x: offsetX, y: offsetY };
    if (svgGroupRef.current) {
      svgGroupRef.current.setAttribute(
        "transform",
        `translate(${offsetX}, ${offsetY}) scale(${targetScale})`
      );
    }
    setZoom({
      scale: targetScale,
      x: offsetX,
      y: offsetY,
    });
  };

  // 时间格式化 MM:SS
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((guessedIds.size / totalCount) * 100).toFixed(1);

  // 打字速度 (CPM / APM)
  const currentApm = useMemo(() => {
    if (elapsedSeconds <= 0) return 0;
    const mins = elapsedSeconds / 60;
    return Math.round(guessedIds.size / mins);
  }, [guessedIds.size, elapsedSeconds]);

  // 性能关键优化：389 个矢量多边形缓存记忆，鼠标悬停时绝不引起 389 个路径重新 Diff 渲染！
  const renderedCityPaths = useMemo(() => {
    return items.map((item) => {
      const isGuessed = guessedIds.has(item.id);
      const isJustGuessed = lastGuessedCity?.id === item.id;
      const isMissed = gameState === "surrendered" && !isGuessed;

      let polygonClass = "map-city-polygon unfilled";
      if (isGuessed) {
        polygonClass = isJustGuessed
          ? "map-city-polygon guessed just-guessed"
          : "map-city-polygon guessed";
      } else if (isMissed) {
        polygonClass = "map-city-polygon missed";
      }

      return (
        <path
          key={item.id}
          d={item.d}
          className={polygonClass}
          onMouseEnter={() => setHoveredCity(item)}
          onMouseLeave={() => setHoveredCity(null)}
        />
      );
    });
  }, [items, guessedIds, lastGuessedCity, gameState]);

  return (
    <section className="travel-game-section" id="travel-game-section" aria-label="中国地图填充小游戏">
      {/* ================================================================
          1. 顶部全局标题栏与选项卡 (对标旅行图寻头部)
          ================================================================ */}
      <div className="travel-game-header-row">
        <div className="travel-game-title-group">
          <h2 className="notes-hero-title">
            <MapIcon className="notes-hero-icon" size={24} />
            <span>MAP FILL</span>
            <span className="notes-title-sub">中国地图填充</span>
          </h2>
          <p className="travel-game-subtitle">
            <Sparkles size={16} className="game-sub-icon" />
            <span>盲填全国 389 个地级行政区。输入地名点亮壮丽山河！</span>
          </p>
        </div>

        {/* 顶部操作群组：玩家代号 + 排行榜 + 地图分类选项卡 + 行政区名录 */}
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
            onClick={() => setIsLeaderboardOpen(true)}
            title="查看中国地图盲填荣耀排行榜"
          >
            <Trophy size={15} />
            <span>排行榜 Top 10</span>
          </button>

          {/* 题库分类选项卡：对应 中国地图 / 全球地图 / 省级地图 */}
          <div className="travel-game-category-tabs">
            <button
              type="button"
              className={`game-tab-btn ${activeMapMode === "china" ? "active" : ""}`}
              onClick={() => setActiveMapMode("china")}
            >
              中国地图
            </button>
            <button
              type="button"
              className={`game-tab-btn ${activeMapMode === "world" ? "active" : ""}`}
              onClick={() => {
                showToast("🌍 全球地图盲填正在全力开发中，敬请期待！", "info");
              }}
              title="全球地图盲填 (即将推出)"
            >
              全球地图
            </button>
            <button
              type="button"
              className={`game-tab-btn ${activeMapMode === "province" ? "active" : ""}`}
              onClick={() => {
                showToast("🗺️ 省级细化区县盲填正在全力开发中，敬请期待！", "info");
              }}
              title="省级地图盲填 (即将推出)"
            >
              省级地图
            </button>
          </div>

          {/* 行政区名录按钮 (更名自原“分区打卡”) */}
          <button
            type="button"
            className={`game-roster-btn ${isDrawerOpen ? "is-active" : ""}`}
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            title="查看全国行政区名录与分区探索进度"
          >
            <ListFilter size={15} />
            <span>行政区名录</span>
            <span className="btn-counter-badge">
              {guessedIds.size}/{totalCount}
            </span>
          </button>
        </div>
      </div>

      {/* 主游戏交互卡片容器：对标 TravelGuessGame 的 travel-game-card */}
      <div className="travel-game-card">
        {/* ================================================================
            2. 视图分支 A：欢迎主界面 (IDLE 状态，对标实景图寻主界面)
            ================================================================ */}
        {gameState === "idle" && (
          <div className="game-welcome-banner">
            <div className="game-welcome-content">
            <div className="game-welcome-badge">
              <Globe2 size={15} />
              <span>全域矢量行政区划 · 交互盲填</span>
            </div>
            <h3>欢迎来到中国地图盲填！</h3>
            <p className="game-welcome-desc">
              考验您对中国全域行政区划记忆与地理储备的时刻到了——无需回车，直接输入地名，让 389 个行政区轮廓在指尖逐一点亮，亲手描摹壮丽山河的辽阔版图！
            </p>

            {/* 玩家昵称输入设置区 */}
            <div className="game-player-setup-card">
              <div className="player-setup-left">
                <div className="player-avatar-badge">
                  <User size={18} />
                </div>
                <div className="player-input-group">
                  <label htmlFor="welcome-player-input">探索者昵称 / 玩家名称</label>
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
                onClick={() => setIsLeaderboardOpen(true)}
                title="查看历史排行榜"
              >
                <Trophy size={16} />
                <span>查看排行榜 Top 10</span>
              </button>
            </div>

            {/* 三大规则特色卡片 */}
            <div className="game-rules-grid">
              <div className="game-rule-item">
                <div className="rule-icon-box">1</div>
                <div>
                  <strong>免敲回车即时点亮</strong>
                  <p>输入地名命中后系统秒速识别点亮，自动清空输入框并保持聚焦，支持畅快连击输入</p>
                </div>
              </div>
              <div className="game-rule-item">
                <div className="rule-icon-box">2</div>
                <div>
                  <strong>光标中心丝滑缩放</strong>
                  <p>鼠标悬停任意位置滑动滚轮，精准以光标为锚点平滑缩放，微距观察细小地级县市</p>
                </div>
              </div>
              <div className="game-rule-item">
                <div className="rule-icon-box">3</div>
                <div>
                  <strong>389 全域行政单元覆盖</strong>
                  <p>涵盖全国333个地级行政区、新疆兵团直辖市、海南省直管市县等全域矢量行政轮廓</p>
                </div>
              </div>
            </div>

            {/* 开始挑战大按钮 */}
            <div className="game-welcome-actions">
              <button
                type="button"
                className="game-primary-btn start-btn"
                onClick={handleStartGame}
              >
                <Compass size={18} />
                以「{playerName || "旅行探险家"}」开始挑战
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          3. 视图分支 B：游戏进行中 / 结算复盘看板 (PLAYING / SURRENDERED / COMPLETED)
          ================================================================ */}
      {gameState !== "idle" && (
        <div className="map-fill-arena-wrapper">
          {/* 现代仪表盘控制栏：数据指标 + 居中极速打字胶囊 + 挑战控制 */}
          <div className="map-fill-dashboard-bar">
            {/* 左侧指标群：用时 + 进度 + 手速 */}
            <div className="map-fill-metrics-group">
              <div className="map-fill-metric-pill timer-pill" title="挑战进行用时">
                <Clock size={15} className="metric-icon timer-icon" />
                <span className="metric-value">{formatTime(elapsedSeconds)}</span>
              </div>

              <div className="map-fill-metric-pill progress-pill" title="已点亮行政区数量">
                <Trophy size={15} className="metric-icon trophy-icon" />
                <span className="metric-value">
                  <strong>{guessedIds.size}</strong> / {totalCount}
                </span>
                <span className="metric-sub">({progressPercent}%)</span>
              </div>

              <div className="map-fill-metric-pill apm-pill" title="当前输入答题手速">
                <Zap size={15} className="metric-icon zap-icon" />
                <span className="metric-value">{currentApm}</span>
                <span className="metric-sub">市/分</span>
              </div>
            </div>

            {/* 中间核心输入胶囊 */}
            <div className="map-fill-input-box">
              <div
                className={`map-fill-input-capsule ${
                  gameState === "playing" ? "is-focused" : ""
                }`}
              >
                <Search size={18} className="input-search-icon" />
                <input
                  ref={inputRef}
                  type="text"
                  className="map-fill-main-input"
                  value={inputVal}
                  onChange={handleInputChange}
                  disabled={gameState === "surrendered" || gameState === "completed"}
                  placeholder="输入地名，无需回车立即点亮..."
                />
                {inputVal && (
                  <button
                    type="button"
                    className="input-clear-btn"
                    onClick={() => setInputVal("")}
                    title="清空输入"
                  >
                    <X size={15} />
                  </button>
                )}
                <span className="input-counter-tag">
                  {guessedIds.size} / {totalCount}
                </span>
              </div>

              {/* 全局轻提示浮标 */}
              {toast && (
                <div className={`map-fill-toast toast-${toast.type}`}>
                  {toast.type === "success" && <Sparkles size={15} />}
                  {toast.type === "warning" && <AlertCircle size={15} />}
                  {toast.type === "info" && <Compass size={15} />}
                  <span>{toast.msg}</span>
                </div>
              )}
            </div>

            {/* 右侧主行动按钮 */}
            <div className="map-fill-actions-group">
              {gameState === "playing" && (
                <>
                  <button
                    type="button"
                    className="map-fill-btn btn-danger-ghost"
                    onClick={handleSurrender}
                    title="结束挑战并揭晓全图所有未填行政区"
                  >
                    <Flag size={15} />
                    <span>交卷揭晓</span>
                  </button>
                  <button
                    type="button"
                    className="map-fill-btn btn-ghost"
                    onClick={handleRestart}
                    title="重新开始挑战"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    type="button"
                    className="map-fill-btn btn-ghost"
                    onClick={handleReturnToLobby}
                    title="返回游戏主界面"
                  >
                    <Home size={15} />
                  </button>
                </>
              )}

              {(gameState === "surrendered" || gameState === "completed") && (
                <>
                  <button
                    type="button"
                    className="map-fill-btn btn-primary"
                    onClick={handleStartGame}
                  >
                    <RotateCcw size={16} />
                    <span>再战一局</span>
                  </button>
                  <button
                    type="button"
                    className="map-fill-btn btn-ghost"
                    onClick={handleReturnToLobby}
                    title="返回主界面"
                  >
                    <Home size={15} />
                    <span>主界面</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 整体进度细长光条 */}
          <div className="map-fill-progress-track">
            <div
              className="map-fill-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 游戏主交互舞台区：注入海洋水系色调，告别灰蒙蒙，使中国主体立体饱满！ */}
          <div className="map-fill-stage">
            {/* 核心 SVG 矢量地图视口容器 */}
            <div
              ref={mapSvgContainerRef}
              className={`map-fill-viewport ${isDragging ? "is-dragging" : ""}`}
              onMouseDown={handleMouseDown}
            >
              {/* 地图悬浮工具箱 (放大、缩小、重置视角) */}
              <div className="map-fill-view-tools">
                <button
                  type="button"
                  className="tool-btn"
                  onClick={handleZoomIn}
                  title="放大地图"
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={handleZoomOut}
                  title="缩小地图"
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  type="button"
                  className="tool-btn"
                  onClick={handleResetZoom}
                  title="重置全景主体视角"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* 实时光标悬停行政区卡片：仅对已答出或揭晓行政区生效，保密防作弊 */}
              {hoveredCity &&
                (guessedIds.has(hoveredCity.id) ||
                  gameState === "surrendered" ||
                  gameState === "completed") && (
                  <div className="map-fill-hover-card">
                    <div className="hover-card-title">{hoveredCity.name}</div>
                    <div className="hover-card-sub">
                      {hoveredCity.province} · {hoveredCity.region}
                    </div>
                    <div className="hover-card-status">
                      {guessedIds.has(hoveredCity.id) ? (
                        <span className="status-unlocked">
                          <Check size={13} /> 已点亮
                        </span>
                      ) : (
                        <span className="status-missed">未答出</span>
                      )}
                    </div>
                  </div>
                )}

              {/* SVG 主画板：主体视角范围设为 0 -30 800 540，图框上下更充裕拉长，中国陆地主体完美居中！ */}
              <svg
                ref={svgRef}
                className="map-fill-svg-canvas"
                viewBox="0 -30 800 540"
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <defs>
                  <linearGradient id="guessedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>

                {/* 可平移缩放主图层组 */}
                <g
                  ref={svgGroupRef}
                  transform={`translate(${zoom.x}, ${zoom.y}) scale(${zoom.scale})`}
                  className="map-fill-interactive-group"
                >
                  {/* 中国宏观边框轮廓底层 */}
                  {metadata.chinaOutline && (
                    <path
                      d={metadata.chinaOutline}
                      className="map-fill-china-outline-bg"
                    />
                  )}

                  {/* 389 个行政区矢量路径 (已使用 useMemo 缓存，悬停 0 消耗) */}
                  {renderedCityPaths}

                  {/* 顶层悬停高光轮廓线：无论与任何相邻城市共享边界，均在最上层绘制，保证 360 度绝对等宽 */}
                  {hoveredCity && (
                    <path
                      d={hoveredCity.d}
                      className="map-city-hover-stroke-top"
                    />
                  )}
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ================================================================
          4. 右侧行政区名录抽屉看板 (更名自“分区打卡”，遮罩浮层与极速全览网格)
          ================================================================ */}
      {isDrawerOpen && (
        <div
          className="game-drawer-overlay"
          onClick={() => setIsDrawerOpen(false)}
        >
          <aside
            className="map-fill-drawer is-open"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <ListFilter size={18} className="drawer-icon" />
            <div>
              <h3 className="drawer-title">全国行政区名录</h3>
              <span className="drawer-sub">七大区域· 389 城市清单</span>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setIsDrawerOpen(false)}
            title="关闭名录"
          >
            <X size={18} />
          </button>
        </div>

        {/* 大区过滤选项卡：2行4列网格，确保所有大区完全可见直接点击！ */}
        <div className="drawer-tabs-grid">
          {REGION_CONFIG.map((r) => {
            const info = r.key === "all" ? null : regionGrouped[r.name];
            const count = r.key === "all" ? totalCount : info?.count || 0;
            const guessed = r.key === "all" ? guessedIds.size : info?.guessed || 0;
            const pct = count ? Math.round((guessed / count) * 100) : 0;

            return (
              <button
                key={r.key}
                type="button"
                className={`drawer-tab-card ${activeRegionTab === r.key ? "is-active" : ""}`}
                onClick={() => setActiveRegionTab(r.key)}
              >
                <div className="tab-card-top">
                  <span className="tab-card-name">{r.name}</span>
                  <span className="tab-card-pct">{pct}%</span>
                </div>
                <div className="tab-card-counter">
                  {guessed}/{count}
                </div>
              </button>
            );
          })}
        </div>

        {/* 各省份城市清单列表 */}
        <div className="drawer-content-scroll">
          {Object.entries(regionGrouped)
            .filter(([regName]) => {
              if (activeRegionTab === "all") return true;
              const config = REGION_CONFIG.find((c) => c.name === regName);
              return config?.key === activeRegionTab;
            })
            .map(([regName, regData]) => {
              const regPercent = (
                (regData.guessed / (regData.count || 1)) *
                100
              ).toFixed(0);

              return (
                <div key={regName} className="drawer-region-block">
                  <div className="region-block-header">
                    <div className="region-block-title-row">
                      <span className="region-name">{regName}</span>
                      <span className="region-badge-pill">
                        {regData.guessed} / {regData.count} ({regPercent}%)
                      </span>
                    </div>
                    <div className="region-sub-progress-bar">
                      <div
                        className="region-sub-progress-fill"
                        style={{ width: `${regPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* 省级清单 */}
                  <div className="provinces-stack">
                    {Object.entries(regData.provinces).map(
                      ([provName, cityList]) => {
                        const provGuessed = cityList.filter((c) =>
                          guessedIds.has(c.id)
                        ).length;
                        const isComplete = provGuessed === cityList.length;
                        const provPct = Math.round(
                          (provGuessed / cityList.length) * 100
                        );

                        return (
                          <div
                            key={provName}
                            className={`province-card ${isComplete ? "is-complete" : ""}`}
                          >
                            <div className="province-card-head">
                              <div className="province-title-side">
                                <span className="province-name">{provName}</span>
                                {isComplete && (
                                  <span className="province-cleared-tag">已全点亮</span>
                                )}
                              </div>
                              <span className="province-counter">
                                {provGuessed} / {cityList.length} ({provPct}%)
                              </span>
                            </div>

                            <div className="city-chips-grid">
                              {cityList.map((city, idx) => {
                                const isCityGuessed = guessedIds.has(city.id);
                                const isCityMissed =
                                  gameState === "surrendered" && !isCityGuessed;

                                return (
                                  <button
                                    key={city.id}
                                    type="button"
                                    className={`city-chip ${
                                      isCityGuessed
                                        ? "is-guessed"
                                        : isCityMissed
                                        ? "is-missed"
                                        : "is-locked"
                                    }`}
                                    onClick={() => {
                                      if (gameState !== "idle") {
                                        handleFocusCity(city);
                                      }
                                    }}
                                    title={
                                      isCityGuessed
                                        ? `已点亮 · 点击在地图上定位 ${city.name}`
                                        : isCityMissed
                                        ? `未答出 · 点击在地图上定位 ${city.name}`
                                        : "尚未填入该行政区"
                                    }
                                  >
                                    {isCityGuessed ? (
                                      <>
                                        <Check size={12} className="chip-check-icon" />
                                        <span>{city.name}</span>
                                      </>
                                    ) : isCityMissed ? (
                                      <span>{city.name}</span>
                                    ) : (
                                      <span className="chip-slot-num">
                                        {(idx + 1).toString().padStart(2, "0")}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            })}
        </div>
          </aside>
        </div>
      )}

      {/* ================================================================
          5. 结算战报弹窗 (达成 100% 或交卷揭晓时)
          ================================================================ */}
      {showResultModal && (
        <div className="map-fill-modal-backdrop" onClick={() => setShowResultModal(false)}>
          <div className="map-fill-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-badge-row">
                <Trophy size={18} className="modal-badge-icon" />
                <span>CHALLENGE REPORT</span>
              </div>
              <h3 className="modal-title">
                {gameState === "completed"
                  ? "🎉 完美通关！中国地图全部点亮！"
                  : "🗺️ 挑战结算战报"}
              </h3>
              <p className="modal-subtitle">{getRatingTitle(guessedIds.size)}</p>
            </div>

            {/* 核心战绩数据看板 */}
            <div className="modal-stats-grid">
              <div className="modal-stat-box">
                <span className="stat-num">{guessedIds.size}</span>
                <span className="stat-label">已填行政区 (共{totalCount})</span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-num">{progressPercent}%</span>
                <span className="stat-label">全国点亮达成率</span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-num">{formatTime(elapsedSeconds)}</span>
                <span className="stat-label">总用时</span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-num">{currentApm}</span>
                <span className="stat-label">平均手速 (市/分)</span>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="map-fill-btn btn-ghost"
                onClick={() => setShowResultModal(false)}
              >
                <span>复盘浏览</span>
              </button>
              <button
                type="button"
                className="map-fill-btn btn-primary"
                onClick={() => {
                  setShowResultModal(false);
                  handleStartGame();
                }}
              >
                <RotateCcw size={16} />
                <span>再战一局</span>
              </button>
              <button
                type="button"
                className="map-fill-btn btn-ghost"
                onClick={() => {
                  setShowResultModal(false);
                  handleReturnToLobby();
                }}
              >
                <Home size={16} />
                <span>返回主界面</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          6. 荣誉排行榜弹窗 (Top 10)
          ================================================================ */}
      {isLeaderboardOpen && (
        <div className="game-modal-overlay" onClick={() => setIsLeaderboardOpen(false)}>
          <div
            className="game-modal-card leaderboard-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="game-modal-header">
              <div className="modal-title-group">
                <Trophy className="modal-header-icon" size={24} />
                <div>
                  <h3 className="game-modal-title">中国地图盲填 · 荣誉排行榜</h3>
                  <p className="game-modal-subtitle">
                    记录全国 389 域行政区盲填挑战的高光战绩与手速巅峰
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsLeaderboardOpen(false)}
                title="关闭"
              >
                <X size={20} />
              </button>
            </div>

            {/* 弹窗内容区 */}
            <div className="game-modal-body">
              <div className="leaderboard-list-view">
                <div className="leaderboard-dropdown-bar">
                  <span className="leaderboard-count-tag">
                    收录前 {leaderboard.length} 位高光记录
                  </span>
                </div>

                <div className="leaderboard-rows-container">
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1;
                    const entryPct = entry.total
                      ? Math.round((entry.score / entry.total) * 100)
                      : 0;

                    return (
                      <div
                        key={entry.id || index}
                        className={`leaderboard-row-card rank-${rank}`}
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
                            <span className="player-title-tag">
                              {entry.title || "华夏探险家"}
                            </span>
                          </div>
                          <div className="player-sub-meta-chips">
                            <span className="meta-chip time-chip" title="挑战时间">
                              <Calendar size={13} />
                              <span>{entry.date ? entry.date.split("T")[0] : "近期"}</span>
                            </span>
                            <span className="meta-chip duration-chip" title="挑战总用时">
                              <Clock size={13} />
                              <span>用时 {formatTime(entry.elapsedSeconds)}</span>
                            </span>
                            <span className="meta-chip apm-chip" title="平均答题手速">
                              <Zap size={13} />
                              <span>{entry.apm || 0} 市/分</span>
                            </span>
                          </div>
                        </div>

                        <div className="leaderboard-score-right">
                          <span className="leaderboard-score-val">
                            {entry.score}
                            <small> / {entry.total || totalCount}</small>
                          </span>
                          <span className="leaderboard-score-sub">{entryPct}% 点亮</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default React.memo(MapFillGame);
