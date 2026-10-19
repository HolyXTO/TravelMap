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
  Eye,
  AlertTriangle,
  Map as MapIcon,
} from "lucide-react";
import chinaGameData from "./data/chinaPrefecturesGameData.json";
import worldGameData from "./data/worldCountriesGameData.json";
import { supabase } from "./lib/supabase";

// 七大地理大区排序与色彩 (中国地图)
const CHINA_REGION_CONFIG = [
  { name: "全部", key: "all" },
  { name: "华东", key: "华东", color: "#2563eb" },
  { name: "华北", key: "华北", color: "#059669" },
  { name: "华中", key: "华中", color: "#d97706" },
  { name: "华南", key: "华南", color: "#dc2626" },
  { name: "西南", key: "西南", color: "#7c3aed" },
  { name: "西北", key: "西北", color: "#0891b2" },
  { name: "东北", key: "东北", color: "#4f46e5" },
];

// 六大洲分类 (全球地图)
const WORLD_CONTINENT_CONFIG = [
  { name: "全部", key: "all" },
  { name: "亚洲", key: "亚洲", color: "#e11d48" },
  { name: "欧洲", key: "欧洲", color: "#2563eb" },
  { name: "非洲", key: "非洲", color: "#d97706" },
  { name: "北美洲", key: "北美洲", color: "#059669" },
  { name: "南美洲", key: "南美洲", color: "#7c3aed" },
  { name: "大洋洲", key: "大洋洲", color: "#0891b2" },
];

// 初始高光荣誉榜设为空数组（杜绝任何测试假数据）
const INITIAL_CHINA_LEADERBOARD = [];
const INITIAL_WORLD_LEADERBOARD = [];

// 判定是否属于旧的测试/虚拟记录（彻底剔除测试假数据）
const MOCK_IDS = new Set([
  "record-1",
  "record-2",
  "record-3",
  "record-4",
  "record-5",
  "world-rec-1",
  "world-rec-2",
  "world-rec-3",
  "world-rec-4",
  "world-rec-5",
]);
const MOCK_NAMES = new Set([
  "Tang & Xiao",
  "华夏游侠",
  "地理博主阿杰",
  "行者无疆",
  "山海漫步",
  "GlobeTrotter",
  "联合国巡礼者",
  "Atlas Walker",
  "五洲远航",
  "极地星辰",
  "test",
  "test-player",
  "test-deleted",
]);

function isMockRecord(entry) {
  if (!entry) return true;
  const id = String(entry.id || "");
  if (MOCK_IDS.has(id)) return true;
  if (
    id.startsWith("test-") ||
    id.startsWith("record-") ||
    id.startsWith("world-rec-") ||
    id.includes("test")
  ) {
    return true;
  }
  const name = String(entry.playerName || entry.player_name || "").trim();
  if (MOCK_NAMES.has(name) || name.toLowerCase().startsWith("test")) {
    return true;
  }
  return false;
}

// 评级称号计算函数
function getRatingTitle(count, isWorld = false) {
  if (!isWorld) {
    if (count >= 389) return "🏆 九州至尊 · 华夏活地图";
    if (count >= 300) return "🎖️ 神级巡抚 · 行走大英豪";
    if (count >= 200) return "🌟 华夏探险家 · 博闻强识";
    if (count >= 100) return "🧭 进阶旅人 · 见多识广";
    if (count >= 40) return "🎒 启程行者 · 渐入佳境";
    return "🌱 初出茅庐 · 继续探索";
  } else {
    if (count >= 197) return "🏆 万国通鉴 · 全球地理大师";
    if (count >= 160) return "🎖️ 神级巡礼 · 行走联合国";
    if (count >= 120) return "🌟 环球探险家 · 渊博学识";
    if (count >= 60) return "🧭 进阶行者 · 见多识广";
    if (count >= 25) return "🎒 启程旅人 · 渐入佳境";
    return "🌱 初识世界 · 继续探索";
  }
}

// 合并与去重记录（过滤测试记录，优先按得分降序、用时升序排序）
function mergeLeaderboardRecords(existingList = [], incomingList = []) {
  const map = new Map();
  for (const item of existingList) {
    if (isMockRecord(item)) continue;
    const key =
      item.id ||
      `${item.playerName}-${item.score}-${item.elapsedSeconds}`;
    map.set(key, item);
  }
  for (const item of incomingList) {
    if (isMockRecord(item)) continue;
    const key =
      item.id ||
      `${item.playerName}-${item.score}-${item.elapsedSeconds}`;
    map.set(key, item);
  }
  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.elapsedSeconds || 0) - (b.elapsedSeconds || 0);
  });
  return merged.slice(0, 15);
}

// 从 Supabase 云端拉取地图填充排行榜
async function fetchCloudMapFillLeaderboards(mode = "china") {
  if (!supabase) return null;
  const isWorld = mode === "world";

  // 1. 尝试单独的 map_fill_leaderboards 专属表
  try {
    const { data: dedicated, error: dErr } = await supabase
      .from("map_fill_leaderboards")
      .select("*")
      .eq("mode", mode)
      .gt("score", 0)
      .order("score", { ascending: false })
      .order("elapsed_seconds", { ascending: true })
      .order("date", { ascending: false })
      .limit(20);

    if (!dErr && Array.isArray(dedicated) && dedicated.length >= 0) {
      return dedicated
        .filter((r) => !isMockRecord({ id: r.id, playerName: r.player_name }))
        .map((r) => ({
          id: r.id,
          playerName: r.player_name,
          score: r.score,
          total: r.total || (isWorld ? 197 : 389),
          elapsedSeconds: r.elapsed_seconds,
          apm: r.apm,
          title: r.title || getRatingTitle(r.score, isWorld),
          date: r.date,
          mode: r.mode,
        }));
    }
  } catch (e) {
    // 继续尝试通用表
  }

  // 2. 兼容使用 travel_guess_leaderboards 表跨设备同步
  try {
    const prefix = `mapfill-${mode}-`;
    const { data, error } = await supabase
      .from("travel_guess_leaderboards")
      .select("*")
      .gt("score", 0)
      .order("score", { ascending: false })
      .order("best_dist", { ascending: true })
      .order("date", { ascending: false })
      .limit(100);

    if (error || !Array.isArray(data)) return null;

    const list = [];
    for (const row of data) {
      if (!row.id || !row.id.startsWith(prefix)) continue;
      if (isMockRecord({ id: row.id, playerName: row.player_name })) continue;

      const historyMeta =
        Array.isArray(row.history) && row.history[0] ? row.history[0] : {};
      list.push({
        id: row.id,
        playerName: row.player_name,
        score: row.score,
        total: historyMeta.total || (isWorld ? 197 : 389),
        elapsedSeconds: Math.round(row.best_dist || 0),
        apm: Math.round(row.avg_dist || 0),
        title: historyMeta.title || getRatingTitle(row.score, isWorld),
        date: row.date,
        mode: mode,
      });
      if (list.length >= 15) break;
    }
    return list;
  } catch (e) {
    console.warn("fetchCloudMapFillLeaderboards error:", e);
    return null;
  }
}

// 上传战绩到 Supabase 云端
async function uploadMapFillRecordToCloud(record, mode = "china") {
  if (!supabase || !record) return;
  const isWorld = mode === "world";
  const rowId =
    record.id && record.id.startsWith("mapfill-")
      ? record.id
      : `mapfill-${mode}-${record.id || Date.now()}`;

  // 1. 尝试写入专属表
  try {
    const payload = {
      id: rowId,
      mode: mode,
      player_name: (record.playerName || "").trim() || "旅行探险家",
      score: record.score,
      total: record.total || (isWorld ? 197 : 389),
      elapsed_seconds: record.elapsedSeconds || 0,
      apm: record.apm || 0,
      title: record.title || getRatingTitle(record.score, isWorld),
      date: record.date || new Date().toISOString(),
    };
    const { error: dErr } = await supabase
      .from("map_fill_leaderboards")
      .upsert(payload);
    if (!dErr) return;
  } catch (e) {
    // 回退到通用表
  }

  // 2. 兼容写入 travel_guess_leaderboards
  try {
    const category = isWorld ? "global" : "domestic";
    const payload = {
      id: rowId,
      category: category,
      player_name: (record.playerName || "").trim() || "旅行探险家",
      score: record.score,
      date: record.date || new Date().toISOString(),
      best_dist: record.elapsedSeconds || 0,
      avg_dist: record.apm || 0,
      history: [
        {
          game: "mapfill",
          mode: mode,
          total: record.total || (isWorld ? 197 : 389),
          title: record.title || getRatingTitle(record.score, isWorld),
        },
      ],
    };
    const { error: insErr } = await supabase
      .from("travel_guess_leaderboards")
      .upsert(payload);
    if (insErr) {
      console.warn("uploadMapFillRecordToCloud fallback insert err:", insErr);
    }
  } catch (e) {
    console.warn("uploadMapFillRecordToCloud error:", e);
  }
}

function MapFillGame() {
  // 模式选择：中国地图 ('china') / 全球地图 ('world') / 省级地图 ('province')
  const [activeMapMode, setActiveMapMode] = useState("china");
  const isWorldMode = activeMapMode === "world";

  // 当前激活的数据源 (中国 389 单元 / 全球 197 国)
  const currentData = isWorldMode ? worldGameData : chinaGameData;
  const { metadata, items, aliasMap } = currentData;
  const totalCount = metadata.totalCount || items.length;

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

  // 中国地图排行榜（过滤本地可能残留的 mock 测试记录）
  const [chinaLeaderboard, setChinaLeaderboard] = useState(() => {
    try {
      const saved = localStorage.getItem("china_map_fill_leaderboard");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item) => !isMockRecord(item));
          return valid;
        }
      }
    } catch (e) {
      console.warn("Failed to load china map fill leaderboard:", e);
    }
    return INITIAL_CHINA_LEADERBOARD;
  });

  // 全球地图排行榜（过滤本地可能残留的 mock 测试记录）
  const [worldLeaderboard, setWorldLeaderboard] = useState(() => {
    try {
      const saved = localStorage.getItem("world_map_fill_leaderboard");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item) => !isMockRecord(item));
          return valid;
        }
      }
    } catch (e) {
      console.warn("Failed to load world map fill leaderboard:", e);
    }
    return INITIAL_WORLD_LEADERBOARD;
  });

  const leaderboard = isWorldMode ? worldLeaderboard : chinaLeaderboard;

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
  const [surrenderModalOpen, setSurrenderModalOpen] = useState(false);

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

  // 按省份和区域对中国城市进行归类分组
  const regionGrouped = useMemo(() => {
    if (isWorldMode) return {};
    const regions = {};
    CHINA_REGION_CONFIG.slice(1).forEach((r) => {
      regions[r.name] = { count: 0, guessed: 0, provinces: {} };
    });

    chinaGameData.items.forEach((item) => {
      const reg = item.region || "其他";
      const prov = item.province || "其他";
      if (!regions[reg]) {
        regions[reg] = { count: 0, guessed: 0, provinces: {} };
      }
      regions[reg].count++;
      if (!isWorldMode && guessedIds.has(item.id)) {
        regions[reg].guessed++;
      }

      if (!regions[reg].provinces[prov]) {
        regions[reg].provinces[prov] = [];
      }
      regions[reg].provinces[prov].push(item);
    });

    return regions;
  }, [isWorldMode, guessedIds]);

  // 按大洲对世界国家进行归类分组
  const worldGrouped = useMemo(() => {
    if (!isWorldMode) return {};
    const continents = {};
    WORLD_CONTINENT_CONFIG.slice(1).forEach((c) => {
      continents[c.name] = { count: 0, guessed: 0, items: [] };
    });

    worldGameData.items.forEach((item) => {
      const cont = item.continent || "其他";
      if (!continents[cont]) {
        continents[cont] = { count: 0, guessed: 0, items: [] };
      }
      continents[cont].count++;
      if (isWorldMode && guessedIds.has(item.id)) {
        continents[cont].guessed++;
      }
      continents[cont].items.push(item);
    });

    return continents;
  }, [isWorldMode, guessedIds]);

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

  // 初始化加载云端排行榜并与本地非测试数据合并同步
  useEffect(() => {
    let isMounted = true;
    async function syncCloudLeaderboards() {
      // 1. 同步中国地图排行榜
      const cloudChina = await fetchCloudMapFillLeaderboards("china");
      if (isMounted && cloudChina) {
        setChinaLeaderboard((prev) => {
          const merged = mergeLeaderboardRecords(prev, cloudChina);
          try {
            localStorage.setItem(
              "china_map_fill_leaderboard",
              JSON.stringify(merged)
            );
          } catch (e) {
            console.warn(e);
          }
          // 如果本地有但云端还没有的非 mock 真实战绩，反向同步到云端
          prev.forEach((localRec) => {
            if (
              !isMockRecord(localRec) &&
              !cloudChina.some((c) => c.id === localRec.id)
            ) {
              uploadMapFillRecordToCloud(localRec, "china");
            }
          });
          return merged;
        });
      }

      // 2. 同步世界地图排行榜
      const cloudWorld = await fetchCloudMapFillLeaderboards("world");
      if (isMounted && cloudWorld) {
        setWorldLeaderboard((prev) => {
          const merged = mergeLeaderboardRecords(prev, cloudWorld);
          try {
            localStorage.setItem(
              "world_map_fill_leaderboard",
              JSON.stringify(merged)
            );
          } catch (e) {
            console.warn(e);
          }
          prev.forEach((localRec) => {
            if (
              !isMockRecord(localRec) &&
              !cloudWorld.some((c) => c.id === localRec.id)
            ) {
              uploadMapFillRecordToCloud(localRec, "world");
            }
          });
          return merged;
        });
      }
    }

    syncCloudLeaderboards();
    return () => {
      isMounted = false;
    };
  }, []);

  // 打开排行榜弹窗时重新拉取最新云端排行
  useEffect(() => {
    if (!isLeaderboardOpen) return;
    let isMounted = true;
    const mode = activeMapMode === "world" ? "world" : "china";
    fetchCloudMapFillLeaderboards(mode).then((cloudData) => {
      if (isMounted && cloudData) {
        if (mode === "world") {
          setWorldLeaderboard((prev) => {
            const merged = mergeLeaderboardRecords(prev, cloudData);
            try {
              localStorage.setItem(
                "world_map_fill_leaderboard",
                JSON.stringify(merged)
              );
            } catch (e) {}
            return merged;
          });
        } else {
          setChinaLeaderboard((prev) => {
            const merged = mergeLeaderboardRecords(prev, cloudData);
            try {
              localStorage.setItem(
                "china_map_fill_leaderboard",
                JSON.stringify(merged)
              );
            } catch (e) {}
            return merged;
          });
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isLeaderboardOpen, activeMapMode]);

  // 保存成绩至荣誉排行榜（本地即时持久化 + 云端跨设备实时同步）
  const recordToLeaderboard = useCallback(
    (count, seconds) => {
      if (count <= 0) return;
      const minutes = Math.max(seconds / 60, 0.1);
      const apm = Math.round(count / minutes);
      const mode = isWorldMode ? "world" : "china";
      const newEntry = {
        id: `mapfill-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playerName: (playerName || "").trim() || "旅行探险家",
        score: count,
        total: totalCount,
        elapsedSeconds: seconds,
        apm,
        date: new Date().toISOString(),
        title: getRatingTitle(count, isWorldMode),
        mode,
      };

      if (isWorldMode) {
        setWorldLeaderboard((prev) => {
          const merged = mergeLeaderboardRecords([...prev, newEntry], []);
          try {
            localStorage.setItem(
              "world_map_fill_leaderboard",
              JSON.stringify(merged)
            );
          } catch (e) {
            console.warn("Failed to persist world leaderboard:", e);
          }
          return merged;
        });
      } else {
        setChinaLeaderboard((prev) => {
          const merged = mergeLeaderboardRecords([...prev, newEntry], []);
          try {
            localStorage.setItem(
              "china_map_fill_leaderboard",
              JSON.stringify(merged)
            );
          } catch (e) {
            console.warn("Failed to persist china leaderboard:", e);
          }
          return merged;
        });
      }

      // 异步上传至 Supabase 云端数据库，实现多设备互通
      uploadMapFillRecordToCloud(newEntry, mode).catch((err) => {
        console.warn("Async uploadMapFillRecordToCloud failed:", err);
      });
    },
    [playerName, totalCount, isWorldMode]
  );

  // 切换地图模式 (中国地图 / 全球地图)
  const handleSwitchMode = (mode) => {
    if (mode === activeMapMode) return;
    if (gameState === "playing" && guessedIds.size > 0) {
      if (!window.confirm("当前挑战正在进行中，切换地图模式将重置当前局进度，确认切换吗？")) {
        return;
      }
    }
    setActiveMapMode(mode);
    setGameState("idle");
    setGuessedIds(new Set());
    setElapsedSeconds(0);
    setInputVal("");
    setLastGuessedCity(null);
    setShowResultModal(false);
    setActiveRegionTab("all");
    setHoveredCity(null);
    handleResetZoom();
  };

  // 开始新挑战 (从主界面或重开进入答题界面，支持恢复未完成对局)
  const handleStartGame = () => {
    try {
      const activeKey = `map_fill_active_session_${activeMapMode}`;
      const saved = localStorage.getItem(activeKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.guessedIds) && parsed.guessedIds.length > 0) {
          const shouldResume = window.confirm(
            `检测到您有一局进行中的挑战（已点亮 ${parsed.guessedIds.length} 个${
              isWorldMode ? "国家" : "行政区"
            }）！\n点击【确定】继续挑战当前对局，\n点击【取消】重新开始新一局。`
          );
          if (shouldResume) {
            setGuessedIds(new Set(parsed.guessedIds));
            setElapsedSeconds(parsed.elapsedSeconds || 0);
            setInputVal("");
            setGameState("playing");
            setShowResultModal(false);
            setZoom({ scale: 1, x: 0, y: 0 });
            setTimeout(() => {
              if (inputRef.current) inputRef.current.focus();
            }, 120);
            return;
          }
        }
      }
    } catch (e) {
      console.warn("Check active session error:", e);
    }

    try {
      localStorage.removeItem(`map_fill_active_session_${activeMapMode}`);
    } catch (e) {}

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

  // 返回主界面 (退出当前挑战，保护玩家答题成果)
  const handleReturnToLobby = () => {
    if (gameState === "playing") {
      if (guessedIds.size > 0) {
        const shouldSave = window.confirm(
          `当前挑战已答对 ${guessedIds.size} 个${isWorldMode ? "国家" : "行政区"}！\n点击【确定】保存当前战绩并结算上榜，\n点击【取消】留在当前对局继续答题。`
        );
        if (shouldSave) {
          recordToLeaderboard(guessedIds.size, elapsedSeconds);
          try {
            localStorage.removeItem(`map_fill_active_session_${activeMapMode}`);
          } catch (e) {}
        } else {
          return;
        }
      } else {
        if (!window.confirm("当前挑战正在进行中，确定要退出并返回主界面吗？")) {
          return;
        }
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

  // 结束挑战并交卷揭晓（打开地图中心精致确认浮窗，告别网页顶栏原始弹框）
  const handleSurrender = () => {
    if (gameState !== "playing") return;
    setSurrenderModalOpen(true);
  };

  // 执行最终交卷与复盘揭晓
  const executeSurrender = () => {
    setGameState("surrendered");
    setShowResultModal(true);
    recordToLeaderboard(guessedIds.size, elapsedSeconds);
    try {
      localStorage.removeItem(`map_fill_active_session_${activeMapMode}`);
    } catch (e) {}
    showToast(
      isWorldMode
        ? "已揭晓全图未填国家，可在地图中自由复盘探索！"
        : "已揭晓全图未填行政区，可在地图中自由复盘探索！",
      "warning"
    );
  };

  // 重新开始当前局
  const handleRestart = () => {
    if (window.confirm("确定要重新开始一局吗？当前进度将重置。")) {
      try {
        localStorage.removeItem(`map_fill_active_session_${activeMapMode}`);
      } catch (e) {}
      handleStartGame();
    }
  };

  // 输入监听与命中判定（极速 0 延迟秒清 + 实时防丢自动缓存）
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
        const item = cityById.get(matchedId);
        showToast(`「${item ? item.name : matchedId}」之前已经填过啦！`, "warning");
        setInputVal("");
        return;
      }

      // 命中新行政区 / 国家！
      const targetItem = cityById.get(matchedId);
      const nextSet = new Set(guessedIds);
      nextSet.add(matchedId);
      setGuessedIds(nextSet);
      setLastGuessedCity(targetItem);
      setInputVal(""); // 极速清空输入框，支持无阻打字连击

      // 实时防丢缓存，防止意外刷新或浏览器关闭导致进度丢失
      try {
        const session = {
          mode: activeMapMode,
          guessedIds: Array.from(nextSet),
          elapsedSeconds,
          savedAt: Date.now(),
        };
        localStorage.setItem(`map_fill_active_session_${activeMapMode}`, JSON.stringify(session));
      } catch (err) {}

      showToast(
        isWorldMode
          ? `🎯 成功点亮：${targetItem.name} (${targetItem.continent})`
          : `🎯 成功点亮：${targetItem.name} (${targetItem.province})`,
        "success"
      );

      // 达成 100% 完美通关
      if (nextSet.size === totalCount) {
        setGameState("completed");
        setShowResultModal(true);
        recordToLeaderboard(totalCount, elapsedSeconds);
        try {
          localStorage.removeItem(`map_fill_active_session_${activeMapMode}`);
        } catch (e) {}
        showToast(
          isWorldMode
            ? "🎉 恭喜！你已完整点亮全球全部 197 个国家与地区！"
            : "🎉 恭喜！你已完整点亮中国全部 389 个行政区！",
          "success"
        );
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

  // 工具栏缩放按钮：以视口中心为基准
  const handleZoomIn = () => {
    const current = zoomRef.current;
    const newScale = Math.min(current.scale * 1.3, 12);
    const cx = 400;
    const cy = isWorldMode ? 273.5 : 240;
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
    const cy = isWorldMode ? 273.5 : 240;
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

  // 聚焦到指定城市 / 国家
  const handleFocusCity = (item) => {
    if (!item || !item.bbox) return;
    const defaultCx = 400;
    const defaultCy = isWorldMode ? 273.5 : 240;

    let targetScale = 3.5;
    if (isWorldMode) {
      const w = Math.max(item.bbox.maxX - item.bbox.minX, 4);
      const h = Math.max(item.bbox.maxY - item.bbox.minY, 4);
      const maxSpan = Math.max(w, h);
      if (maxSpan < 12) targetScale = 6.5;
      else if (maxSpan < 35) targetScale = 4.2;
      else if (maxSpan > 150) targetScale = 1.6;
      else targetScale = 2.8;
    }

    const offsetX = defaultCx - item.bbox.cx * targetScale;
    const offsetY = defaultCy - item.bbox.cy * targetScale;
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

  // 性能关键优化：矢量多边形缓存记忆，鼠标悬停时绝不引起所有路径重新 Diff 渲染！
  const renderedMapPaths = useMemo(() => {
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

      if (isWorldMode && item.paths) {
        return (
          <g
            key={item.id}
            className={polygonClass}
            onMouseEnter={() => setHoveredCity(item)}
            onMouseLeave={() => setHoveredCity(null)}
          >
            {item.paths.map((p, idx) => (
              <path
                key={idx}
                d={p.d}
                transform={p.transform || undefined}
                className="map-country-subpath"
              />
            ))}
          </g>
        );
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
  }, [items, guessedIds, lastGuessedCity, gameState, isWorldMode]);

  return (
    <section className="travel-game-section" id="travel-game-section" aria-label={isWorldMode ? "世界地图填充小游戏" : "中国地图填充小游戏"}>
      {/* ================================================================
          1. 顶部全局标题栏与选项卡 (对标旅行图寻头部)
          ================================================================ */}
      <div className="travel-game-header-row">
        <div className="travel-game-title-group">
          <h2 className="notes-hero-title">
            <MapIcon className="notes-hero-icon" size={24} />
            <span className="game-hero-brand-text">MAP FILL</span>
            <span className="notes-title-sub">世界 / 中国地图填充</span>
          </h2>
          <p className="travel-game-subtitle">
            <Sparkles size={16} className="game-sub-icon" />
            <span>
              {isWorldMode
                ? "盲填全球 197 个主权国家与地区。输入国名点亮地球！"
                : "盲填全国 389 个地级行政区。输入地名点亮壮丽山河！"}
            </span>
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
            title={isWorldMode ? "查看世界地图盲填荣耀排行榜" : "查看中国地图盲填荣耀排行榜"}
          >
            <Trophy size={15} />
            <span>排行榜 Top 10</span>
          </button>

          {/* 题库分类选项卡：对应 中国地图 / 全球地图 / 省级地图 */}
          <div className="travel-game-category-tabs">
            <button
              type="button"
              className={`game-tab-btn ${activeMapMode === "china" ? "active" : ""}`}
              onClick={() => handleSwitchMode("china")}
            >
              中国地图
            </button>
            <button
              type="button"
              className={`game-tab-btn ${activeMapMode === "world" ? "active" : ""}`}
              onClick={() => handleSwitchMode("world")}
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

          {/* 行政区 / 全球国家名录按钮 */}
          <button
            type="button"
            className={`game-roster-btn ${isDrawerOpen ? "is-active" : ""}`}
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            title={isWorldMode ? "查看全球国家名录与大洲探索进度" : "查看全国行政区名录与分区探索进度"}
          >
            <ListFilter size={15} />
            <span>{isWorldMode ? "全球国家名录" : "行政区名录"}</span>
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
              <span>{isWorldMode ? "联合国全成员国及观察员国 · 矢量盲填" : "全域矢量行政区划 · 交互盲填"}</span>
            </div>
            <h3>{isWorldMode ? "欢迎来到世界地图盲填！" : "欢迎来到中国地图盲填！"}</h3>
            <p className="game-welcome-desc">
              {isWorldMode
                ? "考验您对全球国家地理与世界版图储备的时刻到了——无需回车，直接输入国家中文、英文或标准缩写，让 197 个国家轮廓在指尖逐一点亮，亲手绘制寰宇五洲四海！"
                : "考验您对中国全域行政区划记忆与地理储备的时刻到了——无需回车，直接输入地名，让 389 个行政区轮廓在指尖逐一点亮，亲手描摹壮丽山河的辽阔版图！"}
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
                  <strong>{isWorldMode ? "免敲回车多语别名即刻点亮" : "免敲回车即时点亮"}</strong>
                  <p>
                    {isWorldMode
                      ? "支持简体/繁体中文全称与通称、英文官方名、英文通称及通用缩写 (如 美国/USA、英国/UK、阿联酋/UAE、刚果金/DRC 等)"
                      : "输入地名命中后系统秒速识别点亮，自动清空输入框并保持聚焦，支持畅快连击输入"}
                  </p>
                </div>
              </div>
              <div className="game-rule-item">
                <div className="rule-icon-box">2</div>
                <div>
                  <strong>光标中心丝滑缩放</strong>
                  <p>
                    {isWorldMode
                      ? "鼠标悬停任意位置滑动滚轮，精准以光标为锚点平滑缩放，微距观察细小海岛微型国家"
                      : "鼠标悬停任意位置滑动滚轮，精准以光标为锚点平滑缩放，微距观察细小地级县市"}
                  </p>
                </div>
              </div>
              <div className="game-rule-item">
                <div className="rule-icon-box">3</div>
                <div>
                  <strong>{isWorldMode ? "197 全球主权国家全覆盖" : "389 地级行政区全覆盖"}</strong>
                  <p>
                    {isWorldMode
                      ? "涵盖亚洲48国、欧洲44国、非洲54国、北美洲23国、南美洲12国、大洋洲16国，全矢量版图精细绘制"
                      : "涵盖全国 389 个地级市、地区、自治州、盟及省直辖县市等全域矢量行政轮廓"}
                  </p>
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

              <div className="map-fill-metric-pill progress-pill" title={isWorldMode ? "已点亮国家数量" : "已点亮行政区数量"}>
                <Trophy size={15} className="metric-icon trophy-icon" />
                <span className="metric-value">
                  <strong>{guessedIds.size}</strong> / {totalCount}
                </span>
                <span className="metric-sub">({progressPercent}%)</span>
              </div>

              <div className="map-fill-metric-pill apm-pill" title="当前输入答题手速">
                <Zap size={15} className="metric-icon zap-icon" />
                <span className="metric-value">{currentApm}</span>
                <span className="metric-sub">{isWorldMode ? "国/分" : "市/分"}</span>
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
                  placeholder={
                    isWorldMode
                      ? "输入国家名 (中/英/缩写如USA)，无需回车立即点亮..."
                      : "输入地名，无需回车立即点亮..."
                  }
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
                    title={isWorldMode ? "结束挑战并揭晓全图所有未填国家" : "结束挑战并揭晓全图所有未填行政区"}
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

          {/* 游戏主交互舞台区：注入海洋水系色调，告别灰蒙蒙，使主体立体饱满！ */}
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

              {/* 实时光标悬停行政区/国家卡片：仅对已答出或揭晓生效，保密防作弊 */}
              {hoveredCity &&
                (guessedIds.has(hoveredCity.id) ||
                  gameState === "surrendered" ||
                  gameState === "completed") && (
                  <div className="map-fill-hover-card">
                    <div className="hover-card-title">{hoveredCity.name}</div>
                    <div className="hover-card-sub">
                      {isWorldMode ? hoveredCity.continent : `${hoveredCity.province} · ${hoveredCity.region}`}
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

              {/* SVG 主画板 */}
              <svg
                ref={svgRef}
                className="map-fill-svg-canvas"
                viewBox={isWorldMode ? (metadata.viewBox || "0 0 800 547") : "0 -30 800 540"}
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
                  {!isWorldMode && metadata.chinaOutline && (
                    <path
                      d={metadata.chinaOutline}
                      className="map-fill-china-outline-bg"
                    />
                  )}

                  {/* 世界地图背景非答题领土 (南极洲、西撒哈拉等) */}
                  {isWorldMode &&
                    metadata.backgroundPaths &&
                    metadata.backgroundPaths
                      .filter((bg) => bg.id !== "十段线")
                      .map((bg, idx) => (
                        <path
                          key={bg.id || idx}
                          d={bg.d}
                          transform={bg.transform || undefined}
                          className="map-fill-bg-territory"
                        />
                      ))}

                  {/* 矢量路径 (已使用 useMemo 缓存，悬停 0 消耗) */}
                  {renderedMapPaths}

                  {/* 顶层悬停高光轮廓线：无论与任何相邻单元共享边界，均在最上层绘制，保证 360 度绝对等宽 */}
                  {hoveredCity && (
                    <g className="map-city-hover-stroke-top">
                      {isWorldMode && hoveredCity.paths ? (
                        hoveredCity.paths.map((p, idx) => (
                          <path
                            key={idx}
                            d={p.d}
                            transform={p.transform || undefined}
                          />
                        ))
                      ) : (
                        <path d={hoveredCity.d} />
                      )}
                    </g>
                  )}
                </g>
              </svg>
            </div>

            {/* 提前交卷居中精致确认浮窗（置于地图舞台正中心，玻璃拟物设计） */}
            {surrenderModalOpen && (
              <div
                className="map-fill-confirm-overlay"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSurrenderModalOpen(false);
                }}
              >
                <div className="map-fill-confirm-card" role="dialog" aria-modal="true">
                  <div className="confirm-card-icon-halo">
                    <Flag size={28} className="confirm-card-flag-icon" />
                  </div>
                  <h3 className="confirm-card-title">提前交卷揭晓全图？</h3>
                  <p className="confirm-card-subtitle">
                    当前对局已点亮 <strong>{guessedIds.size}</strong> / {totalCount} 个{isWorldMode ? "国家" : "地级行政区"}
                  </p>
                  <div className="confirm-progress-pill">
                    <div
                      className="confirm-progress-pill-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                    <span className="confirm-progress-pill-label">
                      探索完成度 {progressPercent}%
                    </span>
                  </div>
                  <div className="confirm-notice-box">
                    <div className="confirm-notice-item">
                      <Trophy size={14} className="notice-icon-gold" />
                      <span>成绩自动结算：已点亮战绩将即刻归档并核对排行榜</span>
                    </div>
                    <div className="confirm-notice-item">
                      <Eye size={14} className="notice-icon-blue" />
                      <span>全图答案揭晓：未填写的区域将以亮橙色高亮，支持复盘</span>
                    </div>
                    <div className="confirm-notice-item">
                      <AlertTriangle size={14} className="notice-icon-amber" />
                      <span>挑战立即终止：交卷后本轮作答即告结束，不可撤回</span>
                    </div>
                  </div>
                  <div className="confirm-card-actions">
                    <button
                      type="button"
                      className="confirm-btn-cancel"
                      onClick={() => setSurrenderModalOpen(false)}
                    >
                      继续答题
                    </button>
                    <button
                      type="button"
                      className="confirm-btn-danger"
                      onClick={() => {
                        setSurrenderModalOpen(false);
                        executeSurrender();
                      }}
                    >
                      <Flag size={15} />
                      <span>确认交卷揭晓</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
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
              <h3 className="drawer-title">{isWorldMode ? "全球国家名录" : "全国行政区名录"}</h3>
              <span className="drawer-sub">{isWorldMode ? "六大洲 · 197 国家清单" : "七大区域· 389 城市清单"}</span>
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

        {/* 区域 / 大洲过滤选项卡：网格标签，确保全部完全可见直接点击！ */}
        <div className="drawer-tabs-grid">
          {(isWorldMode ? WORLD_CONTINENT_CONFIG : CHINA_REGION_CONFIG).map((r) => {
            const info = r.key === "all" ? null : isWorldMode ? worldGrouped[r.name] : regionGrouped[r.name];
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

        {/* 清单列表：按中国省份城市 或 全球大洲国家渲染 */}
        <div className="drawer-content-scroll">
          {isWorldMode ? (
            /* 全球地图：按大洲展示 197 个国家卡片 */
            Object.entries(worldGrouped)
              .filter(([contName]) => {
                if (activeRegionTab === "all") return true;
                const config = WORLD_CONTINENT_CONFIG.find((c) => c.name === contName);
                return config?.key === activeRegionTab;
              })
              .map(([contName, contData]) => {
                const contPercent = (
                  (contData.guessed / (contData.count || 1)) *
                  100
                ).toFixed(0);

                return (
                  <div key={contName} className="drawer-region-block">
                    <div className="region-block-header">
                      <div className="region-block-title-row">
                        <span className="region-name">{contName}</span>
                        <span className="region-badge-pill">
                          {contData.guessed} / {contData.count} ({contPercent}%)
                        </span>
                      </div>
                      <div className="region-sub-progress-bar">
                        <div
                          className="region-sub-progress-fill"
                          style={{ width: `${contPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="province-card">
                      <div className="city-chips-grid">
                        {contData.items.map((country, idx) => {
                          const isGuessed = guessedIds.has(country.id);
                          const isMissed =
                            gameState === "surrendered" && !isGuessed;

                          return (
                            <button
                              key={country.id}
                              type="button"
                              className={`city-chip ${
                                isGuessed
                                  ? "is-guessed"
                                  : isMissed
                                  ? "is-missed"
                                  : "is-locked"
                              }`}
                              onClick={() => {
                                if (gameState !== "idle") {
                                  handleFocusCity(country);
                                }
                              }}
                              title={
                                isGuessed
                                  ? `已点亮 · 点击在地图上定位 ${country.name}`
                                  : isMissed
                                  ? `未答出 · 点击在地图上定位 ${country.name}`
                                  : "尚未填入该国家"
                              }
                            >
                              {isGuessed ? (
                                <>
                                  <Check size={12} className="chip-check-icon" />
                                  <span>{country.name}</span>
                                </>
                              ) : isMissed ? (
                                <span>{country.name}</span>
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
                  </div>
                );
              })
          ) : (
            /* 中国地图：按七大区与各省份展示 389 个城市清单 */
            Object.entries(regionGrouped)
              .filter(([regName]) => {
                if (activeRegionTab === "all") return true;
                const config = CHINA_REGION_CONFIG.find((c) => c.name === regName);
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
              })
          )}
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
                  ? (isWorldMode
                    ? "🎉 完美通关！全球国家全部点亮！"
                    : "🎉 完美通关！中国地图全部点亮！")
                  : "🗺️ 挑战结算战报"}
              </h3>
              <p className="modal-subtitle">{getRatingTitle(guessedIds.size, isWorldMode)}</p>
            </div>

            {/* 核心战绩数据看板 */}
            <div className="modal-stats-grid">
              <div className="modal-stat-box">
                <span className="stat-num">{guessedIds.size}</span>
                <span className="stat-label">已填{isWorldMode ? "国家" : "行政区"} (共{totalCount})</span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-num">{progressPercent}%</span>
                <span className="stat-label">{isWorldMode ? "全球" : "全国"}点亮达成率</span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-num">{formatTime(elapsedSeconds)}</span>
                <span className="stat-label">总用时</span>
              </div>
              <div className="modal-stat-box">
                <span className="stat-num">{currentApm}</span>
                <span className="stat-label">平均手速 ({isWorldMode ? "国/分" : "市/分"})</span>
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
                  <h3 className="game-modal-title">
                    {isWorldMode ? "世界地图盲填 · 荣誉排行榜" : "中国地图盲填 · 荣誉排行榜"}
                  </h3>
                  <p className="game-modal-subtitle">
                    {isWorldMode
                      ? "记录全球 197 主权国家与地区盲填挑战的高光战绩与手速巅峰"
                      : "记录全国 389 域行政区盲填挑战的高光战绩与手速巅峰"}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span className="leaderboard-count-tag">
                      {leaderboard.length > 0
                        ? `收录前 ${leaderboard.length} 位高光记录`
                        : "云端排行榜"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        color: "#059669",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#10b981",
                          display: "inline-block",
                          boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
                        }}
                      />
                      云端实时互通
                    </span>
                  </div>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="leaderboard-empty-box">
                    <Trophy className="empty-trophy" size={48} />
                    <h4>暂无挑战记录</h4>
                    <p>快来成为首位上榜的探索者吧！完成一局挑战即可点亮榜单！</p>
                  </div>
                ) : (
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
                              {entry.title || (isWorldMode ? "环球探险家" : "华夏探险家")}
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
                              <span>{entry.apm || 0} {isWorldMode ? "国/分" : "市/分"}</span>
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
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default React.memo(MapFillGame);
