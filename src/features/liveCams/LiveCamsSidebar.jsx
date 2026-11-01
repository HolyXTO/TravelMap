// -*- coding: utf-8 -*-
/**
 * LiveCamsSidebar.jsx
 * 
 * OSIRIS 风格左侧浮层探索与检索侧栏：
 * 1. 3 档流媒体模式快捷切换：全部探头 / 实时视频流 (60FPS) / 实况快照；
 * 2. 大洲 2 行均匀分布排版（全宽对齐，无尾部空隙）；
 * 3. 按国家分组折叠/展开 (Country Accordion)，支持全部展开/收起与搜索联动；
 * 4. 探头卡片智能按国分页加载，保障数万节点极速渲染；
 * 5. 选中态自动滚入与国家自动呼出。
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Video,
  MapPin,
  Radio,
  Globe,
  SlidersHorizontal,
  FolderOpen,
  FolderClosed,
} from "lucide-react";
import { CAMERA_CONTINENTS } from "./services/cameraCatalog";

// 常用国家 Emoji 国旗速查字典
const COUNTRY_FLAGS = {
  英国: "🇬🇧",
  法国: "🇫🇷",
  德国: "🇩🇪",
  意大利: "🇮🇹",
  西班牙: "🇪🇸",
  奥地利: "🇦🇹",
  瑞典: "🇸🇪",
  芬兰: "🇫🇮",
  冰岛: "🇮🇸",
  荷兰: "🇳🇱",
  希腊: "🇬🇷",
  波兰: "🇵🇱",
  挪威: "🇳🇴",
  瑞士: "🇨🇭",
  日本: "🇯🇵",
  中国: "🇨🇳",
  美国: "🇺🇸",
  加拿大: "🇨🇦",
  澳大利亚: "🇦🇺",
  新西兰: "🇳🇿",
  巴西: "🇧🇷",
  阿根廷: "🇦🇷",
  埃及: "🇪🇬",
  南非: "🇿🇦",
  俄罗斯: "🇷🇺",
  韩国: "🇰🇷",
  新加坡: "🇸🇬",
  泰国: "🇹🇭",
  土耳其: "🇹🇷",
  爱尔兰: "🇮🇪",
  比利时: "🇧🇪",
  葡萄牙: "🇵🇹",
  立陶宛: "🇱🇹",
  塞浦路斯: "🇨🇾",
  克罗地亚: "🇭🇷",
  保加利亚: "🇧🇬",
  罗马尼亚: "🇷🇴",
  匈牙利: "🇭🇺",
  马耳他: "🇲🇹",
};

export default function LiveCamsSidebar({
  cameras,
  selectedContinent,
  onSelectContinent,
  streamFilter = "all", // 'all' | 'live' | 'snapshot'
  onSelectStreamFilter,
  totalCount,
  liveCount,
  snapshotCount,
  searchQuery,
  onSearchChange,
  selectedCameraId,
  onSelectCamera,
  isCollapsed,
  onToggleCollapse,
}) {
  // 展开的国家名称集合
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  // 每个国家已展开显示的探头数量限制（初始 20，支持该国内部分页）
  const [countryLimits, setCountryLimits] = useState({});

  // 1. 按国家对当前经过筛选的摄像头进行结构化分组
  const countryGroups = useMemo(() => {
    const map = new Map();
    for (const cam of cameras) {
      const country = cam.country || "其他地区";
      if (!map.has(country)) {
        map.set(country, {
          country,
          cameras: [],
          liveCount: 0,
        });
      }
      const g = map.get(country);
      g.cameras.push(cam);
      if (cam.hasLiveVideo) {
        g.liveCount++;
      }
    }
    // 按照探头总数倒序排列
    return Array.from(map.values()).sort((a, b) => b.cameras.length - a.cameras.length);
  }, [cameras]);

  // 2. 搜索关键词触发时，自动展开所有包含搜索结果的国家
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedCountries(new Set(countryGroups.map((g) => g.country)));
    }
  }, [searchQuery, countryGroups]);

  // 3. 当大洲切换时，智能初始化展开状态
  useEffect(() => {
    if (countryGroups.length <= 2) {
      // 仅有 1~2 个国家时，默认全部展开
      setExpandedCountries(new Set(countryGroups.map((g) => g.country)));
    } else if (countryGroups.length > 0) {
      // 多个国家（例如欧洲有 30 多个国家）时，默认展开第一个，保持列表整洁且便于快速点击法国/德国等
      setExpandedCountries(new Set([countryGroups[0].country]));
    } else {
      setExpandedCountries(new Set());
    }
    // 重置每个国家的分页限制
    setCountryLimits({});
  }, [selectedContinent]);

  // 4. 从地图点击选中特定探头时，自动展开该探头所属国家
  useEffect(() => {
    if (!selectedCameraId || !cameras) return;
    const target = cameras.find((c) => String(c.id) === String(selectedCameraId));
    if (target?.country) {
      setExpandedCountries((prev) => {
        if (prev.has(target.country)) return prev;
        const next = new Set(prev);
        next.add(target.country);
        return next;
      });
    }
  }, [selectedCameraId, cameras]);

  // 切换单个国家的展开/折叠
  const handleToggleCountry = (countryName) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryName)) {
        next.delete(countryName);
      } else {
        next.add(countryName);
      }
      return next;
    });
  };

  // 一键全部展开 / 全部收起
  const isAllExpanded = countryGroups.length > 0 && expandedCountries.size === countryGroups.length;
  const handleToggleAllCountries = () => {
    if (isAllExpanded) {
      setExpandedCountries(new Set());
    } else {
      setExpandedCountries(new Set(countryGroups.map((g) => g.country)));
    }
  };

  // 该国家加载更多探头
  const handleLoadMoreForCountry = (countryName, maxTotal) => {
    setCountryLimits((prev) => ({
      ...prev,
      [countryName]: Math.min((prev[countryName] || 20) + 20, maxTotal),
    }));
  };

  return (
    <>
      {/* 折叠时显示的小浮标按钮 */}
      {isCollapsed && (
        <button
          type="button"
          className="livecam-sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title="展开全球摄像头列表"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* 主面板 */}
      <div className={`livecam-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
        {/* 顶部标题与折叠 */}
        <div className="livecam-sidebar-header">
          <div className="livecam-sidebar-title-group">
            <Video size={16} color="#00e5ff" />
            <span className="livecam-sidebar-title">全球实时监控</span>
            <span className="livecam-sidebar-count-badge">
              {cameras.length.toLocaleString()} 探头
            </span>
          </div>
          <button
            type="button"
            className="livecam-icon-btn"
            onClick={onToggleCollapse}
            title="收起侧栏"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* 关键词搜索 */}
        <div className="livecam-search-box">
          <Search size={15} className="livecam-search-icon" />
          <input
            type="text"
            className="livecam-search-input"
            placeholder="搜索全球城市、国家或探头名称..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* 多维复合筛选栏 */}
        <div className="livecam-filter-panel">
          {/* 3 档流媒体模式快捷切换栏 (替代原来的单独开关 + 移除了多余的全球角标) */}
          <div className="livecam-stream-type-grid">
            <button
              type="button"
              className={`livecam-stream-type-btn ${streamFilter === "all" ? "is-active" : ""}`}
              onClick={() => onSelectStreamFilter?.("all")}
              title="查看当前区域全部公开探头"
            >
              <span className="livecam-stream-btn-text">全部探头</span>
              <span className="livecam-stream-btn-badge">
                {(totalCount ?? cameras.length).toLocaleString()}
              </span>
            </button>

            <button
              type="button"
              className={`livecam-stream-type-btn ${streamFilter === "live" ? "is-active" : ""}`}
              onClick={() => onSelectStreamFilter?.("live")}
              title="仅看 24/7 高清连续实时视频流"
            >
              <span className="livecam-stream-btn-text">实时视频流</span>
              <span className="livecam-stream-btn-badge is-live">
                {(liveCount ?? 0).toLocaleString()}
              </span>
            </button>

            <button
              type="button"
              className={`livecam-stream-type-btn ${streamFilter === "snapshot" ? "is-active" : ""}`}
              onClick={() => onSelectStreamFilter?.("snapshot")}
              title="查看道路实况图像快照节点"
            >
              <span className="livecam-stream-btn-text">实况快照</span>
              <span className="livecam-stream-btn-badge">
                {(snapshotCount ?? 0).toLocaleString()}
              </span>
            </button>
          </div>

          {/* 大洲分类 2 行全宽均匀网格（无空白空隙） */}
          <div className="livecam-continents-grid">
            {CAMERA_CONTINENTS.map((cont) => {
              const isActive = selectedContinent === cont.id;
              const isRow1 = cont.row === 1;
              return (
                <button
                  key={cont.id}
                  type="button"
                  className={`livecam-cont-pill ${isRow1 ? "row-1" : "row-2"} ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelectContinent(cont.id)}
                  title={`查看 ${cont.label} 探头分布`}
                >
                  {cont.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 列表头部操作摘要栏：支持一键全部展开/折叠 */}
        <div className="livecam-group-summary-bar">
          <span className="livecam-group-summary-text">
            覆盖 {countryGroups.length} 个国家 · {cameras.length.toLocaleString()} 探头
          </span>
          {countryGroups.length > 1 && (
            <button
              type="button"
              className="livecam-group-expand-toggle-btn"
              onClick={handleToggleAllCountries}
              title={isAllExpanded ? "折叠全部国家" : "展开全部国家"}
            >
              {isAllExpanded ? <FolderClosed size={12} /> : <FolderOpen size={12} />}
              <span>{isAllExpanded ? "全部收起" : "全部展开"}</span>
            </button>
          )}
        </div>

        {/* 摄像头列表主体：按国家手风琴 (Accordion) 折叠/展开呈现 */}
        <div className="livecam-list-body">
          {countryGroups.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--livecam-text-muted)", fontSize: "0.82rem" }}>
              未找到匹配的全球监控探头
            </div>
          ) : (
            countryGroups.map((g) => {
              const isExpanded = expandedCountries.has(g.country);
              const limit = countryLimits[g.country] || 20;
              const visibleList = g.cameras.slice(0, limit);

              return (
                <div key={g.country} className="livecam-country-group">
                  {/* 国家折叠栏 Header */}
                  <div
                    className={`livecam-country-header ${isExpanded ? "is-expanded" : ""}`}
                    onClick={() => handleToggleCountry(g.country)}
                  >
                    <div className="livecam-country-title-box">
                      <span className="livecam-country-chevron">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="livecam-country-flag">
                        <img
                          src={`${import.meta.env.BASE_URL}flags/circle-195/${encodeURIComponent(g.country)}.png`}
                          alt={g.country}
                          className="livecam-country-flag-img"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </span>
                      <span className="livecam-country-name">{g.country}</span>
                    </div>

                    <div className="livecam-country-badges">
                      {g.liveCount > 0 && (
                        <span className="livecam-country-live-badge" title={`${g.liveCount} 个实时视频流`}>
                          <Video size={10} />
                          <span>{g.liveCount}</span>
                        </span>
                      )}
                      <span className="livecam-country-count-badge" title={`${g.cameras.length} 个探头`}>
                        {g.cameras.length}
                      </span>
                    </div>
                  </div>

                  {/* 该国家展开的摄像头卡片列表 */}
                  {isExpanded && (
                    <div className="livecam-country-cards-wrap">
                      {visibleList.map((cam) => {
                        const isSelected = String(selectedCameraId) === String(cam.id);
                        const isVideo = Boolean(cam.hasLiveVideo);
                        const poster =
                          cam.media?.posterUrl ||
                          "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=300";

                        return (
                          <div
                            key={cam.id}
                            className={`livecam-card-item ${isSelected ? "is-selected" : ""}`}
                            onClick={() => onSelectCamera(cam)}
                          >
                            <div className="livecam-card-thumb-wrap">
                              <img
                                src={poster}
                                alt={cam.name}
                                className="livecam-card-thumb"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                onError={(e) => {
                                  e.target.src =
                                    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300";
                                }}
                              />
                              <div className={`livecam-card-live-dot ${isVideo ? "is-video" : ""}`} />
                            </div>

                            <div className="livecam-card-info">
                              <div className="livecam-card-name" title={cam.name}>
                                {cam.name}
                              </div>

                              <div className="livecam-card-sub">
                                <MapPin size={11} />
                                <span>{cam.country} · {cam.city}</span>
                                {isVideo ? (
                                  <span className="livecam-card-video-tag">60FPS LIVE</span>
                                ) : (
                                  <span className="livecam-card-snapshot-tag">快照节点</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* 该国内部加载更多 */}
                      {g.cameras.length > limit && (
                        <div style={{ padding: "6px 8px 10px 8px" }}>
                          <button
                            type="button"
                            className="livecam-country-loadmore-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadMoreForCountry(g.country, g.cameras.length);
                            }}
                          >
                            展开更多 {g.country} 探头 (+20 / 剩余 {g.cameras.length - limit})
                          </button>
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
