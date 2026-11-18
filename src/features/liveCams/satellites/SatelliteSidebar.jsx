// -*- coding: utf-8 -*-
/**
 * SatelliteSidebar.jsx
 *
 * 全球实时卫星左侧探索与多维筛选侧栏（布局与全球实时摄像头/全球实时航班完全对齐）：
 * 1. 7 档卫星类别过滤（全部 / 通信卫星 / 导航卫星 / 观测气象 / 空间站与科学 / 军事与政府 / 未分类）；
 * 2. 搜索联动（卫星名称、NORAD 编号、COSPAR 编号、所属国家中英文）；
 * 3. 按所属国家 / 国际组织分组折叠列表（CelesTrak SATCAT OWNER），默认全部收起，检索时自动展开；
 * 4. 单国内部支持渐进式分页加载，万级在轨目标切换丝滑流畅。
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  Satellite,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Globe,
} from "lucide-react";
import {
  SATELLITE_CATEGORIES,
  getCategoryMeta,
} from "../utils/satelliteClassification";
import { getSatelliteCountryDisplay } from "../utils/satelliteOwners";

const COUNTRY_PAGE_SIZE = 60;

export default function SatelliteSidebar({
  catalog,
  isLoading,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  filteredSatellites,
  selectedNoradId,
  onSelectSatellite,
  isCollapsed,
  onToggleCollapse,
  onRefresh,
  isLightTheme = false,
}) {
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [countryLimits, setCountryLimits] = useState({});

  // 切换大类或刷新目录时重置单国展开条数
  useEffect(() => {
    setCountryLimits({});
  }, [selectedCategory, searchQuery]);

  const counts = catalog?.counts || {
    all: 0,
    comms: 0,
    navigation: 0,
    earth_obs: 0,
    science: 0,
    military: 0,
    other: 0,
  };

  const totalCatalog = catalog?.totalCount || 0;
  const isInitialLoading = Boolean(isLoading && totalCatalog === 0);

  // 按所属国家/国际组织分组（按数量降序排列，未标明归属置于末尾）
  const countryGroups = useMemo(() => {
    const map = new Map();
    for (const sat of filteredSatellites) {
      const key = sat.countryKey || "__ORG_TBD";
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(sat);
    }

    return Array.from(map.entries())
      .map(([countryKey, list]) => {
        const display = getSatelliteCountryDisplay(countryKey);
        return {
          countryKey,
          display,
          satellites: list,
          count: list.length,
        };
      })
      .sort((a, b) => {
        if (a.countryKey === "__ORG_TBD" && b.countryKey !== "__ORG_TBD") return 1;
        if (b.countryKey === "__ORG_TBD" && a.countryKey !== "__ORG_TBD") return -1;
        return b.count - a.count;
      });
  }, [filteredSatellites]);

  const toggleCountry = (countryKey) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryKey)) {
        next.delete(countryKey);
      } else {
        next.add(countryKey);
      }
      return next;
    });
  };

  const toggleAllCountries = () => {
    if (expandedCountries.size > 0) {
      setExpandedCountries(new Set());
    } else {
      setExpandedCountries(new Set(countryGroups.map((g) => g.countryKey)));
    }
  };

  const loadMoreInCountry = (countryKey) => {
    setCountryLimits((prev) => ({
      ...prev,
      [countryKey]: (prev[countryKey] || COUNTRY_PAGE_SIZE) + 100,
    }));
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      {isCollapsed && (
        <button
          type="button"
          className="livecam-sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title="展开实时卫星列表"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <div className={`livecam-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
        {/* 顶部标题与折叠（与摄像头/航班侧栏风格完全一致） */}
        <div className="livecam-sidebar-header">
          <div className="livecam-sidebar-title-group">
            <Satellite size={16} color="#00e5ff" />
            <span className="livecam-sidebar-title">全球实时卫星</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              className="livecam-icon-btn"
              onClick={onRefresh}
              title="刷新卫星轨道目录"
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

        {/* 关键词搜索 */}
        <div className="livecam-search-box">
          <Search size={14} className="livecam-search-icon" />
          <input
            type="text"
            className="livecam-search-input"
            placeholder="搜索卫星名、NORAD编号或国家..."
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

        {/* 多维类别筛选栏 */}
        <div className="livecam-filter-panel" style={{ paddingBottom: "10px" }}>
          <div className="livecam-sat-cat-grid">
            {SATELLITE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const catCount = counts[cat.id] || 0;
              const dotColor = isLightTheme ? cat.lightColor : cat.color;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`livecam-sat-cat-btn ${isActive ? "is-active" : ""}`}
                  style={{ "--sat-cat-color": dotColor }}
                  onClick={() => onSelectCategory(cat.id)}
                  title={`${cat.fullLabel} (${catCount.toLocaleString()} 颗)`}
                >
                  <span className="livecam-sat-cat-top">
                    <span
                      className="livecam-sat-cat-dot"
                      style={{ background: dotColor }}
                    />
                    <span className="livecam-sat-cat-label">{cat.label}</span>
                  </span>
                  <span className="livecam-sat-cat-count">
                    {isInitialLoading ? "—" : catCount.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 列表头部摘要栏：国家数、卫星总数与全部展开/收起 */}
        <div
          className="livecam-group-summary-bar"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span
            className="livecam-group-summary-text"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {isInitialLoading ? (
              <>
                <span className="livecam-radar-status-dot" />
                <span>正在同步全球轨道卫星目录...</span>
              </>
            ) : (
              `${countryGroups.length} 个国家/组织 · ${filteredSatellites.length.toLocaleString()} 颗卫星`
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

        {/* 按国家分组手风琴列表（默认全部收起） */}
        <div className="livecam-sidebar-list">
          {isInitialLoading ? (
            <div className="livecam-sat-empty">
              <RotateCw size={18} className="animate-spin" />
              <span>正在初始化 SGP4 轨道引擎...</span>
            </div>
          ) : countryGroups.length === 0 ? (
            <div className="livecam-empty-state">
              <div className="livecam-empty-badge">
                <Satellite size={22} className="livecam-empty-icon" />
              </div>
              <div className="livecam-empty-title">未发现匹配的卫星目标</div>
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
            countryGroups.map((g, gIdx) => {
              const isExpanded = isSearching ? true : expandedCountries.has(g.countryKey);
              const limit = countryLimits[g.countryKey] || COUNTRY_PAGE_SIZE;
              const shownSats = isExpanded ? g.satellites.slice(0, limit) : [];
              const remaining = g.satellites.length - shownSats.length;

              return (
                <div key={g.countryKey} className="livecam-country-group-item">
                  {/* 国家折叠头部 */}
                  <button
                    type="button"
                    className={`livecam-country-group-header ${isExpanded ? "is-expanded" : ""}`}
                    onClick={() => toggleCountry(g.countryKey)}
                  >
                    <div className="livecam-country-group-title">
                      <span className={`livecam-country-rank ${gIdx < 3 ? "is-top" : ""}`}>
                        {String(gIdx + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`livecam-country-flag ${
                          g.display.isGlobe || !g.display.flagUrl ? "is-globe" : ""
                        }`}
                      >
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
                            display:
                              g.display.flagUrl && !g.display.isGlobe ? "none" : "inline-flex",
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
                      <span className="livecam-country-count-tag">
                        {g.count.toLocaleString()} 颗
                      </span>
                      <ChevronDown
                        size={14}
                        className={`livecam-country-arrow ${isExpanded ? "is-open" : ""}`}
                      />
                    </div>
                  </button>

                  {/* 该国家下的卫星列表 */}
                  {isExpanded && (
                    <div className="livecam-country-group-flights">
                      {shownSats.map((sat) => {
                        const isSelected = sat.noradId === selectedNoradId;
                        const meta = getCategoryMeta(sat.category, isLightTheme);

                        return (
                          <button
                            key={sat.noradId}
                            type="button"
                            className={`livecam-sat-item ${isSelected ? "is-active" : ""}`}
                            onClick={() => onSelectSatellite(sat)}
                          >
                            <div className="livecam-sat-item-main">
                              <span
                                className="livecam-sat-item-dot"
                                style={{
                                  background: meta.displayColor,
                                  color: meta.displayColor,
                                }}
                              />
                              <span className="livecam-sat-item-name" title={sat.name}>
                                {sat.name}
                              </span>
                              <span className="livecam-sat-item-norad">
                                #{sat.noradId}
                              </span>
                            </div>
                            <div className="livecam-sat-item-meta">
                              <span
                                className="livecam-sat-item-cat"
                                style={{ color: meta.displayColor }}
                              >
                                {meta.label}
                              </span>
                              {sat.objectId && (
                                <>
                                  <span className="livecam-sat-item-sep">·</span>
                                  <span className="livecam-sat-item-cospar">{sat.objectId}</span>
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {remaining > 0 && (
                        <button
                          type="button"
                          className="livecam-sat-loadmore-btn"
                          onClick={() => loadMoreInCountry(g.countryKey)}
                        >
                          再显示 {Math.min(100, remaining)} 颗（剩余 {remaining.toLocaleString()} 颗）
                        </button>
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
