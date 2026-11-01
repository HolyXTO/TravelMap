// -*- coding: utf-8 -*-
/**
 * MapThemeModal.jsx
 * 
 * 地图多样性配色配置弹窗：
 * 1. 预设 6 款高水准暗黑/科技/战术地图配色方案；
 * 2. 自由微调 5 类关键地学图元色彩 (陆地、海洋、边界、路网、探头光标)；
 * 3. 实时响应与 LocalStorage 记忆保存。
 */
import React from "react";
import { Palette, X, RotateCcw, Check, Sparkles } from "lucide-react";
import { THEME_PRESETS, DEFAULT_THEME } from "../utils/mapTheme";

const COLOR_FIELDS = [
  { key: "bg", label: "模块底色", hint: "功能块卡片外框与深空背景色彩" },
  { key: "land", label: "陆地地貌", hint: "大陆地表及植被底衬" },
  { key: "ocean", label: "海洋水系", hint: "大洋海域与内陆水体" },
  { key: "border", label: "行政边界", hint: "国家与省州界限" },
  { key: "road", label: "道路路网", hint: "高速路、干道与街道" },
  { key: "dots", label: "监控光标", hint: "实时探头圆点与标签注记" },
];

export default function MapThemeModal({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  onResetTheme,
}) {
  if (!isOpen) return null;

  // 判断是否与某一预设完全匹配
  const matchedPresetId = THEME_PRESETS.find((preset) => {
    return (
      (preset.colors.bg || "").toLowerCase() === (currentTheme.bg || "").toLowerCase() &&
      preset.colors.land.toLowerCase() === currentTheme.land.toLowerCase() &&
      preset.colors.ocean.toLowerCase() === currentTheme.ocean.toLowerCase() &&
      preset.colors.border.toLowerCase() === currentTheme.border.toLowerCase() &&
      preset.colors.road.toLowerCase() === currentTheme.road.toLowerCase() &&
      preset.colors.dots.toLowerCase() === currentTheme.dots.toLowerCase()
    );
  })?.id;

  const handleSelectPreset = (preset) => {
    onThemeChange({ ...preset.colors });
  };

  const handleCustomColorChange = (key, value) => {
    onThemeChange({
      ...currentTheme,
      [key]: value,
    });
  };

  return (
    <div className="livecam-theme-modal-backdrop" onClick={onClose}>
      <div
        className="livecam-theme-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="livecam-theme-modal-header">
          <div className="livecam-theme-modal-title-wrap">
            <Palette size={18} color="#00e5ff" />
            <div>
              <div className="livecam-theme-modal-title">地图配色方案</div>
              <div className="livecam-theme-modal-subtitle">
                自由调整功能块底色、海洋、陆地、边界及监控探头色彩
              </div>
            </div>
          </div>
          <button
            type="button"
            className="livecam-icon-btn"
            onClick={onClose}
            title="关闭窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* 主体滚动区 */}
        <div className="livecam-theme-modal-body">
          {/* 预设方案部分 */}
          <div className="livecam-theme-section">
            <div className="livecam-theme-section-title">
              <Sparkles size={14} color="#ffd700" />
              <span>推荐预设风格</span>
            </div>
            <div className="livecam-theme-presets-grid">
              {THEME_PRESETS.map((preset) => {
                const isSelected = matchedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`livecam-preset-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <div className="livecam-preset-card-top">
                      <span className="livecam-preset-name">{preset.name}</span>
                      {isSelected && (
                        <span className="livecam-preset-check">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <div className="livecam-preset-desc">{preset.desc}</div>
                    {/* 6 色彩带预览：底色、海洋、陆地、边界、道路、光标 */}
                    <div className="livecam-preset-swatch-bar">
                      <div
                        className="livecam-preset-swatch-cell is-bg"
                        style={{ backgroundColor: preset.colors.bg }}
                        title={`功能块底色: ${preset.colors.bg}`}
                      />
                      <div
                        className="livecam-preset-swatch-cell"
                        style={{ backgroundColor: preset.colors.ocean }}
                        title={`海洋: ${preset.colors.ocean}`}
                      />
                      <div
                        className="livecam-preset-swatch-cell"
                        style={{ backgroundColor: preset.colors.land }}
                        title={`陆地: ${preset.colors.land}`}
                      />
                      <div
                        className="livecam-preset-swatch-cell"
                        style={{ backgroundColor: preset.colors.border }}
                        title={`边界: ${preset.colors.border}`}
                      />
                      <div
                        className="livecam-preset-swatch-cell"
                        style={{ backgroundColor: preset.colors.road }}
                        title={`道路: ${preset.colors.road}`}
                      />
                      <div
                        className="livecam-preset-swatch-cell is-dots"
                        style={{ backgroundColor: preset.colors.dots }}
                        title={`光标: ${preset.colors.dots}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 自由色彩设定 */}
          <div className="livecam-theme-section">
            <div className="livecam-theme-section-title">
              <Palette size={14} color="#00e676" />
              <span>图层要素自由调色</span>
            </div>
            <div className="livecam-theme-custom-list">
              {COLOR_FIELDS.map((field) => {
                const colorVal = currentTheme[field.key] || "#000000";
                return (
                  <div key={field.key} className="livecam-theme-custom-row-wrap">
                    <div className="livecam-theme-custom-row">
                      <div className="livecam-theme-custom-info">
                        <div className="livecam-theme-custom-label">{field.label}</div>
                        <div className="livecam-theme-custom-hint">{field.hint}</div>
                      </div>
                      <div className="livecam-theme-picker-group">
                        <div
                          className="livecam-color-preview"
                          style={{ backgroundColor: colorVal }}
                        >
                          <input
                            type="color"
                            value={colorVal}
                            onChange={(e) =>
                              handleCustomColorChange(field.key, e.target.value)
                            }
                            className="livecam-native-color-input"
                            title="选择颜色"
                          />
                        </div>
                        <input
                          type="text"
                          value={colorVal}
                          onChange={(e) =>
                            handleCustomColorChange(field.key, e.target.value)
                          }
                          className="livecam-color-hex-input"
                          placeholder="#000000"
                          maxLength={9}
                        />
                      </div>
                    </div>
                    {/* 针对功能块底色的快捷色块推荐 */}
                    {field.key === "bg" && (
                      <div className="livecam-quick-bg-chips">
                        <span className="livecam-quick-chip-hint">快捷预选:</span>
                        {[
                          { label: "极黑", color: "#04040a" },
                          { label: "纯白", color: "#ffffff" },
                          { label: "深蓝", color: "#030816" },
                          { label: "冰蓝", color: "#f0f9ff" },
                          { label: "墨绿", color: "#030a06" },
                          { label: "幽紫", color: "#0c0614" },
                          { label: "冷灰", color: "#121216" },
                          { label: "暗金", color: "#0c0b08" },
                        ].map((chip) => {
                          const isActive =
                            (colorVal || "").toLowerCase() === chip.color.toLowerCase();
                          return (
                            <button
                              key={chip.color}
                              type="button"
                              className={`livecam-quick-chip-btn ${isActive ? "is-active" : ""}`}
                              onClick={() => handleCustomColorChange("bg", chip.color)}
                              title={`选用 ${chip.label} (${chip.color})`}
                            >
                              <span
                                className="livecam-quick-chip-dot"
                                style={{ backgroundColor: chip.color }}
                              />
                              <span>{chip.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部动作栏 */}
        <div className="livecam-theme-modal-footer">
          <button
            type="button"
            className="livecam-btn-secondary"
            onClick={onResetTheme}
          >
            <RotateCcw size={14} />
            <span>恢复默认配色</span>
          </button>
          <button
            type="button"
            className="livecam-btn-primary"
            onClick={onClose}
          >
            <span>完成</span>
          </button>
        </div>
      </div>
    </div>
  );
}
