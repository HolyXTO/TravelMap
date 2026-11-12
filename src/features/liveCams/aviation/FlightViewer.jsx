// -*- coding: utf-8 -*-
/**
 * FlightViewer.jsx
 * 
 * OSIRIS 仿生航空器战术详情终端：
 * 1. 实时遥测指标矩阵：高度、地速、航向角、应答机 Squawk、垂直升降率；
 * 2. 真实起降航线反查：起飞机场 (DEP) -> 目的地机场 (ARR)，实时航程进度条与飞行里程；
 * 3. 航空器机身身份库识别：真实注册号 Registration、具体机型 Model、所属航空公司 Operator；
 * 4. 三大国际航空情报系统直链：FlightAware、ADS-B Exchange、RadarBox。
 */
import React, { useState, useEffect } from "react";
import {
  X,
  Plane,
  Crosshair,
  ExternalLink,
  MapPin,
  Gauge,
  Compass,
  ArrowUpRight,
  Shield,
  Briefcase,
  User,
  Radio,
  Shuffle,
  Maximize2,
  Loader2,
} from "lucide-react";
import { fetchAircraftDetail, fetchFlightRoute } from "../services/flightService";
import { getCountryDisplayName } from "../utils/airports";

export default function FlightViewer({
  flight,
  routeData: propRouteData,
  isRouteLoading: propIsRouteLoading,
  onClose,
  onLocate,
  onFitRoute,
  onRandomFlight,
}) {
  const [internalRouteData, setInternalRouteData] = useState(null);
  const [internalRouteLoading, setInternalRouteLoading] = useState(false);
  const [aircraftDetail, setAircraftDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(true);

  const cs = (flight?.callsign || "").trim().toUpperCase();
  const hex = (flight?.icao24 || "").trim().toLowerCase();

  // 1. 起降航线数据：优先采用上层传入的权威同步数据 (地图与右侧框 100% 同源保证)
  const isControlled = propRouteData !== undefined;
  const routeData = isControlled ? propRouteData : internalRouteData;
  const isRouteLoading = isControlled ? Boolean(propIsRouteLoading) : internalRouteLoading;

  useEffect(() => {
    if (!flight || isControlled) return;
    setInternalRouteLoading(true);
    setInternalRouteData(null);

    let cancelled = false;
    fetchFlightRoute(cs, hex, flight.lat, flight.lng)
      .then((res) => {
        if (!cancelled) {
          setInternalRouteData(res);
          setInternalRouteLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setInternalRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cs, hex, isControlled]);

  // 2. 异步查询机型与注册号
  useEffect(() => {
    if (!flight) return;
    setIsDetailLoading(true);
    setAircraftDetail(null);

    let cancelled = false;
    fetchAircraftDetail(hex)
      .then((res) => {
        if (!cancelled) {
          setAircraftDetail(res);
          setIsDetailLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hex]);

  if (!flight) return null;

  const catColor =
    flight.category === "military"
      ? "#FF3D00"
      : flight.category === "jet"
      ? "#FF4081"
      : flight.category === "private"
      ? "#00E676"
      : "#00E5FF";

  const catLabel =
    flight.category === "military"
      ? "军用航空器 MILITARY"
      : flight.category === "jet"
      ? "公务喷气机 BIZJET"
      : flight.category === "private"
      ? "私人通用航空 PRIVATE"
      : "商业客运/货运 COMMERCIAL";

  const altitudeFt = flight.alt ? Math.round(flight.alt * 3.28084) : 0;
  const speedKmh = flight.speed_knots ? Math.round(flight.speed_knots * 1.852) : 0;
  const countryDisplay = getCountryDisplayName(flight.country);
  const countryLabel =
    countryDisplay.zh && countryDisplay.zh !== countryDisplay.en
      ? `${countryDisplay.zh} · ${countryDisplay.en}`
      : countryDisplay.zh || flight.country || "其他地区";

  // 判断是否为本场起降 / 闭环巡航任务 (如急救救援、警务巡逻、飞行训练等，起飞地与目的地相同)
  const isLocalLoop = Boolean(
    routeData?.found &&
    routeData?.origin &&
    routeData?.destination &&
    ((routeData.origin.iata && routeData.destination.iata && routeData.origin.iata === routeData.destination.iata) ||
     (routeData.origin.icao && routeData.destination.icao && routeData.origin.icao === routeData.destination.icao) ||
     routeData.totalDistanceKm === 0)
  );

  return (
    <div className="livecam-viewer-drawer">
      {/* 顶部标题控制栏 */}
      <div className="livecam-viewer-header">
        <div className="livecam-viewer-title-group">
          <div className="livecam-viewer-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="livecam-flight-callsign">
              {cs || hex.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: catColor,
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.06)",
                border: `1px solid ${catColor}55`,
              }}
            >
              {flight.category?.toUpperCase() || "FLIGHT"}
            </span>
          </div>

          <div className="livecam-flight-meta">
            <Radio size={12} style={{ color: catColor }} />
            <span className="livecam-flight-meta-hex">
              ICAO24: {hex.toUpperCase()}
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>{countryDisplay.zh || "其他地区"}</span>
          </div>
        </div>

        <div className="livecam-viewer-header-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="livecam-header-action-btn"
            onClick={() => onLocate?.(flight.lat, flight.lng)}
            title="中心对齐并追踪这架飞机"
          >
            <Crosshair size={15} />
          </button>
          <button
            type="button"
            className="livecam-header-action-btn close"
            onClick={onClose}
            title="关闭航班详情"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 抽屉内容区 (自适应舒展排版，恰到好处无多余留白) */}
      <div className="livecam-viewer-body">
        {/* 1. 起降航线进度卡片 */}
        <div
          className="livecam-flight-route-card"
          style={{ cursor: routeData?.found && onFitRoute ? "pointer" : "default" }}
          onClick={() => {
            if (routeData?.found && onFitRoute) onFitRoute();
          }}
          title={routeData?.found && onFitRoute ? "点击聚焦整条航线弧线与起降机场" : undefined}
        >
          <div className="livecam-flight-route-header">
            <span className="livecam-flight-route-title">
              FLIGHT ROUTE · 预定航线
            </span>
            {routeData?.airline && (
              <span className="livecam-flight-airline-name">
                {routeData.airline}
              </span>
            )}
          </div>

          {isRouteLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0", color: "var(--livecam-cyan)" }}>
              <Loader2 size={13} className="animate-spin" />
              <span style={{ fontSize: "10.5px", color: "var(--livecam-text-muted)" }}>正在查询航线与起降机场...</span>
            </div>
          ) : routeData && routeData.found && routeData.origin && routeData.destination ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div className="livecam-flight-airport-code">
                    {routeData.origin.iata || routeData.origin.icao}
                  </div>
                  <div className="livecam-flight-airport-city">
                    {routeData.origin.city || routeData.origin.name}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: "0 8px" }}>
                  <Plane
                    size={14}
                    style={{
                      color: "var(--livecam-cyan)",
                      transform: "rotate(45deg)",
                      marginBottom: "2px",
                    }}
                  />
                  <div className="livecam-flight-route-track">
                    <div
                      className="livecam-flight-route-bar"
                      style={{
                        width: `${routeData.progress || 50}%`,
                      }}
                    />
                  </div>
                  <div className="livecam-flight-distance">
                    {isLocalLoop
                      ? "本场起降 / 闭环往返"
                      : routeData.totalDistanceKm
                      ? `${routeData.totalDistanceKm.toLocaleString()} km · 大圆航线`
                      : "大圆航线"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div className="livecam-flight-airport-code">
                    {routeData.destination.iata || routeData.destination.icao}
                  </div>
                  <div className="livecam-flight-airport-city">
                    {routeData.destination.city || routeData.destination.name}
                  </div>
                </div>
              </div>
            </div>
          ) : routeData?.isMismatched ? (
            <div style={{ textAlign: "center", padding: "4px 2px" }}>
              <div style={{ fontSize: "10.5px", color: "var(--livecam-gold, #f59e0b)", fontWeight: 700 }}>
                {routeData.mismatchReason === "previous_leg_finished"
                  ? "前序经停航段已到达 · 当前执行后续航段"
                  : "公务包机 / 独立空域巡航中"}
              </div>
              <div style={{ fontSize: "10px", color: "var(--livecam-text-muted)", marginTop: "2px", lineHeight: 1.35 }}>
                {routeData.mismatchReason === "previous_leg_finished"
                  ? `历史时刻为 ${routeData.staleRoute?.origin?.city || routeData.staleRoute?.origin?.iata} → ${routeData.staleRoute?.destination?.city || routeData.staleRoute?.destination?.iata}，机身已飞越目的地`
                  : "ADS-B 开放数据库暂无本次临时航段信息，请点击下方直连查看"}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "3px 0" }}>
              <div style={{ fontSize: "10.5px", color: "var(--livecam-text)", opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Plane size={11} style={{ transform: "rotate(45deg)", color: "var(--livecam-cyan)" }} />
                <span>
                  {flight.category === "military"
                    ? "战术巡航任务 · 无公开商业计划"
                    : "非定期航线 · 实时坐标与航向已锁定"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. 实时遥测指标矩阵 (4-cell 仪表网格) */}
        <div className="livecam-flight-telemetry-section">
          <div className="livecam-flight-telemetry-title">
            TELEMETRY MATRIX · 飞行遥测
          </div>
          <div className="livecam-flight-telemetry-grid">
            {/* 高度 */}
            <div className="livecam-flight-telemetry-cell">
              <div className="livecam-flight-telemetry-label">高度 ALTITUDE</div>
              <div className="livecam-flight-telemetry-val">
                {flight.alt ? `${flight.alt.toLocaleString()} m` : "Ground"}
              </div>
              <div className="livecam-flight-telemetry-sub">
                {altitudeFt ? `${altitudeFt.toLocaleString()} ft` : "地面滑行"}
              </div>
            </div>

            {/* 地速 */}
            <div className="livecam-flight-telemetry-cell">
              <div className="livecam-flight-telemetry-label">地速 GROUND SPEED</div>
              <div className="livecam-flight-telemetry-val">
                {Math.round(flight.speed_knots || 0)} kt
              </div>
              <div className="livecam-flight-telemetry-sub">
                {speedKmh ? `${speedKmh} km/h` : "—"}
              </div>
            </div>

            {/* 航向 */}
            <div className="livecam-flight-telemetry-cell">
              <div className="livecam-flight-telemetry-label">航向 TRACK / HDG</div>
              <div className="livecam-flight-telemetry-val neutral" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Compass size={13} style={{ transform: `rotate(${flight.heading || 0}deg)`, color: "var(--livecam-cyan)" }} />
                <span>{Math.round(flight.heading || 0)}°</span>
              </div>
              <div className="livecam-flight-telemetry-sub">
                方位基准: 真北地面航迹
              </div>
            </div>

            {/* 应答机 */}
            <div className="livecam-flight-telemetry-cell">
              <div className="livecam-flight-telemetry-label">应答机 SQUAWK</div>
              <div className="livecam-flight-telemetry-val neutral">
                {flight.squawk || "1200"}
              </div>
              <div className="livecam-flight-telemetry-sub">
                状态: {flight.grounded ? "地面停泊" : "在空巡航"}
              </div>
            </div>
          </div>
        </div>

        {/* 3. 机身身份资料卡 (Airframe Details) */}
        <div className="livecam-flight-identity-card">
          <div className="livecam-flight-identity-title">
            AIRCRAFT IDENTITY · 机身档案
          </div>

          <div className="livecam-flight-identity-list">
            <div className="livecam-flight-identity-row">
              <span className="livecam-flight-identity-label">机型型号:</span>
              <span className="livecam-flight-identity-val">
                {aircraftDetail?.model || flight.model || "—"}
              </span>
            </div>
            <div className="livecam-flight-identity-row">
              <span className="livecam-flight-identity-label">民航注册号:</span>
              <span className="livecam-flight-identity-val accent">
                {aircraftDetail?.registration || flight.registration || "—"}
              </span>
            </div>
            <div className="livecam-flight-identity-row">
              <span className="livecam-flight-identity-label">所属运营方:</span>
              <span className="livecam-flight-identity-val" style={{ opacity: 0.9 }}>
                {aircraftDetail?.operator || routeData?.airline || "—"}
              </span>
            </div>
            <div className="livecam-flight-identity-row">
              <span className="livecam-flight-identity-label">机身注册国:</span>
              <span className="livecam-flight-identity-val" title="民航应答机注册国籍 (ICAO Code)">
                {countryLabel}
              </span>
            </div>
            <div className="livecam-flight-identity-row">
              <span className="livecam-flight-identity-label">当前坐标:</span>
              <span className="livecam-flight-identity-val" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, opacity: 0.85 }}>
                {flight.lat?.toFixed(4)}, {flight.lng?.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* 4. 国际航空情报外部直链 (OSINT Links - 2x2 网格) */}
        <div className="livecam-flight-intel-section">
          <div className="livecam-flight-intel-title">
            INTELLIGENCE RADAR · 情报直连
          </div>
          <div className="livecam-flight-intel-links">
            {cs && (
              <a
                href={`https://www.flightradar24.com/${encodeURIComponent(cs)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="livecam-flight-intel-btn"
                title="在 Flightradar24 查看该航班实时雷达"
              >
                <span>Flightradar24</span>
                <ExternalLink size={10} />
              </a>
            )}

            {cs && (
              <a
                href={`https://www.flightaware.com/live/flight/${encodeURIComponent(cs)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="livecam-flight-intel-btn"
                title="在 FlightAware 查看民航计划与前序航段"
              >
                <span>FlightAware</span>
                <ExternalLink size={10} />
              </a>
            )}

            {hex && (
              <a
                href={`https://globe.adsbexchange.com/?icao=${encodeURIComponent(hex)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="livecam-flight-intel-btn"
                title="在 ADS-B Exchange 查看原始应答机数据"
              >
                <span>ADS-B Ex</span>
                <ExternalLink size={10} />
              </a>
            )}

            {cs && (
              <a
                href={`https://www.radarbox.com/data/flights/${encodeURIComponent(cs)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="livecam-flight-intel-btn"
                title="在 AirNav RadarBox 查看航迹"
              >
                <span>RadarBox</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 (100% 占满该行) */}
      <div className="livecam-viewer-actions">
        <button
          type="button"
          className="livecam-action-btn secondary"
          onClick={() => onLocate?.(flight.lat, flight.lng)}
          title="居中对齐当前飞机位置"
        >
          <Crosshair size={13} />
          <span>定位锁定</span>
        </button>

        <button
          type="button"
          className={`livecam-action-btn ${routeData?.found ? "primary" : "disabled"}`}
          onClick={() => {
            if (routeData?.found && onFitRoute) onFitRoute();
          }}
          disabled={!routeData?.found}
          title={routeData?.found ? "在地球上居中呈现整条起降大圆航线" : "当前航班暂无完整起降计划"}
        >
          <Maximize2 size={13} />
          <span>聚焦全航线</span>
        </button>

        {onRandomFlight && (
          <button
            type="button"
            className="livecam-action-btn explore"
            onClick={onRandomFlight}
            title="随机漫游探索一架在空航班"
          >
            <Shuffle size={13} />
            <span>随机探索</span>
          </button>
        )}
      </div>
    </div>
  );
}
