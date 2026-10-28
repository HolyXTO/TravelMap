import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Database,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Sparkles,
  Layers,
  Building2,
  Camera,
  Compass,
} from "lucide-react";
import guessGameData from "./data/guessGameData.json";
import { ALL_STREET_VIEW_QUESTIONS } from "./services/streetViewService";

// 繁体中文转简体映射（确保国旗 PNG 完美加载）
const TRAD_TO_SIMP = {
  "中國": "中国", "法國": "法国", "德國": "德国", "美國": "美国", "荷蘭": "荷兰",
  "奧地利": "奥地利", "波蘭": "波兰", "愛沙尼亞": "爱沙尼亚", "拉脫維亞": "拉脱维亚",
  "烏克蘭": "乌克兰", "烏拉圭": "乌拉圭", "愛爾蘭共和國": "爱尔兰", "愛爾蘭": "爱尔兰",
  "坦桑尼亞": "坦桑尼亚", "白俄羅斯": "白俄罗斯", "芬蘭": "芬兰", "梵蒂岡城國": "梵蒂冈",
  "梵蒂岡": "梵蒂冈", "羅馬尼亞": "罗马尼亚", "馬達加斯加": "马达加斯加", "希臘": "希腊",
  "俄羅斯": "俄罗斯", "義大利": "意大利", "澳大利亞": "澳大利亚", "紐西蘭": "新西兰",
  "南非共和國": "南非", "沙烏地阿拉伯": "沙特阿拉伯", "土耳其共和國": "土耳其",
  "南韓": "韩国", "北韓": "朝鲜", "菲律賓": "菲律宾"
};

// 严谨的国家对应六大洲归属映射 (亚洲、欧洲、北美洲、南美洲、非洲、大洋洲)
const COUNTRY_TO_CONTINENT = {
  // 亚洲
  "中国": "亚洲", "日本": "亚洲", "韩国": "亚洲", "泰国": "亚洲", "新加坡": "亚洲",
  "马来西亚": "亚洲", "印度尼西亚": "亚洲", "印度": "亚洲", "菲律宾": "亚洲", "越南": "亚洲",
  "柬埔寨": "亚洲", "以色列": "亚洲", "阿联酋": "亚洲", "沙特阿拉伯": "亚洲", "哈萨克斯坦": "亚洲",
  "乌兹别克斯坦": "亚洲", "亚美尼亚": "亚洲", "阿塞拜疆": "亚洲", "格鲁吉亚": "亚洲", "土耳其": "亚洲",
  "伊朗": "亚洲", "阿曼": "亚洲", "黎巴嫩": "亚洲", "约旦": "亚洲", "尼泊尔": "亚洲",
  "台湾": "亚洲", "香港": "亚洲", "澳门": "亚洲",
  
  // 欧洲
  "意大利": "欧洲", "德国": "欧洲", "法国": "欧洲", "瑞士": "欧洲", "奥地利": "欧洲",
  "荷兰": "欧洲", "英国": "欧洲", "西班牙": "欧洲", "葡萄牙": "欧洲", "瑞典": "欧洲",
  "挪威": "欧洲", "芬兰": "欧洲", "丹麦": "欧洲", "冰岛": "欧洲", "波兰": "欧洲",
  "捷克": "欧洲", "匈牙利": "欧洲", "希腊": "欧洲", "比利时": "欧洲", "爱尔兰": "欧洲",
  "斯洛伐克": "欧洲", "斯洛文尼亚": "欧洲", "克罗地亚": "欧洲", "塞尔维亚": "欧洲", "保加利亚": "欧洲",
  "罗马尼亚": "欧洲", "乌克兰": "欧洲", "白俄罗斯": "欧洲", "爱沙尼亚": "欧洲", "拉脱维亚": "欧洲",
  "立陶宛": "欧洲", "梵蒂冈": "欧洲", "摩纳哥": "欧洲", "圣马力诺": "欧洲", "安道尔": "欧洲",
  "卢森堡": "欧洲", "列支敦士登": "欧洲", "塞浦路斯": "欧洲", "马耳他": "欧洲", "黑山": "欧洲",
  "波斯尼亚和黑塞哥维那": "欧洲", "马其顿": "欧洲", "阿尔巴尼亚": "欧洲", "摩尔多瓦": "欧洲", "俄罗斯": "欧洲",
  
  // 北美洲
  "美国": "北美洲", "加拿大": "北美洲", "墨西哥": "北美洲", "古巴": "北美洲",
  "巴拿马": "北美洲", "哥斯达黎加": "北美洲", "格陵兰": "北美洲",
  
  // 南美洲
  "巴西": "南美洲", "阿根廷": "南美洲", "智利": "南美洲", "秘鲁": "南美洲",
  "哥伦比亚": "南美洲", "乌拉圭": "南美洲", "厄瓜多尔": "南美洲", "玻利维亚": "南美洲",
  
  // 大洋洲
  "澳大利亚": "大洋洲", "新西兰": "大洋洲", "斐济": "大洋洲",
  
  // 非洲
  "埃及": "非洲", "南非": "非洲", "摩洛哥": "非洲", "肯尼亚": "非洲",
  "坦桑尼亚": "非洲", "尼日利亚": "非洲", "阿尔及利亚": "非洲", "利比亚": "非洲",
  "突尼斯": "非洲", "纳米比亚": "非洲", "马达加斯加": "非洲", "埃塞俄比亚": "非洲",
  "几内亚": "非洲", "科摩罗": "非洲"
};

function PopoverCountryFlag({ countryName, size = 26 }) {
  const [hasErr, setHasErr] = useState(false);
  const raw = (countryName || "").trim();
  const clean = TRAD_TO_SIMP[raw] || raw;

  useEffect(() => {
    setHasErr(false);
  }, [clean]);

  if (hasErr || !clean) {
    return <span style={{ fontSize: `${size * 0.8}px`, lineHeight: 1, display: "inline-block" }}>🌍</span>;
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}flags/circle-195/${encodeURIComponent(clean)}.png`}
      alt={clean}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        objectFit: "cover",
        boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
        border: "1px solid rgba(255, 255, 255, 0.9)",
        flexShrink: 0
      }}
      onError={() => setHasErr(true)}
    />
  );
}

export default function QuestionBankStatsPopover({ isOpen, onClose }) {
  // 题库类型：默认严格设置为 "streetview" (360°真实街景)
  const [bankType, setBankType] = useState("streetview");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRegionTab, setActiveRegionTab] = useState("all");
  const [expandedCountries, setExpandedCountries] = useState(() => new Set(["中国"]));
  const popoverRef = useRef(null);

  // 每次打开弹窗时，强制默认展示 360° 真实街景题库与全部标签
  useEffect(() => {
    if (isOpen) {
      setBankType("streetview");
      setActiveRegionTab("all");
      setSearchTerm("");
    }
  }, [isOpen]);

  // 按 Escape 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // 1. 经典旅拍照片题库统计 (Xiao & Tang)
  const photoStats = useMemo(() => {
    const questions = guessGameData.questions || [];
    const countryMap = new Map();
    let domesticCount = 0;
    let foreignCount = 0;
    const allCitiesSet = new Set();

    for (const q of questions) {
      if (q.region === "domestic") domesticCount++;
      else if (q.region === "foreign") foreignCount++;
      if (q.cityId) allCitiesSet.add(q.cityId);

      const country = q.countryName || "未知国家";
      if (!countryMap.has(country)) {
        countryMap.set(country, {
          name: country,
          region: q.region || "domestic",
          code: q.countryCode || "",
          count: 0,
          cityMap: new Map(),
        });
      }
      const cEntry = countryMap.get(country);
      cEntry.count += 1;

      const cityName = q.cityName || "未知城市";
      cEntry.cityMap.set(cityName, (cEntry.cityMap.get(cityName) || 0) + 1);
    }

    const countries = Array.from(countryMap.values()).map((c) => {
      const cities = Array.from(c.cityMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentOfCountry: ((count / c.count) * 100).toFixed(1),
        }))
        .sort((a, b) => b.count - a.count);

      return {
        ...c,
        cities,
        percentOfTotal: ((c.count / questions.length) * 100).toFixed(1),
      };
    });

    countries.sort((a, b) => b.count - a.count);

    return {
      total: questions.length,
      domesticCount,
      foreignCount,
      countryCount: countries.length,
      cityCount: allCitiesSet.size,
      countries,
    };
  }, []);

  // 2. 360° 全景街景题库统计 (严格按大洲与国家统计，不按城市展开)
  const streetViewStats = useMemo(() => {
    const questions = ALL_STREET_VIEW_QUESTIONS || [];
    const countryMap = new Map();
    const continentCounts = {
      "欧洲": 0,
      "亚洲": 0,
      "北美洲": 0,
      "南美洲": 0,
      "非洲": 0,
      "大洋洲": 0,
    };

    for (const q of questions) {
      let rawCountry = (q.countryName || q.country || "其他").trim();
      const country = TRAD_TO_SIMP[rawCountry] || rawCountry;
      const continent = COUNTRY_TO_CONTINENT[country] || "其他";
      
      if (continentCounts[continent] !== undefined) {
        continentCounts[continent] += 1;
      }

      if (!countryMap.has(country)) {
        countryMap.set(country, {
          name: country,
          continent,
          count: 0,
        });
      }
      countryMap.get(country).count += 1;
    }

    const countries = Array.from(countryMap.values()).map((c) => ({
      ...c,
      percentOfTotal: ((c.count / questions.length) * 100).toFixed(1),
    }));

    // 按题目数降序排列
    countries.sort((a, b) => b.count - a.count);

    return {
      total: questions.length,
      countryCount: countries.length,
      continentCounts,
      countries,
    };
  }, []);

  // 筛选过滤
  const filteredCountries = useMemo(() => {
    if (bankType === "streetview") {
      let list = streetViewStats.countries;
      if (activeRegionTab !== "all") {
        list = list.filter((c) => c.continent === activeRegionTab);
      }
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        list = list.filter((c) =>
          c.name.toLowerCase().includes(term) ||
          c.continent.toLowerCase().includes(term)
        );
      }
      return list;
    }

    // 照片题库过滤
    let list = photoStats.countries;
    if (activeRegionTab !== "all") {
      list = list.filter((c) => c.region === activeRegionTab);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list
        .map((c) => {
          const matchCountry = c.name.toLowerCase().includes(term);
          const matchedCities = (c.cities || []).filter((city) =>
            city.name.toLowerCase().includes(term)
          );
          if (matchCountry) return c;
          if (matchedCities.length > 0) return { ...c, cities: matchedCities };
          return null;
        })
        .filter(Boolean);
    }
    return list;
  }, [streetViewStats, photoStats, activeRegionTab, searchTerm, bankType]);

  // 搜索时照片题库自动展开城市
  useEffect(() => {
    if (searchTerm.trim() && bankType === "photo") {
      setExpandedCountries(new Set(filteredCountries.map((c) => c.name)));
    }
  }, [searchTerm, filteredCountries, bankType]);

  const toggleCountry = (countryName) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryName)) next.delete(countryName);
      else next.add(countryName);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCountries(new Set(filteredCountries.map((c) => c.name)));
  };

  const collapseAll = () => {
    setExpandedCountries(new Set());
  };

  if (!isOpen) return null;

  return (
    <div
      className="question-bank-stats-popover"
      ref={popoverRef}
      role="dialog"
      aria-label="图寻题库全景分布面板"
    >
      {/* 头部标题与关闭按钮 */}
      <div className="qb-popover-header">
        <div className="qb-header-titles">
          <div className="qb-header-badge">
            <Database size={13} />
            <span><span className="game-hero-brand-text" style={{ letterSpacing: "0.08em" }}>GEO GUESS</span> DATASET · 题库大洲分布</span>
          </div>
          <h3 className="qb-header-title">
            {bankType === "streetview" ? "360° 真实街景题库全球大洲数据" : "经典旅拍照片题库详细数据"}
          </h3>
        </div>
        <button
          type="button"
          className="qb-close-btn"
          onClick={onClose}
          aria-label="关闭题库分布面板"
          title="关闭"
        >
          <X size={17} />
        </button>
      </div>

      {/* 最顶部题库类型切换按钮 (默认选中真实街景题库) */}
      <div className="qb-bank-type-switcher">
        <button
          type="button"
          className={`qb-bank-switch-btn ${bankType === "streetview" ? "active" : ""}`}
          onClick={() => {
            setBankType("streetview");
            setActiveRegionTab("all");
            setSearchTerm("");
          }}
          title="查看 360° 球面全景真实街景分布 (严格按全球大洲与国家统计)"
        >
          <Globe size={15} />
          <span>🌐 360° 真实街景题库 ({streetViewStats.total.toLocaleString()} 题)</span>
        </button>
        <button
          type="button"
          className={`qb-bank-switch-btn ${bankType === "photo" ? "active" : ""}`}
          onClick={() => {
            setBankType("photo");
            setActiveRegionTab("all");
            setSearchTerm("");
          }}
          title="查看经典旅拍照片题库分布 (Xiao & Tang · 细化至城市)"
        >
          <Camera size={15} />
          <span>📸 旅拍照片题库 ({photoStats.total.toLocaleString()} 题)</span>
        </button>
      </div>

      {/* 统计指标卡片网格 */}
      <div className="qb-metrics-grid">
        {bankType === "streetview" ? (
          <>
            <div className="qb-metric-card total">
              <div className="qb-metric-icon">
                <Database size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{streetViewStats.total.toLocaleString()}</span>
                <span className="qb-metric-label">街景题库总数</span>
              </div>
            </div>

            <div className="qb-metric-card domestic">
              <div className="qb-metric-icon">
                <Globe size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{streetViewStats.continentCounts["欧洲"] || 0}</span>
                <span className="qb-metric-label">欧洲 ({((streetViewStats.continentCounts["欧洲"] / streetViewStats.total) * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="qb-metric-card foreign">
              <div className="qb-metric-icon">
                <MapPin size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{streetViewStats.continentCounts["亚洲"] || 0}</span>
                <span className="qb-metric-label">亚洲 ({((streetViewStats.continentCounts["亚洲"] / streetViewStats.total) * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="qb-metric-card footprint">
              <div className="qb-metric-icon">
                <Compass size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{streetViewStats.countryCount} 国 · 6 大洲</span>
                <span className="qb-metric-label">全球国家覆盖</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="qb-metric-card total">
              <div className="qb-metric-icon">
                <Database size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{photoStats.total.toLocaleString()}</span>
                <span className="qb-metric-label">题库总照片数</span>
              </div>
            </div>

            <div className="qb-metric-card domestic">
              <div className="qb-metric-icon">
                <MapPin size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{photoStats.domesticCount.toLocaleString()}</span>
                <span className="qb-metric-label">国内风景 ({((photoStats.domesticCount / photoStats.total) * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="qb-metric-card foreign">
              <div className="qb-metric-icon">
                <Globe size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{photoStats.foreignCount.toLocaleString()}</span>
                <span className="qb-metric-label">国外名胜 ({((photoStats.foreignCount / photoStats.total) * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="qb-metric-card footprint">
              <div className="qb-metric-icon">
                <Building2 size={15} />
              </div>
              <div className="qb-metric-data">
                <span className="qb-metric-value">{photoStats.countryCount} 国 · {photoStats.cityCount} 城</span>
                <span className="qb-metric-label">全球探索足迹</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 控制工具条：搜索 + 大洲分类过滤 */}
      <div className="qb-controls-bar">
        <div className="qb-search-wrapper">
          <Search size={14} className="qb-search-icon" />
          <input
            type="text"
            className="qb-search-input"
            placeholder={bankType === "streetview" ? "搜索国家或大洲名..." : "搜索国家或城市名..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="qb-search-clear"
              onClick={() => setSearchTerm("")}
              title="清空搜索"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* 严格按各大洲分类的筛选标签 (欧洲 / 亚洲 / 北美洲 / 南美洲 / 非洲 / 大洋洲) */}
        <div className="qb-tabs-and-actions">
          <div className="qb-category-tabs">
            <button
              type="button"
              className={`qb-tab-btn ${activeRegionTab === "all" ? "active" : ""}`}
              onClick={() => setActiveRegionTab("all")}
            >
              全部 ({bankType === "streetview" ? streetViewStats.total : photoStats.total})
            </button>

            {bankType === "streetview" ? (
              <>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "欧洲" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("欧洲")}
                >
                  欧洲 ({streetViewStats.continentCounts["欧洲"] || 0})
                </button>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "亚洲" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("亚洲")}
                >
                  亚洲 ({streetViewStats.continentCounts["亚洲"] || 0})
                </button>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "北美洲" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("北美洲")}
                >
                  北美洲 ({streetViewStats.continentCounts["北美洲"] || 0})
                </button>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "南美洲" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("南美洲")}
                >
                  南美洲 ({streetViewStats.continentCounts["南美洲"] || 0})
                </button>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "非洲" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("非洲")}
                >
                  非洲 ({streetViewStats.continentCounts["非洲"] || 0})
                </button>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "大洋洲" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("大洋洲")}
                >
                  大洋洲 ({streetViewStats.continentCounts["大洋洲"] || 0})
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "domestic" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("domestic")}
                >
                  国内 ({photoStats.domesticCount})
                </button>
                <button
                  type="button"
                  className={`qb-tab-btn ${activeRegionTab === "foreign" ? "active" : ""}`}
                  onClick={() => setActiveRegionTab("foreign")}
                >
                  国外 ({photoStats.foreignCount})
                </button>
              </>
            )}
          </div>

          {/* 照片题库模式下保留展开/收起按钮 */}
          {bankType === "photo" && (
            <div className="qb-expand-actions">
              <button
                type="button"
                className="qb-expand-btn"
                onClick={expandAll}
                title="展开所有国家"
              >
                展开
              </button>
              <button
                type="button"
                className="qb-expand-btn"
                onClick={collapseAll}
                title="收起所有国家"
              >
                收起
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 数据列表容器 */}
      <div className="qb-accordion-scroll">
        {filteredCountries.length === 0 ? (
          <div className="qb-empty-state">
            <Search size={28} className="qb-empty-icon" />
            <p>未找到匹配 “{searchTerm}” 的国家</p>
          </div>
        ) : bankType === "streetview" ? (
          /* =========================================================================
             街景题库展示形态：只按大洲/国家统计，整洁列出每个国家题数与占比，无需城市展开
             ========================================================================= */
          <div className="qb-streetview-list">
            {filteredCountries.map((country) => {
              const fillPct = Math.min(100, Math.max(3, parseFloat(country.percentOfTotal) * 4));

              return (
                <div key={country.name} className="qb-streetview-country-row">
                  <div className="qb-sv-country-left">
                    <PopoverCountryFlag countryName={country.name} size={30} />
                    <div className="qb-sv-country-title-wrap">
                      <span className="qb-sv-country-name">{country.name}</span>
                      {/* 大洲标签：纯大洲名称 (亚洲/欧洲/北美洲/南美洲/非洲/大洋洲)，杜绝多余文字 */}
                      <span className="qb-sv-continent-tag">
                        {country.continent || "其他"}
                      </span>
                    </div>
                  </div>

                  <div className="qb-sv-country-right">
                    <div className="qb-sv-progress-bar-wrap" title={`占全库 ${country.percentOfTotal}%`}>
                      <div
                        className="qb-sv-progress-bar-fill"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="qb-sv-count-badge">
                      <strong>{country.count}</strong> 题
                    </div>
                    <span className="qb-sv-percent-label">
                      {country.percentOfTotal}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* =========================================================================
             照片题库展示形态：保留国家 + 城市详细折叠展开
             ========================================================================= */
          filteredCountries.map((country) => {
            const isExpanded = expandedCountries.has(country.name);
            const isDomestic = country.region === "domestic";

            return (
              <div
                key={country.name}
                className={`qb-country-card ${isExpanded ? "expanded" : ""}`}
              >
                {/* 国家卡片头部 */}
                <div
                  className="qb-country-header"
                  onClick={() => toggleCountry(country.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      toggleCountry(country.name);
                    }
                  }}
                >
                  <div className="qb-country-left">
                    <span className="qb-chevron-icon">
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                    <PopoverCountryFlag countryName={country.name} size={22} />
                    <span className="qb-country-name">{country.name}</span>
                    <span className={`qb-region-tag ${isDomestic ? "domestic" : "foreign"}`}>
                      {isDomestic ? "国内" : "国外"}
                    </span>
                    <span className="qb-cities-count-label">
                      {country.cities?.length || 0} 座城市
                    </span>
                  </div>

                  <div className="qb-country-right">
                    <div className="qb-country-count-badge">
                      <strong>{country.count}</strong> 题
                    </div>
                    <span className="qb-country-percent">
                      {country.percentOfTotal}%
                    </span>
                  </div>
                </div>

                {/* 城市网格 (展开时可见) */}
                {isExpanded && country.cities && (
                  <div className="qb-cities-container">
                    <div className="qb-cities-grid">
                      {country.cities.map((city) => (
                        <div key={city.name} className="qb-city-chip">
                          <div className="qb-city-left">
                            <MapPin size={11} className="qb-city-pin" />
                            <span className="qb-city-name">{city.name}</span>
                          </div>
                          <span className="qb-city-count-badge">
                            {city.count} 题
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 底部保障与算法标注 */}
      <div className="qb-popover-footer">
        <Sparkles size={13} className="qb-footer-icon" />
        <span>
          {bankType === "streetview"
            ? "360° 球面街景题库覆盖亚、欧、北美、南美、非、大洋 6 大洲 70+ 国，支持连续无尽洗牌"
            : "题库采用 Fisher-Yates 均匀连续洗牌，确保每张照片出现概率绝对均等"}
        </span>
      </div>
    </div>
  );
}
