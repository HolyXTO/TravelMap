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
  ChevronRight,
  ShieldAlert,
  Sparkles,
  MapPin,
  Flame,
  Home,
  UserCheck,
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

// Web Audio API 游戏音效合成器 (零外链加载，高稳定)
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
      // Ignore audio context errors
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
  // LOBBY: 大厅 (选择匹配 / 好友房间)
  // MATCHING: 快速匹配中 (雷达动画)
  // ROOM_WAITING: 私人房间等待对手加入
  // PLAYING: 10 题对决进行中
  // ROUND_REVEAL: 回合揭晓双方点位与得分
  // GAME_OVER: 10 题终局胜负大结算
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
  const [urgentTriggeredBy, setUrgentTriggeredBy] = useState(null); // 'opponent' 或 null

  // 回合与全局累计比分
  const [myTotalScore, setMyTotalScore] = useState(0);
  const [opponentTotalScore, setOpponentTotalScore] = useState(0);
  const [roundResult, setRoundResult] = useState(null); // 当前回合揭晓详情
  const [matchHistory, setMatchHistory] = useState([]); // 10 回合复盘列表

  // 图片高清切换与查看
  const [isHdPhoto, setIsHdPhoto] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [autoAdvanceSec, setAutoAdvanceSec] = useState(null);

  // 引用与定时器
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);
  const channelRef = useRef(null);
  const lobbyChannelRef = useRef(null);
  const urgentTimerRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);

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
      // 默认视角定在欧洲中部 (Tang 精选欧洲题库)
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

      // 玩家点击地图选点
      map.on("click", (e) => {
        if (myLocked) return; // 已锁定答案不能再修改
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
  // 地图标记渲染 (选点标点 与 揭晓双方对比线)
  // ==========================================================================
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();

    // 1. 游戏中阶段：仅显示自己当前的预测点
    if (gameState === "PLAYING" && myPin) {
      const myIcon = L.divIcon({
        className: "battle-div-icon",
        html: `
          <div style="position:relative; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center;">
            <div class="battle-pin-label you">你 (${playerName})</div>
            <div style="width:16px; height:16px; background:#dc2626; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 10px rgba(220,38,38,0.6);"></div>
            <div style="width:2px; height:8px; background:#dc2626;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([myPin.lat, myPin.lng], { icon: myIcon }).addTo(markerGroup);
    }

    // 2. 回合揭晓阶段：同时绘制 目标点、你的点、对手的点 与 连线
    if (gameState === "ROUND_REVEAL" && roundResult) {
      const { targetLat, targetLng, myGuess, oppGuess, targetCity } = roundResult;
      const boundsPoints = [[targetLat, targetLng]];

      // A. 目标真实点 (金色/绿色 旗帜标)
      const targetIcon = L.divIcon({
        className: "battle-div-icon",
        html: `
          <div style="position:relative; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center;">
            <div class="battle-pin-label target">🎯 ${targetCity || "真实位置"}</div>
            <div style="width:20px; height:20px; background:#16a34a; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 12px rgba(22,163,74,0.8);"></div>
            <div style="width:2px; height:10px; background:#16a34a;"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker([targetLat, targetLng], { icon: targetIcon, zIndexOffset: 2000 }).addTo(markerGroup);

      // B. 你的预测点 (红色)
      if (myGuess && myGuess.lat !== null) {
        boundsPoints.push([myGuess.lat, myGuess.lng]);
        const myIcon = L.divIcon({
          className: "battle-div-icon",
          html: `
            <div style="position:relative; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center;">
              <div class="battle-pin-label you">你: ${myGuess.dist}km (+${myGuess.score}分)</div>
              <div style="width:16px; height:16px; background:#dc2626; border:3px solid #ffffff; border-radius:50%;"></div>
            </div>
          `,
          iconSize: [0, 0],
        });
        L.marker([myGuess.lat, myGuess.lng], { icon: myIcon, zIndexOffset: 1500 }).addTo(markerGroup);

        // 连线
        L.polyline([[myGuess.lat, myGuess.lng], [targetLat, targetLng]], {
          color: "#dc2626",
          dashArray: "6, 6",
          weight: 3,
          opacity: 0.85,
        }).addTo(markerGroup);
      }

      // C. 对手的预测点 (蓝色)
      if (oppGuess && oppGuess.lat !== null) {
        boundsPoints.push([oppGuess.lat, oppGuess.lng]);
        const oppIcon = L.divIcon({
          className: "battle-div-icon",
          html: `
            <div style="position:relative; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center;">
              <div class="battle-pin-label opponent">${opponent?.name || "对手"}: ${oppGuess.dist}km (+${oppGuess.score}分)</div>
              <div style="width:16px; height:16px; background:#2563eb; border:3px solid #ffffff; border-radius:50%;"></div>
            </div>
          `,
          iconSize: [0, 0],
        });
        L.marker([oppGuess.lat, oppGuess.lng], { icon: oppIcon, zIndexOffset: 1400 }).addTo(markerGroup);

        // 连线
        L.polyline([[oppGuess.lat, oppGuess.lng], [targetLat, targetLng]], {
          color: "#2563eb",
          dashArray: "6, 6",
          weight: 3,
          opacity: 0.85,
        }).addTo(markerGroup);
      }

      // 地图自动自适应聚焦到包含所有点的范围
      if (boundsPoints.length > 1) {
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [gameState, myPin, roundResult, opponent, playerName]);

  // ==========================================================================
  // 回合提交与 15s 绝杀倒计时触发机制
  // ==========================================================================
  // 倒计时计时器
  useEffect(() => {
    if (urgentSeconds === null) return;

    if (urgentSeconds > 0) {
      urgentTimerRef.current = setTimeout(() => {
        sfx.playUrgentTick();
        setUrgentSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (urgentSeconds === 0) {
      // 15 秒绝杀倒计时归零！强制提交！
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
      // 如果已点选地图但未按提交，保留所选点
      dist = calculateDistanceKm(myPin.lat, myPin.lng, targetLat, targetLng);
      score = calculateBattleScore(dist);
      guessCoords = myPin;
    }

    setMyLocked(true);
    sfx.playLock();

    // 广播自己的提交数据
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "round_submit",
        payload: {
          playerId,
          roundIndex: currentRoundIndex,
          lat: guessCoords ? guessCoords.lat : null,
          lng: guessCoords ? guessCoords.lng : null,
          dist,
          score,
        },
      });
    }
  }, [myLocked, matchQuestions, currentRoundIndex, myPin, playerId]);

  // 玩家主动点击“锁定答案”
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

    // 广播：A. 告知对手我已交卷 (触发对手 15 秒倒计时)
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "player_locked",
        payload: {
          playerId,
          roundIndex: currentRoundIndex,
        },
      });

      // B. 发送自己的成绩数据 (待双方到齐后揭晓)
      channelRef.current.send({
        type: "broadcast",
        event: "round_submit",
        payload: {
          playerId,
          roundIndex: currentRoundIndex,
          lat: myPin.lat,
          lng: myPin.lng,
          dist,
          score,
        },
      });
    }
  };

  // 暂存双方本回合成绩并计算揭晓
  const pendingSubmissionsRef = useRef({});

  const checkAndRevealRound = useCallback(
    (submissions, roundIdx) => {
      const curQ = matchQuestions[roundIdx];
      if (!curQ) return;

      const mySub = submissions[playerId];
      const oppSub = submissions[opponent?.id];
      if (!mySub || !oppSub) return; // 双方数据未全，继续等待

      // 停止 15s 倒计时
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

      // 清空当前回合缓存
      pendingSubmissionsRef.current = {};

      // 5 秒自动跳转下一题倒计时
      setAutoAdvanceSec(5);
    },
    [matchQuestions, playerId, opponent]
  );

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

  // 进入下一题或终局大结算
  const handleNextRound = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    setAutoAdvanceSec(null);

    if (currentRoundIndex + 1 < matchQuestions.length) {
      setCurrentRoundIndex((prev) => prev + 1);
      setMyPin(null);
      setMyLocked(false);
      setOpponentLocked(false);
      setUrgentSeconds(null);
      setUrgentTriggeredBy(null);
      setRoundResult(null);
      setIsHdPhoto(false);
      setGameState("PLAYING");
    } else {
      // 10 题对决全部完成，进入大结算！
      setGameState("GAME_OVER");
      sfx.playVictory();
    }
  };

  // ==========================================================================
  // 对战房间连接与通信 (Supabase Realtime Channel)
  // ==========================================================================
  const setupRoomChannel = useCallback(
    (targetRoomId, amIHost, questionsArr, oppObj) => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
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
      pendingSubmissionsRef.current = {};

      const channel = supabase.channel(`travel_battle_room_${targetRoomId}`, {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: playerId },
        },
      });

      // 监听广播事件
      channel
        .on("broadcast", { event: "player_locked" }, ({ payload }) => {
          if (payload.playerId !== playerId) {
            setOpponentLocked(true);
            // 对手交卷！若自己尚未交卷，立即触发 15 秒绝杀倒计时！
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
          pendingSubmissionsRef.current[payload.playerId] = payload;
          // 检查是否双方都已提交
          if (
            pendingSubmissionsRef.current[playerId] &&
            pendingSubmissionsRef.current[payload.playerId]
          ) {
            checkAndRevealRound(pendingSubmissionsRef.current, payload.roundIndex);
          }
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
          setGameState("PLAYING");
          sfx.playMatchFound();
        });

      // 在场状态监听 (对手断线提醒)
      channel
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          const oppLeft = leftPresences.some((p) => p.playerId !== playerId);
          if (oppLeft && gameState === "PLAYING") {
            alert("⚠️ 对手已退出对局！你获得了本场对战的胜利。");
            setGameState("LOBBY");
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel.track({ playerId, playerName });
          }
        });

      channelRef.current = channel;
    },
    [playerId, playerName, gameState, checkAndRevealRound]
  );

  // ==========================================================================
  // 快速随机匹配机制 (Matchmaking Lobby)
  // ==========================================================================
  const startQuickMatch = () => {
    setGameState("MATCHING");

    if (lobbyChannelRef.current) {
      lobbyChannelRef.current.unsubscribe();
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
          // 字典序最小的玩家作为 Match Host，避免双方重复撮合
          waitingPlayers.sort((a, b) => a.playerId.localeCompare(b.playerId));
          const p1 = waitingPlayers[0];
          const p2 = waitingPlayers[1];

          if (playerId === p1.playerId) {
            // 我是 Host！生成房间与 10 道 Tang 题目
            const newRoomId = "duel_" + Math.random().toString(36).substring(2, 8);
            const chosen10 = pick10TangQuestions();
            const questionIds = chosen10.map((q) => q.id);

            // 广播撮合成功通知
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

            // 自己进入对战房间
            lobby.unsubscribe();
            setupRoomChannel(newRoomId, true, chosen10, { id: p2.playerId, name: p2.playerName });
            setGameState("PLAYING");
            sfx.playMatchFound();
          }
        }
      })
      .on("broadcast", { event: "match_found" }, ({ payload }) => {
        // 如果自己是被匹配上的 Guest
        if (payload.guestId === playerId) {
          lobby.unsubscribe();
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
      lobbyChannelRef.current.unsubscribe();
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

    // 监听好友加入
    if (channelRef.current) {
      channelRef.current.on("presence", { event: "join" }, ({ newPresences }) => {
        const guest = newPresences.find((p) => p.playerId !== playerId);
        if (guest) {
          setOpponent({ id: guest.playerId, name: guest.playerName });
        }
      });
    }
  };

  const joinFriendRoom = () => {
    const code = inputRoomCode.trim();
    if (!code) {
      alert("请输入 6 位好友房间码");
      return;
    }
    setupRoomChannel(code, false, [], null);
    setGameState("ROOM_WAITING");

    // 监听房主发来的开始游戏信令
    if (channelRef.current) {
      channelRef.current.on("presence", { event: "sync" }, () => {
        const state = channelRef.current.presenceState();
        for (const key in state) {
          const item = state[key]?.[0];
          if (item && item.playerId !== playerId) {
            setOpponent({ id: item.playerId, name: item.playerName });
          }
        }
      });
    }
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
      setGameState("PLAYING");
      sfx.playMatchFound();
    }
  };

  const returnToLobby = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setGameState("LOBBY");
    setRoomId("");
    setOpponent(null);
  };

  // 当前题目
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
            <Flame size={15} /> 实时竞技全新上线
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
            {/* 照片展示区 */}
            <div className="battle-photo-container">
              <img
                src={isHdPhoto ? currentQ.photoUrlHd || currentQ.photoUrl : currentQ.photoUrl}
                alt="对决实景照片"
                className="battle-photo-img"
              />

              <div className="battle-photo-controls">
                <button
                  type="button"
                  className="battle-photo-btn"
                  onClick={() => setIsHdPhoto(!isHdPhoto)}
                >
                  {isHdPhoto ? "标清 1440px" : "超清 2800px"}
                </button>
                <button
                  type="button"
                  className="battle-photo-btn"
                  onClick={() => setShowFullPhoto(true)}
                >
                  <Eye size={14} /> 放大看图
                </button>
              </div>

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
                  双方预测点位已在地图揭晓，红蓝虚线标记各自误差
                </div>
              </div>

              <div className="battle-reveal-scores">
                <div className="battle-reveal-card you">
                  <span className="name">你 ({playerName})</span>
                  <span className="pts">+{roundResult.myGuess.score} 分</span>
                  <span className="dist">误差: {roundResult.myGuess.dist} km</span>
                </div>

                <div className="battle-reveal-card opponent">
                  <span className="name">{opponent?.name || "对手"}</span>
                  <span className="pts">+{roundResult.oppGuess.score} 分</span>
                  <span className="dist">误差: {roundResult.oppGuess.dist} km</span>
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
                      <td style={{ color: "#dc2626", fontWeight: 700 }}>
                        {item.myGuess.dist} km (+{item.myGuess.score}分)
                      </td>
                      <td style={{ color: "#2563eb", fontWeight: 700 }}>
                        {item.oppGuess.dist} km (+{item.oppGuess.score}分)
                      </td>
                      <td>
                        {youWon ? (
                          <span style={{ color: "#16a34a", fontWeight: 800 }}>🏆 你胜出</span>
                        ) : tie ? (
                          <span style={{ color: "#64748b", fontWeight: 700 }}>平局</span>
                        ) : (
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>对手胜出</span>
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

      {/* 图片放大 Modal */}
      {showFullPhoto && currentQ && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowFullPhoto(false)}
        >
          <img
            src={currentQ.photoUrlHd || currentQ.photoUrl}
            alt="放大照片"
            style={{ maxWidth: "95vw", maxHeight: "95vh", objectFit: "contain", borderRadius: "12px" }}
          />
        </div>
      )}
    </div>
  );
}
