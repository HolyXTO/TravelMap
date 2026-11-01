// -*- coding: utf-8 -*-
/**
 * LiveCamsToolbar.jsx
 * 
 * OSIRIS 风格顶部居中悬浮毛玻璃胶囊控制栏：
 * 包含 3D Globe / 2D 平面投影切换、MAP / SAT 底图切换、
 * DAY/NIGHT 真实晨昏线开关、重置全球视角以及全屏沉浸探索。
 */
import React from "react";
import { Globe, Map, SunMoon, RotateCcw, Maximize2, Minimize2, Layers, Palette } from "lucide-react";

export default function LiveCamsToolbar({
  projectionMode, // '3d' | '2d'
  onToggleProjection,
  baseMapType, // 'dark' | 'sat'
  onToggleBaseMap,
  dayNightVisible,
  onToggleDayNight,
  onResetView,
  isFullscreen,
  onToggleFullscreen,
  onOpenThemeModal,
  isThemeModalOpen,
}) {
  return (
    <div className="livecam-toolbar-container">
      <div className="livecam-toolbar">
        {/* 3D 球体 / 2D 平面 */}
        <button
          type="button"
          className={`livecam-tool-btn ${projectionMode === "3d" ? "is-active" : ""}`}
          onClick={() => onToggleProjection(projectionMode === "3d" ? "2d" : "3d")}
          title="切换 3D 地球球体 / 2D 平面投影"
        >
          {projectionMode === "3d" ? <Globe size={15} /> : <Map size={15} />}
          <span>{projectionMode === "3d" ? "3D 地球" : "2D 地图"}</span>
        </button>

        <div className="livecam-tool-divider" />

        {/* MAP 暗黑地图 / SAT 卫星影像 */}
        <button
          type="button"
          className={`livecam-tool-btn ${baseMapType === "sat" ? "is-active" : ""}`}
          onClick={() => onToggleBaseMap(baseMapType === "sat" ? "dark" : "sat")}
          title="切换 CARTO 深色矢量底图 / 全球卫星影像"
        >
          <Layers size={15} />
          <span>{baseMapType === "sat" ? "卫星 SAT" : "暗黑 MAP"}</span>
        </button>

        <div className="livecam-tool-divider" />

        {/* 地图多样性配色方案 */}
        <button
          type="button"
          className={`livecam-tool-btn ${isThemeModalOpen ? "is-active" : ""}`}
          onClick={onOpenThemeModal}
          title="自由调整地图配色（海洋、陆地、边界、道路及探头）"
        >
          <Palette size={15} />
          <span>配色</span>
        </button>

        <div className="livecam-tool-divider" />

        {/* 真实昼夜晨昏线开关 */}
        <button
          type="button"
          className={`livecam-tool-btn ${dayNightVisible ? "is-active" : ""}`}
          onClick={onToggleDayNight}
          title="开启 / 关闭全球实时昼夜分界晨昏线与夜半球暗色阴影"
        >
          <SunMoon size={15} />
          <span>晨昏线 {dayNightVisible ? "开" : "关"}</span>
        </button>

        <div className="livecam-tool-divider" />

        {/* 重置全球视角 */}
        <button
          type="button"
          className="livecam-tool-btn"
          onClick={onResetView}
          title="重置视角，飞回全球中心全景"
        >
          <RotateCcw size={14} />
          <span>重置</span>
        </button>

        {/* 全屏沉浸模式 */}
        <button
          type="button"
          className="livecam-tool-btn"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "退出全屏" : "全屏沉浸探索"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  );
}
