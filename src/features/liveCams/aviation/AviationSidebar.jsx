// -*- coding: utf-8 -*-
/**
 * AviationSidebar.jsx
 * 
 * OSIRIS 风格全球实时航班左侧探索与多维筛选侧栏：
 * 1. 5 档航空器类别极速过滤 (全部 / 商业航班 / 私人航空 / 公务喷气机 / 军用航空)；
 * 2. 搜索联动 (呼号 Callsign、机型 Model、注册国家、ICAO24)；
 * 3. 实时遥测指标与总数统计看板；
 * 4. 航班卡片列表快速定位与点击追踪联动。
 */
import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plane,
  RotateCw,
  Compass,
  Globe,
} from "lucide-react";
import { filterFlights } from "../services/flightService";
import { getCountryDisplayName } from "../utils/airports";

const CATEGORY_ITEMS = [
  { id: "all", label: "全部", countKey: "total", color: "#38bdf8" },
  { id: "commercial", label: "民航", countKey: "commercial", color: "#00E5FF" },
  { id: "private", label: "私人", countKey: "private", color: "#00E676" },
  { id: "jet", label: "公务机", countKey: "jets", color: "#FF4081" },
  { id: "military", label: "军用", countKey: "military", color: "#FF3D00" },
];

export default function AviationSidebar({
  flightsData,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  selectedFlight,
  onSelectFlight,
  isCollapsed,
  onToggleCollapse,
  onRefresh,
  isLoading,
}) {
  const [expandedCountries, setExpandedCountries] = useState(new Set());

  const counts = flightsData?.counts || {
    total: 0,
    commercial: 0,
    private: 0,
    jets: 0,
    military: 0,
  };

  const allList = flightsData?.all || [];
  const isInitialLoading = Boolean(isLoading && allList.length === 0);

  // 根据当前选中类别与多语言关键词过滤
  const filteredFlights = useMemo(() => {
    return filterFlights({
      flights: allList,
      category: selectedCategory,
      searchQuery,
      limit: 0,
    });
  }, [allList, selectedCategory, searchQuery]);

  // 按所属国家进行分组 (降序排序)
  const countryGroups = useMemo(() => {
    const map = new Map();
    for (const f of filteredFlights) {
      const c = f.country || "Other";
      if (!map.has(c)) {
        map.set(c, []);
      }
      map.get(c).push(f);
    }
    return Array.from(map.entries())
      .map(([country, list]) => {
        const display = getCountryDisplayName(country);
        return {
          country,
          display,
          flights: list,
          count: list.length,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredFlights]);

  const isSearching = Boolean(searchQuery && searchQuery.trim());

  // 切换展开/收起某个国家
  const toggleCountry = (country) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  };

  // 一键切换全部展开 / 全部收起
  const toggleAllCountries = () => {
    if (expandedCountries.size > 0) {
      setExpandedCountries(new Set());
    } else {
      setExpandedCountries(new Set(countryGroups.map((g) => g.country)));
    }
  };

  return (
    <>
      {/* 折叠时显示的小浮标按钮 */}
      {isCollapsed && (
        <button
          type="button"
          className="livecam-sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title="展开实时航班列表"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* 主面板 */}
      <div className={`livecam-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
        {/* 顶部标题与折叠 */}
        <div className="livecam-sidebar-header">
          <div className="livecam-sidebar-title-group">
            <Plane size={16} color="#00e5ff" />
            <span className="livecam-sidebar-title">全球实时航班</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              className="livecam-icon-btn"
              onClick={onRefresh}
              title="立即刷新最新雷达数据"
            >
              <RotateCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              className="livecam-icon-btn"
              onClick={onToggleCollapse}
              title="收起侧栏"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        </div>

        {/* 关键词搜索 (支持巴黎/法国等中英文与机场代码联想) */}
        <div className="livecam-search-box">
          <Search size={14} className="livecam-search-icon" />
          <input
            type="text"
            className="livecam-search-input"
            placeholder="搜索航班号、城市、机场或国家..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="livecam-search-clear-btn"
              onClick={() => onSearchChange("")}
              title="清空搜索"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 多维复合筛选栏：5 档航空器极速过滤与实时机队数量集成 */}
        <div className="livecam-filter-panel" style={{ paddingBottom: "10px" }}>
          <div className="livecam-flight-cat-grid">
            {CATEGORY_ITEMS.map((item) => {
              const isActive = selectedCategory === item.id;
              const countVal =
                item.countKey === "total"
                  ? (counts.total || allList.length || 0)
                  : (counts[item.countKey] || 0);

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`livecam-flight-cat-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelectCategory(item.id)}
                  title={isInitialLoading ? `正在加载${item.label}统计` : `筛选${item.label} (${countVal.toLocaleString()} 架)`}
                >
                  <span className="livecam-flight-cat-label">{item.label}</span>
                  <span
                    className={`livecam-flight-cat-count ${isInitialLoading ? "is-loading" : ""}`}
                    style={{ color: isActive ? "#ffffff" : item.color }}
                  >
                    {isInitialLoading ? "—" : countVal.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 列表头部操作摘要栏：国家分组数量与一键全部展开/收起 */}
        <div className="livecam-group-summary-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="livecam-group-summary-text" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {isInitialLoading ? (
              <>
                <span className="livecam-radar-status-dot" />
                <span>正在同步全球 ADS-B 航空雷达...</span>
              </>
            ) : (
              `${countryGroups.length} 个国家 · ${filteredFlights.length.toLocaleString()} 架航空器`
            )}
          </span>
          {!isInitialLoading && countryGroups.length > 0 && (
            <button
              type="button"
              onClick={toggleAllCountries}
              style={{
                background: "none",
                border: "none",
                color: "var(--livecam-cyan)",
                fontSize: "11px",
                cursor: "pointer",
                padding: "2px 4px",
                fontWeight: 600,
              }}
            >
              {expandedCountries.size > 0 ? "全部收起" : "全部展开"}
            </button>
          )}
        </div>

        {/* 按国家分组手风琴列表 (默认全部收起) */}
        <div className="livecam-sidebar-list">
          {isInitialLoading ? (
            <div className="livecam-loading-state">
              <div className="livecam-radar-loader">
                <span className="livecam-radar-ring is-ring-1" />
                <span className="livecam-radar-ring is-ring-2" />
                <div className="livecam-radar-core">
                  <Plane size={20} style={{ transform: "rotate(45deg)" }} />
                </div>
              </div>
              <div className="livecam-loading-title">正在扫描全球实时空域</div>
              <div className="livecam-loading-desc">同步多源 ADS-B 与在空应答器信号中...</div>

              <div className="livecam-skeleton-list" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="livecam-skeleton-row">
                    <span className="livecam-skeleton-flag" />
                    <span className="livecam-skeleton-name" style={{ width: `${52 - idx * 5}%` }} />
                    <span className="livecam-skeleton-badge" />
                  </div>
                ))}
              </div>
            </div>
          ) : countryGroups.length === 0 ? (
            <div className="livecam-empty-state">
              <div className="livecam-empty-badge">
                <Plane size={22} className="livecam-empty-icon" />
              </div>
              <div className="livecam-empty-title">未发现匹配的航班</div>
              <div className="livecam-empty-desc">请尝试调整搜索关键词或分类条件</div>
              {(searchQuery || selectedCategory !== "all") && (
                <button
                  type="button"
                  className="livecam-empty-reset-btn"
                  onClick={() => {
                    onSearchChange("");
                    onSelectCategory("all");
                  }}
                >
                  重置全部筛选
                </button>
              )}
            </div>
          ) : (
            countryGroups.map((g) => {
              const isExpanded = isSearching ? true : expandedCountries.has(g.country);

              return (
                <div key={g.country} className="livecam-country-group-item">
                  {/* 国家折叠头部 */}
                  <button
                    type="button"
                    className={`livecam-country-group-header ${isExpanded ? "is-expanded" : ""}`}
                    onClick={() => toggleCountry(g.country)}
                  >
                    <div className="livecam-country-group-title">
                      <span className={`livecam-country-flag ${g.display.isGlobe || !g.display.flagUrl ? "is-globe" : ""}`}>
                        {g.display.flagUrl && !g.display.isGlobe ? (
                          <img
                            src={g.display.flagUrl}
                            alt={g.display.zh}
                            className="livecam-country-flag-rect"
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (g.display.fallbackFlagUrl && !img.dataset.retried) {
                                img.dataset.retried = "1";
                                img.src = g.display.fallbackFlagUrl;
                                return;
                              }
                              img.style.display = "none";
                              if (img.nextSibling) {
                                img.nextSibling.style.display = "inline-flex";
                              }
                            }}
                          />
                        ) : null}
                        <span
                          className="livecam-country-globe-fallback"
                          style={{
                            display: g.display.flagUrl && !g.display.isGlobe ? "none" : "inline-flex",
                          }}
                        >
                          <Globe size={14} className="livecam-country-globe-icon" />
                        </span>
                      </span>
                      <span className="livecam-country-name-zh">{g.display.zh}</span>
                      {g.display.zh !== g.display.en && (
                        <span className="livecam-country-name-en">({g.display.en})</span>
                      )}
                    </div>
                    <div className="livecam-country-group-meta">
                      <span className="livecam-country-count-tag">{g.count.toLocaleString()} 架</span>
                      <ChevronDown
                        size={14}
                        className={`livecam-country-arrow ${isExpanded ? "is-open" : ""}`}
                      />
                    </div>
                  </button>

                  {/* 该国家下的航班列表 (展开时呈现) */}
                  {isExpanded && (
                    <div className="livecam-country-group-flights">
                      {g.flights.slice(0, 100).map((f) => {
                        const isSelected = selectedFlight?.icao24 === f.icao24;
                        const catColor =
                          f.category === "military"
                            ? "#FF3D00"
                            : f.category === "jet"
                            ? "#FF4081"
                            : f.category === "private"
                            ? "#00E676"
                            : "#00E5FF";

                        return (
                          <div
                            key={f.icao24}
                            className={`livecam-card-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => onSelectFlight(f)}
                          >
                            <div className="livecam-card-thumb-wrap" style={{ width: 38, height: 38, background: "var(--livecam-card-bg)", borderRadius: "7px" }}>
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Plane
                                  size={16}
                                  style={{
                                    color: catColor,
                                    transform: `rotate(${Math.round(f.heading || 0) - 45}deg)`,
                                    transition: "transform 0.25s ease",
                                  }}
                                />
                              </div>
                            </div>

                            <div className="livecam-card-info">
                              <div className="livecam-card-name" style={{ fontSize: "0.88rem", fontWeight: 800 }}>
                                {f.callsign || f.icao24.toUpperCase()}
                              </div>
                              <div className="livecam-card-sub">
                                <span>{f.model || "AIRCRAFT"}</span>
                                {f.registration && (
                                  <>
                                    <span style={{ opacity: 0.4 }}>·</span>
                                    <span>{f.registration}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "6px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 800, color: "var(--livecam-cyan)", fontVariantNumeric: "tabular-nums" }}>
                                {f.alt ? `${Math.round(f.alt * 3.28084).toLocaleString()} ft` : "Ground"}
                              </div>
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "var(--livecam-text-muted)",
                                  marginTop: "2px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "flex-end",
                                  gap: "3px",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <Compass size={10} />
                                <span>{Math.round(f.heading || 0)}°</span>
                                <span style={{ opacity: 0.4 }}>·</span>
                                <span>{Math.round(f.speed_knots || 0)}kt</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {g.flights.length > 100 && (
                        <div style={{ padding: "8px", textAlign: "center", fontSize: "11px", color: "var(--livecam-text-muted)" }}>
                          已显示前 100 架（共 {g.flights.length.toLocaleString()} 架）
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
