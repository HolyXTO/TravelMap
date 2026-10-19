import React, { useState, useRef, useEffect } from "react";
import {
  Map as MapIcon,
  Sparkles,
  BarChart3,
  Globe2,
  BookOpen,
  Star,
  Gamepad2,
  Palette,
  ChevronRight,
  Compass,
  Layers3,
  MapPinned,
  Check,
  Plane,
  Eye,
  Flag,
} from "lucide-react";

export default function LeftSidebarNav({
  scrollToPageSection,
  activeLevel,
  changeLevel,
  activeProfile,
  setActiveProfile,
  activeMapThemeId,
  setActiveMapThemeId,
  themes = [],
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const drawerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const switchTimerRef = useRef(null);
  const mouseHistoryRef = useRef([]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    const now = Date.now();
    const history = mouseHistoryRef.current;
    history.push({ x: e.clientX, y: e.clientY, time: now });
    // 保留最近 250ms 内的鼠标轨迹点（最多 8 个）
    while (history.length > 8 || (history.length > 0 && now - history[0].time > 250)) {
      history.shift();
    }
  };

  /**
   * 经典斜向移动检测算法（Amazon Mega Menu 意图预判）：
   * 判断用户鼠标当前是否正在沿着斜向夹角朝着当前展开的二级子菜单方向滑动。
   * 如果是，则为用户开辟“斜向安全保护期”，阻止划过其他主菜单项时发生误触关闭。
   */
  const checkIsAimingAtSubmenu = () => {
    if (!activeMenuId || !drawerRef.current) return false;

    // 查找当前已展开的二级子菜单 DOM 元素
    const activeFlyout = drawerRef.current.querySelector(
      `.left-menu-item[data-id="${activeMenuId}"] .left-submenu-flyout`
    );
    if (!activeFlyout) return false;

    const rect = activeFlyout.getBoundingClientRect();
    const history = mouseHistoryRef.current;
    if (history.length < 2) return false;

    const current = history[history.length - 1];
    // 寻找至少 20ms 前的点以计算较为稳定的移动速度向量
    let prev = history[0];
    for (let i = history.length - 2; i >= 0; i--) {
      if (current.time - history[i].time >= 20) {
        prev = history[i];
        break;
      }
    }

    const dx = current.x - prev.x;
    const dy = current.y - prev.y;

    // 若鼠标并非向右（向二级子菜单方向）位移，则判定为没有朝子菜单滑去
    if (dx <= 0.5) return false;

    // 若鼠标已在子菜单右侧或已进入子菜单
    if (current.x >= rect.left) return false;

    // 计算从当前鼠标位置到当前子菜单上/下顶点的斜率夹角（预留 32px 的安全冗余边缘）
    const topCornerY = rect.top - 32;
    const bottomCornerY = rect.bottom + 32;
    const deltaXToFlyout = rect.left - current.x;

    const slopeTop = (topCornerY - current.y) / deltaXToFlyout;
    const slopeBottom = (bottomCornerY - current.y) / deltaXToFlyout;
    const mouseSlope = dy / dx;

    const minSlope = Math.min(slopeTop, slopeBottom) - 0.25;
    const maxSlope = Math.max(slopeTop, slopeBottom) + 0.25;

    // 鼠标位移矢量正对着二级菜单的几何投影扇形区域
    if (mouseSlope >= minSlope && mouseSlope <= maxSlope) {
      return true;
    }

    // 辅助启发：鼠标向右快速划动，且 Y 坐标大致处于子菜单高度区间附近
    if (dx >= 2 && current.y >= rect.top - 60 && current.y <= rect.bottom + 60) {
      return true;
    }

    return false;
  };

  const handleItemMouseEnter = (item) => {
    // 首次滑入：立即弹出
    if (!activeMenuId) {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }
      setActiveMenuId(item.id);
      return;
    }

    // 已是当前活跃菜单项，保持现状
    if (activeMenuId === item.id) {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }
      return;
    }

    // 当前有另一个子菜单展开中，检测是否正在朝该子菜单斜向滑动
    const isAiming = checkIsAimingAtSubmenu();

    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }

    if (isAiming) {
      // 关键！用户正以对角线方向划向子菜单：开启 300ms 保护期，中途途径任何其他主项都不关闭目标子菜单！
      switchTimerRef.current = setTimeout(() => {
        setActiveMenuId(item.id);
        switchTimerRef.current = null;
      }, 300);
    } else {
      // 用户正在垂直浏览主菜单项，40ms 极速响应切换，丝滑毫无粘滞感
      switchTimerRef.current = setTimeout(() => {
        setActiveMenuId(item.id);
        switchTimerRef.current = null;
      }, 40);
    }
  };

  const handleFlyoutMouseEnter = () => {
    // 鼠标成功进入二级子功能面板！立即取消切换倒计时，锁定当前子面板
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = setTimeout(() => {
      setIsExpanded(false);
      setActiveMenuId(null);
    }, 350);
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
          title: "查看地图全貌",
          desc: "平滑滚动至主地图全景",
          icon: Eye,
          action: () => scrollToPageSection("map-section"),
        },
        {
          title: "国家层级维度",
          desc: "按国家聚合足迹与点亮高光",
          icon: Globe2,
          isActive: activeLevel === "country",
          action: () => {
            changeLevel("country");
            scrollToPageSection("map-section");
          },
        },
        {
          title: "省份层级维度",
          desc: "按中国省级行政区展开",
          icon: Layers3,
          isActive: activeLevel === "region",
          action: () => {
            changeLevel("region");
            scrollToPageSection("map-section");
          },
        },
        {
          title: "城市层级维度",
          desc: "精细至地级市及海外城市",
          icon: MapPinned,
          isActive: activeLevel === "city",
          action: () => {
            changeLevel("city");
            scrollToPageSection("map-section");
          },
        },
        {
          title: "足迹四极之最",
          desc: "双人极东、极西、极南、极北坐标点",
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
          title: "国家图鉴",
          desc: "各大洲国家徽章与旅行记忆",
          icon: Globe2,
          action: () => scrollToPageSection("country-gallery-section"),
        },
        {
          title: "省份图鉴",
          desc: "中国各省级行政区探索画册",
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
      submenus: [
        {
          title: "统计数据看板",
          desc: "到访国家、省份城市统计与排行榜",
          icon: BarChart3,
          action: () => scrollToPageSection("overview-section"),
        },
      ],
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
          title: "3D 球形足迹",
          desc: "三维立体地球互动流光航线",
          icon: Globe2,
          action: () => scrollToPageSection("spherical-globe-section"),
        },
        {
          title: "点阵世界轨迹",
          desc: "粒子流光世界地图打卡点阵",
          icon: Sparkles,
          action: () => scrollToPageSection("dot-matrix-section"),
        },
        {
          title: "时空旅程时间线",
          desc: "按年份时间轴沉浸回溯足迹",
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
      submenus: [
        {
          title: "全部游记卡片",
          desc: "旅途图文手记相册与详细路线",
          icon: BookOpen,
          action: () => scrollToPageSection("travel-notes-section"),
        },
      ],
    },
    {
      id: "ratings",
      title: "评分",
      enTitle: "Ratings",
      icon: Star,
      accentColor: "#eab308",
      bgColor: "#fefce8",
      action: () => scrollToPageSection("travel-ratings-section"),
      submenus: [
        {
          title: "旅行心愿与评价榜",
          desc: "打卡城市打分评级与心愿单",
          icon: Star,
          action: () => scrollToPageSection("travel-ratings-section"),
        },
      ],
    },
    {
      id: "game",
      title: "小游戏",
      enTitle: "GeoGuessr",
      icon: Gamepad2,
      accentColor: "#0891b2",
      bgColor: "#ecfeff",
      action: () => scrollToPageSection("travel-game-section"),
      submenus: [
        {
          title: "开始图寻挑战",
          desc: "实景旅拍插旗测距经纬探索",
          icon: Gamepad2,
          action: () => scrollToPageSection("travel-game-section"),
        },
      ],
    },
    {
      id: "themes",
      title: "地图主题",
      enTitle: "Themes",
      icon: Palette,
      accentColor: "#9333ea",
      bgColor: "#faf5ff",
      action: () => {},
      submenus: (themes || []).map((t) => ({
        id: t.id,
        title: t.label,
        desc: t.category || "地图风格渲染",
        swatches: t.swatches || [t.background || "#222", t.visitedFill || "#4f46e5"],
        isActive: activeMapThemeId === t.id,
        action: () => setActiveMapThemeId(t.id),
      })),
    },
  ];

  return (
    <aside
      className={`left-sidebar-wrapper ${isExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      aria-label="左侧快捷导航功能栏"
    >
      {/* 边缘微型指示标签（未写文字，仅使用高质感极简手柄条，大幅增高） */}
      <div className="left-sidebar-peek-tab" title="鼠标滑入展开快捷导航">
        <span className="peek-tab-indicator-bar" />
        <span className="peek-tab-dot" />
        <ChevronRight size={15} className="peek-tab-arrow" />
      </div>

      {/* 滑出式侧边功能栏主卡片 */}
      <nav className="left-sidebar-drawer" ref={drawerRef}>
        {/* 顶部标题区 */}
        <div className="left-sidebar-header">
          <div className="sidebar-brand-row">
            <span className="sidebar-brand-gem" />
            <span className="sidebar-brand-title">功能导航</span>
          </div>
          <span className="sidebar-brand-subtitle">TRAVELMAP SHORTCUTS</span>
        </div>

        {/* 主菜单列表 */}
        <ul className="left-sidebar-menu">
          {menuItems.map((item) => {
            const ItemIcon = item.icon;
            const hasSubmenu = item.submenus && item.submenus.length > 0;
            const isOpen = activeMenuId === item.id;

            return (
              <li
                key={item.id}
                data-id={item.id}
                className={`left-menu-item ${isOpen ? "flyout-open is-active-menu" : ""} ${
                  item.id === "themes" ? "flyout-align-bottom" : ""
                }`}
                onMouseEnter={() => handleItemMouseEnter(item)}
                onClick={() => {
                  if (item.action) item.action();
                }}
              >
                <div className="menu-item-main">
                  <span
                    className="menu-item-icon-box"
                    style={{
                      color: item.accentColor,
                      backgroundColor: item.bgColor,
                    }}
                  >
                    <ItemIcon size={19} />
                  </span>
                  <div className="menu-item-text-group">
                    <span className="menu-item-title">{item.title}</span>
                    <span className="menu-item-en-title">{item.enTitle}</span>
                  </div>
                </div>

                {hasSubmenu && (
                  <span className="menu-item-arrow-icon">
                    <ChevronRight size={16} />
                  </span>
                )}

                {/* 悬停自动弹出的二级子功能面板（配合意图检测，斜向移动时稳定锁定） */}
                {hasSubmenu && (
                  <div
                    className="left-submenu-flyout"
                    onMouseEnter={handleFlyoutMouseEnter}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="submenu-flyout-header">
                      <span className="submenu-flyout-tag">{item.title} · 子功能</span>
                    </div>

                    <div className="submenu-flyout-list">
                      {item.submenus.map((sub, idx) => {
                        const SubIcon = sub.icon;
                        return (
                          <button
                            key={sub.id || idx}
                            type="button"
                            className={`submenu-flyout-item ${
                              sub.isActive ? "is-active" : ""
                            }`}
                            onClick={() => {
                              if (sub.action) sub.action();
                            }}
                          >
                            {/* 如果是地图主题项，显示调色圆点 */}
                            {sub.swatches ? (
                              <div className="submenu-theme-swatches">
                                {sub.swatches.map((color, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="theme-swatch-circle"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            ) : SubIcon ? (
                              <span className="submenu-item-icon">
                                <SubIcon size={16} />
                              </span>
                            ) : (
                              <span className="submenu-item-bullet" />
                            )}

                            <div className="submenu-item-text">
                              <span className="submenu-item-title">{sub.title}</span>
                              {sub.desc && (
                                <span className="submenu-item-desc">{sub.desc}</span>
                              )}
                            </div>

                            {sub.isActive && (
                              <span className="submenu-item-check">
                                <Check size={16} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
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
