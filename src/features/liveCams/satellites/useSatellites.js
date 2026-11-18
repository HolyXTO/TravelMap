// -*- coding: utf-8 -*-
/**
 * useSatellites.js
 *
 * 全球卫星追踪核心状态 Hook：
 * - 懒加载目录：仅在进入 `satellites` 模块后才拉取 GP 轨道目录与启动 SGP4 Web Worker
 * - 1Hz 统一 UTC 时钟：页面隐藏或切换回摄像头／航班后自动暂停；切回时立即按当前 UTC 时间跳算
 * - 双层状态分离：全量位置保留在 `positionsRef` (Float32Array) 直喂 WebGL 图层，React 仅维护当前筛选列表与单颗选中目标遥测
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { fetchSatelliteCatalog, filterSatellites } from "../services/satelliteService";

function computePeriodFromOmm(sat) {
  const meanMotion = Number(sat?.omm?.MEAN_MOTION);
  if (Number.isFinite(meanMotion) && meanMotion > 0) {
    const mins = 1440 / meanMotion;
    if (Number.isFinite(mins) && mins >= 60 && mins <= 3000) {
      return mins;
    }
  }
  return 95;
}

const PROPAGATION_TICK_MS = 1000;
const ORBIT_REFRESH_TICKS = 15; // 选中卫星轨迹每 15 秒基于同源时钟微调采样一次

export function useSatellites({ enabled }) {
  const [catalog, setCatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNoradId, setSelectedNoradId] = useState(null);
  const [showOrbitTrack, setShowOrbitTrack] = useState(true);
  const [followSelected, setFollowSelected] = useState(false);

  // 实时推进时间戳 & WebGL 重绘触发器 (通过 revisionRef + 回调避免全量对象塞入 React state)
  const [positionRevision, setPositionRevision] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [selectedTelemetry, setSelectedTelemetry] = useState(null);
  const [selectedOrbit, setSelectedOrbit] = useState(null);
  const [rateLimitMessage, setRateLimitMessage] = useState("");

  const workerRef = useRef(null);
  const positionsRef = useRef({
    elementSetId: "",
    timestampMs: 0,
    data: null, // Float32Array [lng, lat, altKm, velKmS] * N
    count: 0,
    validCount: 0,
  });
  const orbitRequestIdRef = useRef(0);
  const selectedNoradRef = useRef(selectedNoradId);
  selectedNoradRef.current = selectedNoradId;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const noradToIndex = useMemo(() => {
    const map = new Map();
    if (catalog?.satellites) {
      for (let i = 0; i < catalog.satellites.length; i += 1) {
        map.set(catalog.satellites[i].noradId, i);
      }
    }
    return map;
  }, [catalog]);

  const readTelemetryForNorad = useCallback(
    (noradId, posStore) => {
      if (!noradId || !catalogRef.current?.satellites) return null;
      const idx = noradToIndex.get(String(noradId));
      if (idx === undefined) return null;
      const sat = catalogRef.current.satellites[idx];
      const buf = posStore?.data;
      if (!buf || idx * 4 + 3 >= buf.length) return null;

      const offset = idx * 4;
      const lng = buf[offset];
      const lat = buf[offset + 1];
      const altKm = buf[offset + 2];
      const velKmS = buf[offset + 3];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(altKm)) {
        return null;
      }

      const periodMinutes = computePeriodFromOmm(sat);

      return {
        noradId: sat.noradId,
        lat,
        lng,
        altKm,
        velKmS,
        periodMinutes,
        timestampMs: posStore.timestampMs || Date.now(),
        elementSetId: posStore.elementSetId,
      };
    },
    [noradToIndex],
  );

  // 请求单星过去/未来轨道轨迹（Worker 内按同源 elementSetId 计算）
  const requestOrbitForSelected = useCallback((noradId, timestampMs = Date.now()) => {
    const worker = workerRef.current;
    const activeCatalog = catalogRef.current;
    if (!worker || !activeCatalog || !noradId) {
      setSelectedOrbit(null);
      return;
    }
    orbitRequestIdRef.current += 1;
    const requestId = orbitRequestIdRef.current;
    worker.postMessage({
      type: "COMPUTE_ORBIT",
      requestId,
      elementSetId: activeCatalog.elementSetId,
      noradId: String(noradId),
      timestampMs,
      samples: 128,
    });
  }, []);

  // 1. 懒加载轨道要素目录（仅进入卫星模块时加载）
  const loadCatalog = useCallback(async ({ forceRefresh = false } = {}) => {
    setIsLoading(true);
    setRateLimitMessage("");
    try {
      const next = await fetchSatelliteCatalog({ forceRefresh });
      if (next.rateLimitedNote) {
        setRateLimitMessage(next.rateLimitedNote);
      }
      setCatalog(next);
    } catch (err) {
      console.warn("[useSatellites] Catalog load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!catalog) {
      loadCatalog({ forceRefresh: false });
    }
  }, [enabled, catalog, loadCatalog]);

  // 2. 初始化与生命周期管理 SGP4 Web Worker
  useEffect(() => {
    if (!enabled) return undefined;

    const worker = new Worker(new URL("../workers/satellite.worker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const msg = event?.data;
      if (!msg || !msg.type) return;

      if (msg.type === "POSITIONS") {
        const floatArray = new Float32Array(msg.buffer);
        const store = {
          elementSetId: msg.elementSetId,
          timestampMs: msg.timestampMs,
          data: floatArray,
          count: msg.count,
          validCount: msg.validCount,
        };
        positionsRef.current = store;
        setValidCount(msg.validCount || 0);
        setPositionRevision((v) => (v + 1) % 1000000);

        if (selectedNoradRef.current) {
          const nextTelem = readTelemetryForNorad(selectedNoradRef.current, store);
          if (nextTelem) {
            setSelectedTelemetry(nextTelem);
          }
        }
        return;
      }

      if (msg.type === "ORBIT_PATH") {
        // 丢弃过期轨迹响应，防止快速连续点选不同卫星时出现串轨
        if (
          msg.requestId !== orbitRequestIdRef.current ||
          msg.noradId !== selectedNoradRef.current
        ) {
          return;
        }
        setSelectedOrbit({
          elementSetId: msg.elementSetId,
          noradId: msg.noradId,
          timestampMs: msg.timestampMs,
          pastSegments: msg.pastSegments || [],
          futureSegments: msg.futureSegments || [],
          periodMinutes: msg.periodMinutes || 95,
        });
      }
    };

    if (catalogRef.current?.satellites?.length > 0) {
      worker.postMessage({
        type: "INIT_CATALOG",
        elementSetId: catalogRef.current.elementSetId,
        satellites: catalogRef.current.satellites.map((s) => ({
          noradId: s.noradId,
          omm: s.omm,
        })),
        timestampMs: Date.now(),
      });
    }

    return () => {
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
    };
  }, [enabled, readTelemetryForNorad]);

  // 3. 目录变更或重连 Worker 时注入目录
  useEffect(() => {
    if (!enabled || !catalog?.satellites?.length || !workerRef.current) return;
    const nowMs = Date.now();
    workerRef.current.postMessage({
      type: "INIT_CATALOG",
      elementSetId: catalog.elementSetId,
      satellites: catalog.satellites.map((s) => ({
        noradId: s.noradId,
        omm: s.omm,
      })),
      timestampMs: nowMs,
    });

    if (selectedNoradRef.current) {
      requestOrbitForSelected(selectedNoradRef.current, nowMs);
    }
  }, [enabled, catalog, requestOrbitForSelected]);

  // 4. 1Hz 连续推进时钟 + 标签页可见性恢复立即跳算
  useEffect(() => {
    if (!enabled || !catalog?.elementSetId) return undefined;

    let tickCount = 0;

    const triggerTick = () => {
      if (!enabledRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const worker = workerRef.current;
      const activeCatalog = catalogRef.current;
      if (!worker || !activeCatalog) return;

      const nowMs = Date.now();
      worker.postMessage({
        type: "PROPAGATE_ALL",
        elementSetId: activeCatalog.elementSetId,
        timestampMs: nowMs,
      });

      tickCount += 1;
      if (
        selectedNoradRef.current &&
        showOrbitTrack &&
        tickCount % ORBIT_REFRESH_TICKS === 0
      ) {
        requestOrbitForSelected(selectedNoradRef.current, nowMs);
      }
    };

    const timer = setInterval(triggerTick, PROPAGATION_TICK_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerTick();
        if (selectedNoradRef.current && showOrbitTrack) {
          requestOrbitForSelected(selectedNoradRef.current, Date.now());
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, catalog?.elementSetId, showOrbitTrack, requestOrbitForSelected]);

  // 5. 选中卫星或轨迹开关变化时重算轨迹
  useEffect(() => {
    if (!enabled) return;
    if (!selectedNoradId) {
      setSelectedTelemetry(null);
      setSelectedOrbit(null);
      setFollowSelected(false);
      return;
    }
    const store = positionsRef.current;
    const telem = readTelemetryForNorad(selectedNoradId, store);
    setSelectedTelemetry(telem);
    if (showOrbitTrack) {
      requestOrbitForSelected(selectedNoradId, store?.timestampMs || Date.now());
    } else {
      setSelectedOrbit(null);
    }
  }, [
    enabled,
    selectedNoradId,
    showOrbitTrack,
    readTelemetryForNorad,
    requestOrbitForSelected,
  ]);

  const filteredSatellites = useMemo(() => {
    if (!catalog?.satellites) return [];
    return filterSatellites({
      satellites: catalog.satellites,
      category: selectedCategory,
      searchQuery,
    });
  }, [catalog, selectedCategory, searchQuery]);

  const selectedSatellite = useMemo(() => {
    if (!selectedNoradId || !catalog?.satellites) return null;
    const idx = noradToIndex.get(String(selectedNoradId));
    return idx !== undefined ? catalog.satellites[idx] : null;
  }, [selectedNoradId, catalog, noradToIndex]);

  const selectSatellite = useCallback((satOrNoradId) => {
    if (!satOrNoradId) {
      setSelectedNoradId(null);
      setFollowSelected(false);
      return;
    }
    const id = typeof satOrNoradId === "string" ? satOrNoradId : satOrNoradId.noradId;
    setSelectedNoradId(id ? String(id) : null);
  }, []);

  return {
    catalog,
    isLoading,
    rateLimitMessage,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    filteredSatellites,
    selectedNoradId,
    selectedSatellite,
    selectedTelemetry,
    selectedOrbit,
    showOrbitTrack,
    setShowOrbitTrack,
    followSelected,
    setFollowSelected,
    selectSatellite,
    positionsRef,
    positionRevision,
    validCount,
    noradToIndex,
    refreshCatalog: () => loadCatalog({ forceRefresh: true }),
  };
}
