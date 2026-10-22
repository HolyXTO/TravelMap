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
  Check,
} from "lucide-react";
import guessGameData from "./data/guessGameData.json";

export default function QuestionBankStatsPopover({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRegionTab, setActiveRegionTab] = useState("all"); // "all" | "domestic" | "foreign"
  const [expandedCountries, setExpandedCountries] = useState(() => new Set(["中国"]));
  const popoverRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate questions by country and city
  const stats = useMemo(() => {
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

    // Sort by count descending
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

  // Filtered countries based on tab & search
  const filteredCountries = useMemo(() => {
    let list = stats.countries;
    if (activeRegionTab !== "all") {
      list = list.filter((c) => c.region === activeRegionTab);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list
        .map((c) => {
          const matchCountry = c.name.toLowerCase().includes(term);
          const matchedCities = c.cities.filter((city) =>
            city.name.toLowerCase().includes(term)
          );
          if (matchCountry) {
            return c;
          }
          if (matchedCities.length > 0) {
            return {
              ...c,
              cities: matchedCities,
            };
          }
          return null;
        })
        .filter(Boolean);
    }
    return list;
  }, [stats.countries, activeRegionTab, searchTerm]);

  // When searching, auto-expand matching countries
  useEffect(() => {
    if (searchTerm.trim()) {
      setExpandedCountries(new Set(filteredCountries.map((c) => c.name)));
    }
  }, [searchTerm, filteredCountries]);

  const toggleCountry = (countryName) => {
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
      aria-label="实景图寻题库全景分布"
    >
      {/* 头部标题与关闭按钮 */}
      <div className="qb-popover-header">
        <div className="qb-header-titles">
          <div className="qb-header-badge">
            <Database size={13} />
            <span><span className="game-hero-brand-text" style={{ letterSpacing: "0.08em" }}>GEO GUESS</span> DATASET · 全景分布</span>
          </div>
          <h3 className="qb-header-title">实景图寻题库详细数据</h3>
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

      {/* 统计指标卡片网格 */}
      <div className="qb-metrics-grid">
        <div className="qb-metric-card total">
          <div className="qb-metric-icon">
            <Database size={15} />
          </div>
          <div className="qb-metric-data">
            <span className="qb-metric-value">{stats.total.toLocaleString()}</span>
            <span className="qb-metric-label">题库总照片</span>
          </div>
        </div>

        <div className="qb-metric-card domestic">
          <div className="qb-metric-icon">
            <MapPin size={15} />
          </div>
          <div className="qb-metric-data">
            <span className="qb-metric-value">{stats.domesticCount.toLocaleString()}</span>
            <span className="qb-metric-label">
              国内风景 ({((stats.domesticCount / stats.total) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="qb-metric-card foreign">
          <div className="qb-metric-icon">
            <Globe size={15} />
          </div>
          <div className="qb-metric-data">
            <span className="qb-metric-value">{stats.foreignCount.toLocaleString()}</span>
            <span className="qb-metric-label">
              国外名胜 ({((stats.foreignCount / stats.total) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="qb-metric-card footprint">
          <div className="qb-metric-icon">
            <Building2 size={15} />
          </div>
          <div className="qb-metric-data">
            <span className="qb-metric-value">{stats.countryCount} 国 · {stats.cityCount} 城</span>
            <span className="qb-metric-label">全球探索足迹</span>
          </div>
        </div>
      </div>

      {/* 控制工具条：搜索 + 分类过滤 + 全部展开/收起 */}
      <div className="qb-controls-bar">
        <div className="qb-search-wrapper">
          <Search size={14} className="qb-search-icon" />
          <input
            type="text"
            className="qb-search-input"
            placeholder="搜索国家或城市名..."
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

        <div className="qb-tabs-and-actions">
          <div className="qb-category-tabs">
            <button
              type="button"
              className={`qb-tab-btn ${activeRegionTab === "all" ? "active" : ""}`}
              onClick={() => setActiveRegionTab("all")}
            >
              全部
            </button>
            <button
              type="button"
              className={`qb-tab-btn ${activeRegionTab === "domestic" ? "active" : ""}`}
              onClick={() => setActiveRegionTab("domestic")}
            >
              国内 ({stats.domesticCount})
            </button>
            <button
              type="button"
              className={`qb-tab-btn ${activeRegionTab === "foreign" ? "active" : ""}`}
              onClick={() => setActiveRegionTab("foreign")}
            >
              国外 ({stats.foreignCount})
            </button>
          </div>

          <div className="qb-expand-actions">
            <button
              type="button"
              className="qb-expand-btn"
              onClick={expandAll}
              title="展开所有国家"
            >
              全部展开
            </button>
            <button
              type="button"
              className="qb-expand-btn"
              onClick={collapseAll}
              title="收起所有国家"
            >
              全部收起
            </button>
          </div>
        </div>
      </div>

      {/* 国家与城市展开列表 */}
      <div className="qb-accordion-scroll">
        {filteredCountries.length === 0 ? (
          <div className="qb-empty-state">
            <Search size={28} className="qb-empty-icon" />
            <p>未找到匹配 “{searchTerm}” 的国家或城市</p>
          </div>
        ) : (
          filteredCountries.map((country) => {
            const isExpanded = expandedCountries.has(country.name);
            const isDomestic = country.region === "domestic";

            return (
              <div
                key={country.name}
                className={`qb-country-card ${isExpanded ? "expanded" : ""}`}
              >
                {/* 国家卡片头部 (点击展开/收起) */}
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
                    <span className="qb-country-name">{country.name}</span>
                    <span className={`qb-region-tag ${isDomestic ? "domestic" : "foreign"}`}>
                      {isDomestic ? "国内" : "国外"}
                    </span>
                    <span className="qb-cities-count-label">
                      {country.cities.length} 座城市
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
                {isExpanded && (
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
        <span>题库采用 Fisher-Yates 均匀连续洗牌，确保每张照片出现概率绝对均等</span>
      </div>
    </div>
  );
}
