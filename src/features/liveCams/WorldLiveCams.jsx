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
import LiveCamsStatusBar from "./LiveCamsStatusBar";
import MapThemeModal from "./components/MapThemeModal";
import { RAW_CAMERAS, filterCameras, loadFullCamerasData } from "./services/cameraCatalog";
import { getSavedMapTheme, saveMapTheme, DEFAULT_THEME, getLuminance } from "./utils/mapTheme";
import "./liveCams.css";

export default function WorldLiveCams() {
  const [activeModuleTab, setActiveModuleTab] = useState("cameras");
  const [allCameras, setAllCameras] = useState(RAW_CAMERAS);
  const [projectionMode, setProjectionMode] = useState("3d");
  const [baseMapType, setBaseMapType] = useState("dark");
  const [dayNightVisible, setDayNightVisible] = useState(true);
  const [selectedContinent, setSelectedContinent] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all"); // 'all' | 'live' | 'snapshot'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(1.8);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [mapTheme, setMapTheme] = useState(getSavedMapTheme);

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
  // 当大框底色设为浅色（如纯白），且地球缩很小时（zoom <= 2.8），外围暴露浅色底，此时面板采用清爽透光亮色；
  // 当地球放大（zoom > 2.8）暗黑地图铺满全屏时，面板自适应变回暗黑科技风；
  // 若陆地底色本身亦为亮色（如象牙素雅），则持续保持高雅明朗。
  const isAdaptiveLight = useMemo(() => {
    const bg = mapTheme?.bg || "#ffffff";
    const bgLum = getLuminance(bg);
    const landLum = getLuminance(mapTheme?.land || "#000000");
    const isBgLight = bgLum > 0.55;
    const isLandLight = landLum > 0.55;

    if (!isBgLight && !isLandLight) return false;

    if (isLandLight) return true;

    // 3D 模式下，当球体较小 (zoom <= 2.8)，左右露出浅色底
    if (projectionMode === "3d") {
      return currentZoom <= 2.8;
    }
    return true;
  }, [mapTheme?.bg, mapTheme?.land, currentZoom, projectionMode]);

  // 选择摄像头
  const handleSelectCamera = useCallback((camera) => {
    setSelectedCamera(camera);
  }, []);

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
      {/* 1. 顶部子功能切换选项卡 (对齐游戏模块：实景图寻 地图盲填 实时对战) */}
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
            className="game-nav-tab-btn is-disabled"
            disabled
            title="全球实时航班功能正在对接 ADS-B 航空数据，敬请期待！"
            style={{
              cursor: "not-allowed",
              opacity: 0.65,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plane size={16} />
            <span>全球实时航班</span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "800",
                padding: "2px 6px",
                borderRadius: "999px",
                background: "rgba(100, 116, 139, 0.18)",
                color: "#64748b",
              }}
            >
              待上线
            </span>
          </button>
        </div>
      </div>

      {/* 2. 标题区与右侧控制栏 (完全在下方的地球框外，对齐 GEO GUESS PK 与区域分类) */}
      <div className="travel-game-header-row">
        <div className="travel-game-title-group">
          <h2 className="notes-hero-title">
            <RadioTower className="notes-hero-icon" size={24} color="#0284c7" />
            <span className="game-hero-brand-text">LIVE WORLD</span>
            <span className="notes-title-sub">全球实时摄像头</span>
          </h2>
          <p className="travel-game-subtitle">
            <Sparkles size={16} className="game-sub-icon" />
            <span>接入全球 45,000+ 公开探头与 24/7 高清连续视频流，纵览全球实时景象</span>
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
        {/* 全屏状态下的顶部悬浮功能栏（包含 3D地球、暗黑MAP、配色、晨昏线、重置、退出全屏） */}
        {isFullscreen && renderControlsToolbar(true)}

        {/* 左侧多维筛选与探索侧栏 */}
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

        {/* MapLibre 核心地图画布 */}
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
        />

        {/* 右侧播放器抽屉 */}
        {selectedCamera && (
          <CameraViewer
            camera={selectedCamera}
            onClose={() => setSelectedCamera(null)}
          />
        )}

        {/* 底部信息状态栏 */}
        <LiveCamsStatusBar
          map={mapInstance}
          projectionMode={projectionMode}
          baseMapType={baseMapType}
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
