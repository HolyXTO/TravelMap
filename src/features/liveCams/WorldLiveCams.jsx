// -*- coding: utf-8 -*-
/**
 * WorldLiveCams.jsx
 * 
 * OSIRIS (https://osirisai.live/) 仿生全球实时摄像头 (Live World) 模块主入口组件。
 * 融合 3D/2D 投影切换、实时天文晨昏线、全球公开监控流与高阶暗黑科技视觉。
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  RadioTower,
  Globe,
  Map,
  Layers,
  Palette,
  SunMoon,
  RotateCcw,
  Maximize2,
  Minimize2,
  Video,
  Plane,
  Sparkles,
} from "lucide-react";
import LiveCamsMap from "./LiveCamsMap";
import LiveCamsSidebar from "./LiveCamsSidebar";
import CameraViewer from "./CameraViewer";
import AviationSidebar from "./aviation/AviationSidebar";
import FlightViewer from "./aviation/FlightViewer";
import LiveCamsStatusBar from "./LiveCamsStatusBar";
import MapThemeModal from "./components/MapThemeModal";
import { RAW_CAMERAS, filterCameras, loadFullCamerasData } from "./services/cameraCatalog";
import { fetchFlightsData, fetchFlightRoute } from "./services/flightService";
import { getSavedMapTheme, saveMapTheme, DEFAULT_THEME, getLuminance } from "./utils/mapTheme";
import "./liveCams.css";

const INITIAL_CAMERA =
  RAW_CAMERAS.find((c) => c.id === "tfl-JamCams_00001.09096") ||
  RAW_CAMERAS[0] ||
  null;

export default function WorldLiveCams({
  activeTab: propActiveTab,
  onTabChange: propOnTabChange,
}) {
  const [internalActiveTab, setInternalActiveTab] = useState("cameras");
  const activeModuleTab = propActiveTab !== undefined ? propActiveTab : internalActiveTab;

  const setActiveModuleTab = useCallback(
    (nextTab) => {
      setInternalActiveTab(nextTab);
      if (propOnTabChange) {
        propOnTabChange(nextTab);
      }
    },
    [propOnTabChange]
  );
  const [allCameras, setAllCameras] = useState(RAW_CAMERAS);
  const [projectionMode, setProjectionMode] = useState("3d");
  const [baseMapType, setBaseMapType] = useState("dark");
  const [dayNightVisible, setDayNightVisible] = useState(true);
  const [selectedContinent, setSelectedContinent] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all"); // 'all' | 'live' | 'snapshot'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCamera, setSelectedCamera] = useState(INITIAL_CAMERA);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(2.3);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState(getSavedMapTheme);

  // ── 航班模块状态 (Aviation States) ──
  const [flightsData, setFlightsData] = useState({
    all: [],
    commercial: [],
    privateFlights: [],
    jets: [],
    military: [],
    total: 0,
    counts: { total: 0, commercial: 0, private: 0, jets: 0, military: 0 },
    source: "live",
    timestamp: "",
  });
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedFlightCategory, setSelectedFlightCategory] = useState("all");
  const [flightSearchQuery, setFlightSearchQuery] = useState("");
  const [flightRouteData, setFlightRouteData] = useState(null);
  const [flightRouteLoading, setFlightRouteLoading] = useState(false);
  const [isFlightsLoading, setIsFlightsLoading] = useState(false);

  // 异步加载全球实时航班
  const loadFlights = useCallback(async () => {
    setIsFlightsLoading(true);
    try {
      const data = await fetchFlightsData();
      if (data && data.all && data.all.length > 0) {
        setFlightsData(data);
      }
    } catch (e) {
      console.warn("[WorldLiveCams] Flights load notice:", e);
    } finally {
      setIsFlightsLoading(false);
    }
  }, []);

  // 当切换到航班选项卡或初始装载时加载航班数据，并配置 60 秒静默定时轮询
  useEffect(() => {
    loadFlights();
    const interval = setInterval(loadFlights, 60000);
    return () => clearInterval(interval);
  }, [loadFlights]);

  // 当选中某架飞机时，自动解析其起降大圆航线 (确保只在 callsign/icao24 改变时触发，避免位置微动打断航线)
  useEffect(() => {
    if (!selectedFlight) {
      setFlightRouteData(null);
      setFlightRouteLoading(false);
      return;
    }
    const cs = (selectedFlight.callsign || "").trim().toUpperCase();
    const hex = (selectedFlight.icao24 || "").trim().toLowerCase();
    setFlightRouteLoading(true);
    let cancelled = false;
    fetchFlightRoute(cs, hex, selectedFlight.lat, selectedFlight.lng)
      .then((res) => {
        if (!cancelled) {
          setFlightRouteData(res);
          setFlightRouteLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFlightRouteLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFlight?.callsign, selectedFlight?.icao24]);

  // 选择指定飞机
  const handleSelectFlight = useCallback((flight) => {
    setSelectedFlight(flight);
    if (mapInstance && flight && Number.isFinite(flight.lat) && Number.isFinite(flight.lng)) {
      const curZoom = mapInstance.getZoom();
      // 如果当前缩放过大（如之前查看过探头处于 12+ 街景级别），智能收回至 5.8 广域航线视角，确保能看清飞机与大圆航线弧线
      const targetZoom = curZoom > 8 ? 5.8 : Math.max(curZoom, 5.5);
      mapInstance.flyTo({
        center: [flight.lng, flight.lat],
        zoom: targetZoom,
        duration: 900,
        essential: true,
      });
    }
  }, [mapInstance]);

  // 定位对齐飞机视角
  const handleLocateFlight = useCallback((lat, lng) => {
    if (mapInstance && Number.isFinite(lat) && Number.isFinite(lng)) {
      mapInstance.flyTo({
        center: [lng, lat],
        zoom: Math.max(mapInstance.getZoom(), 7),
        duration: 800,
        essential: true,
      });
    }
  }, [mapInstance]);

  // 聚焦全航线视角 (将起降机场与大圆航线完整框选在屏幕可视区内)
  const handleFitFlightRoute = useCallback(() => {
    if (!mapInstance || !flightRouteData || !flightRouteData.found) return;
    const { origin, destination } = flightRouteData;
    if (!origin || !destination) return;
    try {
      const minLng = Math.min(origin.lng, destination.lng);
      const maxLng = Math.max(origin.lng, destination.lng);
      const minLat = Math.min(origin.lat, destination.lat);
      const maxLat = Math.max(origin.lat, destination.lat);
      mapInstance.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: { top: 90, bottom: 90, left: 340, right: 380 },
          maxZoom: 6.5,
          duration: 1100,
          essential: true,
        }
      );
    } catch (err) {
      console.warn("[WorldLiveCams] fitBounds notice:", err);
    }
  }, [mapInstance, flightRouteData]);

  // 切换下一个航班
  const handleNextFlight = useCallback(() => {
    const list = flightsData?.all || [];
    if (!list.length) return;
    const curIdx = list.findIndex((f) => f.icao24 === selectedFlight?.icao24);
    if (curIdx === -1) {
      handleSelectFlight(list[0]);
    } else {
      const nextIdx = (curIdx + 1) % list.length;
      handleSelectFlight(list[nextIdx]);
    }
  }, [flightsData, selectedFlight, handleSelectFlight]);

  // 异步加载全球 45,000+ 全量摄像头网络
  useEffect(() => {
    loadFullCamerasData().then((fullList) => {
      if (fullList && fullList.length > 0) {
        setAllCameras(fullList);
      }
    });
  }, []);

  // 监听地图实时缩放等级 (用于自适应面板明暗主题)
  useEffect(() => {
    if (!mapInstance) return;
    const updateZoom = () => {
      setCurrentZoom(mapInstance.getZoom());
    };
    updateZoom();
    mapInstance.on("zoom", updateZoom);
    return () => {
      mapInstance.off("zoom", updateZoom);
    };
  }, [mapInstance]);

  // 当前所选大洲下的探头总数与细分数量（用于侧栏动态计数徽标）
  const continentCameras = useMemo(() => {
    if (selectedContinent === "all") return allCameras;
    return filterCameras({ cameras: allCameras, continent: selectedContinent, streamFilter: "all" });
  }, [allCameras, selectedContinent]);

  const liveCount = useMemo(() => {
    return continentCameras.filter((c) => c.hasLiveVideo).length;
  }, [continentCameras]);

  const snapshotCount = useMemo(() => {
    return continentCameras.length - liveCount;
  }, [continentCameras, liveCount]);

  // 摄像头根据大洲、视频流类型 (全部/实时/快照) 及搜索词多维复合过滤
  const displayedCameras = useMemo(() => {
    return filterCameras({
      cameras: allCameras,
      continent: selectedContinent,
      streamFilter,
      query: searchQuery,
    });
  }, [allCameras, selectedContinent, streamFilter, searchQuery]);

  // 根据底色明暗度与地球缩放大小动态计算自适应外观：
  // 当大框底色设为浅色（如纯白），且地球缩很小时（zoom <= 2.8），外围暴露浅色底衬，此时面板采用清爽透光亮色；
  // 当地球放大（zoom > 2.8）暗黑地图铺满全屏时，面板自适应变回深色科技风；
  // 若陆地底色本身亦为亮色（如象牙素雅），则持续保持高雅明朗。
  const isAdaptiveLight = useMemo(() => {
    const bg = mapTheme?.bg || "#ffffff";
    const bgLum = getLuminance(bg);
    const landLum = getLuminance(mapTheme?.land || "#000000");
    const isBgLight = bgLum > 0.55;
    const isLandLight = baseMapType === "sat" ? false : landLum > 0.55;

    if (!isBgLight && !isLandLight) return false;

    if (isLandLight) return true;

    // 3D 模式下，当球体较小 (zoom <= 2.8)，左右露出浅色底衬，面板采用明亮色；
    // 当球体放大 (zoom > 2.8)，深色地球铺满全屏，两侧面板自适应变回深色科技风
    if (projectionMode === "3d") {
      return currentZoom <= 2.8;
    }
    // 2D 平面投影下，底图完全铺满整个视口，若陆地为深色则面板自适应为深色科技风
    return isLandLight;
  }, [mapTheme?.bg, mapTheme?.land, currentZoom, projectionMode, baseMapType]);

  // 选择摄像头
  const handleSelectCamera = useCallback((camera) => {
    setSelectedCamera(camera);
  }, []);

  // 切换至下一个摄像头 (在当前过滤列表安全闭环循环，到达最后一路时自动绕回首路)
  const handleNextCamera = useCallback(() => {
    if (!displayedCameras || displayedCameras.length === 0) return;
    const currentIndex = displayedCameras.findIndex(
      (c) => String(c.id) === String(selectedCamera?.id)
    );
    if (currentIndex === -1) {
      setSelectedCamera(displayedCameras[0]);
    } else {
      const nextIndex = (currentIndex + 1) % displayedCameras.length;
      setSelectedCamera(displayedCameras[nextIndex]);
    }
  }, [displayedCameras, selectedCamera]);

  // 重置视角
  const handleResetView = useCallback(() => {
    setResetTrigger((c) => c + 1);
  }, []);

  // 全屏切换
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // 配色方案更新
  const handleThemeChange = useCallback((newTheme) => {
    setMapTheme(newTheme);
    saveMapTheme(newTheme);
  }, []);

  // 恢复默认配色
  const handleResetTheme = useCallback(() => {
    setMapTheme({ ...DEFAULT_THEME });
    saveMapTheme(DEFAULT_THEME);
  }, []);

  // 渲染通用控制操作按钮群组（支持普通头部与全屏沉浸悬浮顶部复用）
  const renderControlsToolbar = (inFullscreen = false) => (
    <div className={inFullscreen ? "liveworld-fullscreen-toolbar" : "liveworld-outer-toolbar"}>
      {/* 3D地球 / 2D地图 */}
      <button
        type="button"
        className={`liveworld-nav-pill ${projectionMode === "3d" ? "is-active" : ""}`}
        onClick={() => setProjectionMode(projectionMode === "3d" ? "2d" : "3d")}
        title="切换 3D 地球球体 / 2D 平面投影"
      >
        {projectionMode === "3d" ? <Globe size={14} /> : <Map size={14} />}
        <span>{projectionMode === "3d" ? "3D 地球" : "2D 地图"}</span>
      </button>

      {/* 暗黑MAP / 卫星SAT */}
      <button
        type="button"
        className={`liveworld-nav-pill ${baseMapType === "sat" ? "is-active" : ""}`}
        onClick={() => setBaseMapType(baseMapType === "sat" ? "dark" : "sat")}
        title="切换 CARTO 深色矢量底图 / 全球卫星影像"
      >
        <Layers size={14} />
        <span>{baseMapType === "sat" ? "卫星 SAT" : "暗黑 MAP"}</span>
      </button>

      {/* 配色 */}
      <button
        type="button"
        className={`liveworld-nav-pill ${isThemeModalOpen ? "is-active" : ""}`}
        onClick={() => setIsThemeModalOpen(true)}
        title="自定义地图与功能块底色（底色、陆地、海洋、边界、探头）"
      >
        <Palette size={14} />
        <span>配色</span>
      </button>

      {/* 晨昏线 开/关 */}
      <button
        type="button"
        className={`liveworld-nav-pill ${dayNightVisible ? "is-active" : ""}`}
        onClick={() => setDayNightVisible((v) => !v)}
        title="开启 / 关闭全球实时昼夜分界晨昏线与夜半球暗色阴影"
      >
        <SunMoon size={14} />
        <span>晨昏线 {dayNightVisible ? "开" : "关"}</span>
      </button>

      {/* 重置视角 */}
      <button
        type="button"
        className="liveworld-nav-pill"
        onClick={handleResetView}
        title="重置视角，飞回全球中心全景"
      >
        <RotateCcw size={14} />
        <span>重置</span>
      </button>

      {/* 全屏切换 */}
      <button
        type="button"
        className="liveworld-nav-pill"
        onClick={handleToggleFullscreen}
        title={isFullscreen ? "退出全屏" : "全屏沉浸探索"}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {inFullscreen && <span style={{ marginLeft: "4px" }}>退出全屏</span>}
      </button>
    </div>
  );

  return (
    <div className="liveworld-master-wrapper">
      {/* 1. 顶部子功能切换选项卡 (全球实时摄像头 vs 全球实时航班) */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
        <div className="travel-games-tab-switcher">
          <button
            type="button"
            className={`game-nav-tab-btn ${activeModuleTab === "cameras" ? "is-active" : ""}`}
            onClick={() => setActiveModuleTab("cameras")}
          >
            <Video size={16} />
            <span>全球实时摄像头</span>
          </button>
          <button
            type="button"
            className={`game-nav-tab-btn ${activeModuleTab === "aviation" ? "is-active" : ""}`}
            onClick={() => setActiveModuleTab("aviation")}
          >
            <Plane size={16} />
            <span>全球实时航班</span>
          </button>
        </div>
      </div>

      {/* 2. 标题区与右侧控制栏 */}
      <div className="travel-game-header-row">
        <div className="travel-game-title-group">
          <h2 className="notes-hero-title">
            {activeModuleTab === "aviation" ? (
              <Plane className="notes-hero-icon" size={24} color="#00E5FF" />
            ) : (
              <RadioTower className="notes-hero-icon" size={24} color="#0284c7" />
            )}
            <span className="game-hero-brand-text">LIVE WORLD</span>
            <span className="notes-title-sub">
              {activeModuleTab === "aviation" ? "全球实时航班" : "全球实时摄像头"}
            </span>
          </h2>
          <p className="travel-game-subtitle">
            <Sparkles size={16} className="game-sub-icon" />
            <span>
              {activeModuleTab === "aviation"
                ? `接入全球多源 ADS-B 航空网络，实时雷达监测 ${(flightsData.total || 8300).toLocaleString()}+ 架在航空器与航线`
                : "接入全球 45,000+ 公开探头与 24/7 高清连续视频流，纵览全球实时景象"}
            </span>
          </p>
        </div>

        {/* 右侧操作按钮群组 */}
        <div className="travel-game-header-actions">
          {renderControlsToolbar(false)}
        </div>
      </div>

      {/* 3. 核心地球黑盒容器 */}
      <div
        className={`livecam-shell ${isFullscreen ? "is-fullscreen" : ""} ${isAdaptiveLight ? "is-light-theme" : ""}`}
        style={{
          "--livecam-bg": mapTheme.bg || "#04040a",
          backgroundColor: mapTheme.bg || "#04040a",
        }}
      >
        {/* 全屏状态下的顶部悬浮功能栏 */}
        {isFullscreen && renderControlsToolbar(true)}

        {/* 左侧多维筛选与探索侧栏 (根据当前功能选项卡动态切换) */}
        {activeModuleTab === "cameras" ? (
          <LiveCamsSidebar
            cameras={displayedCameras}
            selectedContinent={selectedContinent}
            onSelectContinent={setSelectedContinent}
            streamFilter={streamFilter}
            onSelectStreamFilter={setStreamFilter}
            totalCount={continentCameras.length}
            liveCount={liveCount}
            snapshotCount={snapshotCount}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCameraId={selectedCamera?.id}
            onSelectCamera={handleSelectCamera}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
          />
        ) : (
          <AviationSidebar
            flightsData={flightsData}
            selectedCategory={selectedFlightCategory}
            onSelectCategory={setSelectedFlightCategory}
            searchQuery={flightSearchQuery}
            onSearchChange={setFlightSearchQuery}
            selectedFlight={selectedFlight}
            onSelectFlight={handleSelectFlight}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
            onRefresh={loadFlights}
            isLoading={isFlightsLoading}
          />
        )}

        {/* MapLibre 核心共用地图画布 */}
        <LiveCamsMap
          cameras={displayedCameras}
          projectionMode={projectionMode}
          baseMapType={baseMapType}
          dayNightVisible={dayNightVisible}
          selectedCamera={selectedCamera}
          onSelectCamera={handleSelectCamera}
          onMapReady={setMapInstance}
          resetTrigger={resetTrigger}
          mapTheme={mapTheme}
          activeModuleTab={activeModuleTab}
          flights={flightsData.all}
          selectedFlight={selectedFlight}
          flightRouteData={flightRouteData}
          onSelectFlight={handleSelectFlight}
        />

        {/* 右侧抽屉 (摄像头播放器 / 航班战术详情面板) */}
        {activeModuleTab === "cameras" && selectedCamera && (
          <CameraViewer
            key={selectedCamera.id}
            camera={selectedCamera}
            onClose={() => setSelectedCamera(null)}
            onNextCamera={handleNextCamera}
          />
        )}

        {activeModuleTab === "aviation" && selectedFlight && (
          <FlightViewer
            key={selectedFlight.icao24}
            flight={selectedFlight}
            routeData={flightRouteData}
            isRouteLoading={flightRouteLoading}
            onClose={() => setSelectedFlight(null)}
            onLocate={handleLocateFlight}
            onFitRoute={handleFitFlightRoute}
            onNextFlight={handleNextFlight}
          />
        )}

        {/* 底部信息状态栏 */}
        <LiveCamsStatusBar
          map={mapInstance}
          projectionMode={projectionMode}
          baseMapType={baseMapType}
          activeModuleTab={activeModuleTab}
          flightCount={flightsData.total}
        />
      </div>

      {/* 地图多样性配色弹窗 */}
      <MapThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={mapTheme}
        onThemeChange={handleThemeChange}
        onResetTheme={handleResetTheme}
      />
    </div>
  );
}
