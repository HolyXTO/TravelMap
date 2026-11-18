// -*- coding: utf-8 -*-
/**
 * SatelliteViewer.jsx
 *
 * 卫星详情右侧浮动抽屉（分组清晰展示）：
 * 1. 目标身份：名称、NORAD 编号、国际代号 COSPAR、任务分类与分类来源；
 * 2. 推算状态：真实计算高度 (km)、SGP4 速度矢量模长 (km/s)、轨道周期、星下点经纬度、计算时间戳；
 * 3. 数据与控制：GP 要素历元 vs 采集时间、数据状态、视角定位、轨道显示开关、跟随镜头开关、N2YO 外链。
 */
import React from "react";
import {
  X,
  Satellite,
  Crosshair,
  ExternalLink,
  Navigation,
  Route,
  Clock,
  Database,
  Info,
} from "lucide-react";
import {
  getCategoryMeta,
  formatClassificationSource,
  classifyOrbitRegime,
} from "../utils/satelliteClassification";

function formatUtcAndLocal(msOrIso) {
  if (!msOrIso) return { utc: "—", local: "—" };
  const d = new Date(msOrIso);
  if (Number.isNaN(d.getTime())) return { utc: "—", local: "—" };
  const utc = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")} UTC`;
  const local = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return { utc, local };
}

function formatCoord(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "推算中...";
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${ns}, ${Math.abs(lng).toFixed(3)}°${ew}`;
}

export default function SatelliteViewer({
  satellite,
  telemetry,
  catalog,
  showOrbitTrack,
  onToggleOrbitTrack,
  followSelected,
  onToggleFollow,
  onLocate,
  onClose,
  isLightTheme = false,
}) {
  if (!satellite) return null;

  const meta = getCategoryMeta(satellite.category, isLightTheme);
  const altKm = telemetry?.altKm;
  const velKmS = telemetry?.velKmS;
  const periodMin = telemetry?.periodMinutes;
  const regime = classifyOrbitRegime(altKm);

  const calcTime = formatUtcAndLocal(telemetry?.timestampMs || Date.now());
  const epochTime = formatUtcAndLocal(satellite.elementEpoch || catalog?.elementEpoch);
  const fetchedTime = formatUtcAndLocal(catalog?.fetchedAt);

  return (
    <div className="livecam-viewer-drawer livecam-sat-viewer">
      {/* 顶部标题栏 */}
      <div className="livecam-viewer-header">
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div
            className="livecam-sat-badge-icon"
            style={{
              background: `${meta.displayColor}22`,
              borderColor: `${meta.displayColor}66`,
              color: meta.displayColor,
            }}
          >
            <Satellite size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="livecam-viewer-title" title={satellite.name}>
              {satellite.name}
            </div>
            <div className="livecam-viewer-subtitle">
              NORAD {satellite.noradId}
              {satellite.objectId ? ` · ${satellite.objectId}` : ""}
            </div>
          </div>
        </div>

        <div className="livecam-viewer-header-actions" style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="livecam-header-action-btn"
            onClick={() => onLocate?.(telemetry?.lat, telemetry?.lng)}
            disabled={!Number.isFinite(telemetry?.lat)}
            title="定位此卫星所在空域"
          >
            <Crosshair size={15} />
          </button>
          <button
            type="button"
            className="livecam-header-action-btn close"
            onClick={onClose}
            title="关闭卫星详情"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 主体内容：三组清晰分区 */}
      <div className="livecam-viewer-body">
        {/* 第 1 组：身份信息 */}
        <section className="livecam-sat-section">
          <div className="livecam-sat-section-title">
            <Info size={12} />
            <span>目标身份 · IDENTITY</span>
          </div>

          <div className="livecam-sat-identity-row">
            <span
              className="livecam-sat-cat-chip"
              style={{
                color: meta.displayColor,
                borderColor: `${meta.displayColor}55`,
                background: `${meta.displayColor}1a`,
              }}
            >
              <span className="livecam-sat-cat-dot" style={{ background: meta.displayColor }} />
              {meta.fullLabel}
            </span>
            <span className="livecam-sat-regime-chip">{regime.code}</span>
          </div>

          <div className="livecam-sat-kv-list">
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">所属国家 / 机构</span>
              <span className="livecam-sat-kv-value">
                {satellite.countryDisplay?.flag || "🌐"}{" "}
                {satellite.countryDisplay?.zh || "未标明归属"}
                {satellite.owner ? ` (${satellite.owner})` : ""}
              </span>
            </div>
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">NORAD 编号</span>
              <span className="livecam-sat-kv-value">{satellite.noradId}</span>
            </div>
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">分类来源</span>
              <span className="livecam-sat-kv-value">
                {formatClassificationSource(satellite.classificationSource)}
              </span>
            </div>
          </div>
        </section>

        {/* 第 2 组：实时推算轨道状态 */}
        <section className="livecam-sat-section">
          <div className="livecam-sat-section-title">
            <Clock size={12} />
            <span>推算状态 · COMPUTED TELEMETRY</span>
          </div>

          <div className="livecam-sat-metrics-grid">
            <div className="livecam-sat-metric-card">
              <span className="livecam-sat-metric-label">真实高度 (Altitude)</span>
              <span className="livecam-sat-metric-value">
                {Number.isFinite(altKm) ? `${altKm.toFixed(1)} km` : "—"}
              </span>
            </div>
            <div className="livecam-sat-metric-card">
              <span className="livecam-sat-metric-label">轨道速度 (km/s)</span>
              <span className="livecam-sat-metric-value">
                {Number.isFinite(velKmS) ? `${velKmS.toFixed(2)} km/s` : "—"}
              </span>
            </div>
            <div className="livecam-sat-metric-card">
              <span className="livecam-sat-metric-label">轨道周期</span>
              <span className="livecam-sat-metric-value">
                {Number.isFinite(periodMin) ? `${periodMin.toFixed(1)} min` : "—"}
              </span>
            </div>
            <div className="livecam-sat-metric-card">
              <span className="livecam-sat-metric-label">轨道层级</span>
              <span className="livecam-sat-metric-value" style={{ fontSize: "12.5px" }}>
                {regime.label}
              </span>
            </div>
          </div>

          <div className="livecam-sat-kv-list" style={{ marginTop: 8 }}>
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">星下点坐标</span>
              <span className="livecam-sat-kv-value">
                {formatCoord(telemetry?.lat, telemetry?.lng)}
              </span>
            </div>
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">计算时间 (UTC / 本地)</span>
              <span className="livecam-sat-kv-value">
                {calcTime.utc} ({calcTime.local})
              </span>
            </div>
          </div>
        </section>

        {/* 第 3 组：数据与视角控制 */}
        <section className="livecam-sat-section">
          <div className="livecam-sat-section-title">
            <Database size={12} />
            <span>数据与控制 · DATA &amp; CONTROLS</span>
          </div>

          <div className="livecam-sat-kv-list">
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">数据状态</span>
              <span className={`livecam-sat-inline-status is-${catalog?.status || "cached"}`}>
                {catalog?.statusLabel || "缓存"}
              </span>
            </div>
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">轨道要素历元 (Epoch)</span>
              <span className="livecam-sat-kv-value">{epochTime.utc}</span>
            </div>
            <div className="livecam-sat-kv-item">
              <span className="livecam-sat-kv-label">最近采集时间</span>
              <span className="livecam-sat-kv-value">{fetchedTime.utc}</span>
            </div>
          </div>

          <div className="livecam-sat-controls-grid">
            <button
              type="button"
              className="livecam-sat-ctrl-btn is-primary"
              onClick={() => onLocate?.(telemetry?.lat, telemetry?.lng)}
              disabled={!Number.isFinite(telemetry?.lat)}
            >
              <Crosshair size={14} />
              <span>定位目标</span>
            </button>

            <button
              type="button"
              className={`livecam-sat-ctrl-btn ${showOrbitTrack ? "is-active" : ""}`}
              onClick={onToggleOrbitTrack}
            >
              <Route size={14} />
              <span>{showOrbitTrack ? "已显示轨道" : "显示轨道"}</span>
            </button>

            <button
              type="button"
              className={`livecam-sat-ctrl-btn ${followSelected ? "is-active" : ""}`}
              onClick={onToggleFollow}
              disabled={!Number.isFinite(telemetry?.lat)}
              title="开启后地图镜头随卫星实时移动，手动拖拽地图自动暂停跟随"
            >
              <Navigation size={14} />
              <span>{followSelected ? "正在跟随" : "镜头跟随"}</span>
            </button>

            <a
              className="livecam-sat-ctrl-btn"
              href={`https://www.n2yo.com/satellite/?s=${encodeURIComponent(satellite.noradId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} />
              <span>N2YO 档案</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
