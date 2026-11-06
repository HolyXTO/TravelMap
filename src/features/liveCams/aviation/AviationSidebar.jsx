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
  ChevronLeft,
  ChevronRight,
  Plane,
  RotateCw,
  Compass,
} from "lucide-react";

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
  const [displayLimit, setDisplayLimit] = useState(60);

  const counts = flightsData?.counts || {
    total: 0,
    commercial: 0,
    private: 0,
    jets: 0,
    military: 0,
  };

  const allList = flightsData?.all || [];

  // 根据当前选中类别与搜索词复合过滤
  const filteredFlights = useMemo(() => {
    let list = allList;

    if (selectedCategory && selectedCategory !== "all") {
      list = list.filter((f) => f.category === selectedCategory);
    }

    const q = (searchQuery || "").trim().toLowerCase();
    if (q) {
      list = list.filter((f) => {
        return (
          (f.callsign && f.callsign.toLowerCase().includes(q)) ||
          (f.icao24 && f.icao24.toLowerCase().includes(q)) ||
          (f.model && f.model.toLowerCase().includes(q)) ||
          (f.country && f.country.toLowerCase().includes(q)) ||
          (f.registration && f.registration.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [allList, selectedCategory, searchQuery]);

  const displayedList = useMemo(() => {
    return filteredFlights.slice(0, displayLimit);
  }, [filteredFlights, displayLimit]);

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
            <span className="livecam-sidebar-count-badge">
              {(counts.total || allList.length).toLocaleString()} 航班
            </span>
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

        {/* 关键词搜索 */}
        <div className="livecam-search-box">
          <Search size={15} className="livecam-search-icon" />
          <input
            type="text"
            className="livecam-search-input"
            placeholder="搜索航班号 (如 CCA1234)、机型、国家..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
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
                  title={`筛选${item.label} (${countVal.toLocaleString()} 架)`}
                >
                  <span className="livecam-flight-cat-label">{item.label}</span>
                  <span
                    className="livecam-flight-cat-count"
                    style={{ color: isActive ? "#ffffff" : item.color }}
                  >
                    {countVal.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 列表头部操作摘要栏 */}
        <div className="livecam-group-summary-bar">
          <span className="livecam-group-summary-text">
            匹配 {filteredFlights.length.toLocaleString()} 架在航飞行器
          </span>
        </div>

        {/* 航班卡片列表 */}
        <div className="livecam-sidebar-list">
          {displayedList.length === 0 ? (
            <div className="livecam-empty-state">
              <Plane size={28} className="livecam-empty-icon" />
              <div className="livecam-empty-title">未发现匹配的航班</div>
              <div className="livecam-empty-desc">请尝试调整搜索关键词或分类条件</div>
            </div>
          ) : (
            displayedList.map((f) => {
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
                  <div className="livecam-card-thumb-wrap" style={{ width: 42, height: 42, background: "var(--livecam-card-bg)", borderRadius: "8px" }}>
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
                        size={18}
                        style={{
                          color: catColor,
                          transform: `rotate(${Math.round(f.heading || 0) - 45}deg)`,
                          transition: "transform 0.25s ease",
                        }}
                      />
                    </div>
                  </div>

                  <div className="livecam-card-info">
                    <div className="livecam-card-name" style={{ fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.3px" }}>
                      {f.callsign || f.icao24.toUpperCase()}
                    </div>
                    <div className="livecam-card-sub">
                      <span>{f.model || "AIRCRAFT"}</span>
                      {f.country && (
                        <>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span>{f.country}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "8px" }}>
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
            })
          )}

          {/* 分页加载更多按钮 */}
          {filteredFlights.length > displayLimit && (
            <div style={{ padding: "12px", textAlign: "center" }}>
              <button
                type="button"
                className="livecam-country-load-more-btn"
                onClick={() => setDisplayLimit((prev) => prev + 60)}
              >
                加载更多航空器 ({displayedList.length} / {filteredFlights.length.toLocaleString()})
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
