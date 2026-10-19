import React, { useState, useRef, useEffect } from "react";
import {
  Map as MapIcon,
  Sparkles,
  BarChart3,
  Globe2,
  BookOpen,
  Star,
  Gamepad2,
  ChevronRight,
  Compass,
  Plane,
  Eye,
  Flag,
  Pin,
  PinOff,
} from "lucide-react";

export default function LeftSidebarNav({
  scrollToPageSection,
  activeGameTab = "fill",
  setActiveGameTab,
}) {
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem("travel_sidebar_pinned") === "true";
    } catch {
      return false;
    }
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const leaveTimerRef = useRef(null);

  const togglePin = (e) => {
    e.stopPropagation();
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("travel_sidebar_pinned", String(next));
      } catch (err) {
        console.warn(err);
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const handleWrapperMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleWrapperMouseLeave = () => {
    if (!isPinned) {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 240);
    }
  };

  const handleItemClick = (action) => {
    if (action) action();
    if (!isPinned) {
      setIsExpanded(false);
    }
  };

  const menuItems = [
    {
      id: "map",
      title: "地图",
      enTitle: "Map View",
      icon: MapIcon,
      accentColor: "#2563eb",
      bgColor: "#eff6ff",
      action: () => scrollToPageSection("map-section"),
      submenus: [
        {
          id: "map-all",
          title: "查看地图全貌",
          icon: Eye,
          action: () => scrollToPageSection("map-section"),
        },
        {
          id: "map-extremes",
          title: "四极之最",
          icon: Compass,
          action: () => scrollToPageSection("extremes-section"),
        },
      ],
    },
    {
      id: "gallery",
      title: "图鉴",
      enTitle: "Galleries",
      icon: Sparkles,
      accentColor: "#db2777",
      bgColor: "#fdf2f8",
      action: () => scrollToPageSection("country-gallery-section"),
      submenus: [
        {
          id: "gallery-country",
          title: "国家图鉴",
          icon: Globe2,
          action: () => scrollToPageSection("country-gallery-section"),
        },
        {
          id: "gallery-province",
          title: "省份图鉴",
          icon: Flag,
          action: () => scrollToPageSection("province-gallery-section"),
        },
      ],
    },
    {
      id: "stats",
      title: "统计数据",
      enTitle: "Statistics",
      icon: BarChart3,
      accentColor: "#059669",
      bgColor: "#ecfdf5",
      action: () => scrollToPageSection("overview-section"),
      submenus: null, // 单一二级功能已合并，不显示二级功能
    },
    {
      id: "visuals",
      title: "足迹可视化",
      enTitle: "Visual Journey",
      icon: Globe2,
      accentColor: "#7c3aed",
      bgColor: "#f5f3ff",
      action: () => scrollToPageSection("visual-journey-section"),
      submenus: [
        {
          id: "vis-globe",
          title: "3D 球形足迹",
          icon: Globe2,
          action: () => scrollToPageSection("spherical-globe-section"),
        },
        {
          id: "vis-matrix",
          title: "点阵世界轨迹",
          icon: Sparkles,
          action: () => scrollToPageSection("dot-matrix-section"),
        },
        {
          id: "vis-timeline",
          title: "时空旅程时间线",
          icon: Plane,
          action: () => scrollToPageSection("journey-timeline-section"),
        },
      ],
    },
    {
      id: "notes",
      title: "旅行记录",
      enTitle: "Travel Notes",
      icon: BookOpen,
      accentColor: "#d97706",
      bgColor: "#fffbeb",
      action: () => scrollToPageSection("travel-notes-section"),
      submenus: null,
    },
    {
      id: "ratings",
      title: "评分",
      enTitle: "Ratings",
      icon: Star,
      accentColor: "#eab308",
      bgColor: "#fefce8",
      action: () => scrollToPageSection("travel-ratings-section"),
      submenus: null,
    },
    {
      id: "game",
      title: "地图游戏",
      enTitle: "Geo Games",
      icon: Gamepad2,
      accentColor: "#0891b2",
      bgColor: "#ecfeff",
      action: () => scrollToPageSection("travel-game-section"),
      submenus: [
        {
          id: "game-fill",
          title: "地图盲填",
          icon: MapIcon,
          isActive: activeGameTab === "fill",
          action: () => {
            if (setActiveGameTab) setActiveGameTab("fill");
            scrollToPageSection("travel-game-section");
          },
        },
        {
          id: "game-guess",
          title: "实景图寻",
          icon: Compass,
          isActive: activeGameTab === "guess",
          action: () => {
            if (setActiveGameTab) setActiveGameTab("guess");
            scrollToPageSection("travel-game-section");
          },
        },
      ],
    },
  ];

  const isCurrentlyExpanded = isPinned || isExpanded;

  return (
    <aside
      className={`left-sidebar-wrapper ${
        isCurrentlyExpanded ? "sidebar-expanded" : "sidebar-collapsed"
      } ${isPinned ? "sidebar-pinned" : ""}`}
      onMouseEnter={handleWrapperMouseEnter}
      onMouseLeave={handleWrapperMouseLeave}
      aria-label="左侧快捷导航功能栏"
    >
      {/* 边缘微型指示标签 */}
      <div
        className="left-sidebar-peek-tab"
        title="鼠标滑入展开快捷导航"
        onClick={handleWrapperMouseEnter}
      >
        <span className="peek-tab-indicator-bar" />
        <span className="peek-tab-dot" />
        <ChevronRight size={14} className="peek-tab-arrow" />
      </div>

      {/* 滑出式侧边功能栏主卡片（宽度收窄、二级功能直接在下方排列） */}
      <nav className="left-sidebar-drawer">
        {/* 顶部标题区 */}
        <div className="left-sidebar-header">
          <div className="sidebar-brand-row">
            <div className="sidebar-brand-left">
              <span className="sidebar-brand-gem" />
              <span className="sidebar-brand-title">功能导航</span>
            </div>
            <button
              type="button"
              className={`sidebar-pin-btn ${isPinned ? "is-pinned" : ""}`}
              onClick={togglePin}
              title={isPinned ? "取消固定功能导航栏" : "固定功能导航栏"}
              aria-label={isPinned ? "取消固定功能导航栏" : "固定功能导航栏"}
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              <span className="pin-btn-text">{isPinned ? "已固定" : "固定"}</span>
            </button>
          </div>
          <span className="sidebar-brand-subtitle">TRAVELMAP SHORTCUTS</span>
        </div>

        {/* 菜单列表 */}
        <ul className="left-sidebar-menu">
          {menuItems.map((item) => {
            const ItemIcon = item.icon;
            const hasSubmenu = item.submenus && item.submenus.length > 0;

            return (
              <li key={item.id} className="nav-group-item">
                {/* 一级功能标题行 */}
                <div
                  className="nav-primary-row"
                  onClick={() => handleItemClick(item.action)}
                >
                  <span
                    className="nav-primary-icon-box"
                    style={{
                      color: item.accentColor,
                      backgroundColor: item.bgColor,
                    }}
                  >
                    <ItemIcon size={18} />
                  </span>
                  <div className="nav-primary-text-group">
                    <span className="nav-primary-title">{item.title}</span>
                    <span className="nav-primary-en-title">{item.enTitle}</span>
                  </div>
                </div>

                {/* 二级功能列表：直接在一级功能下方展示（带层级树线与区分样式） */}
                {hasSubmenu && (
                  <div className="nav-secondary-list">
                    {item.submenus.map((sub, sIdx) => {
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id || sIdx}
                          type="button"
                          className={`nav-secondary-btn ${
                            sub.isActive ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(sub.action);
                          }}
                        >
                          <span className="nav-secondary-bullet" />
                          {SubIcon && (
                            <SubIcon size={14} className="nav-secondary-icon" />
                          )}
                          <span className="nav-secondary-title">{sub.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
