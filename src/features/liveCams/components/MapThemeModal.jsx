// -*- coding: utf-8 -*-
/**
 * MapThemeModal.jsx
 * 
 * 地图多样性配色配置弹窗：
 * 1. 预设 8 款涵盖极简亮白、深海群青、荒漠暖金、军工战术绿、赛博霓虹及高反差水墨的地图方案；
 * 2. 默认风格锁定为用户当前配置的“极简纯白 · 极昼靛蓝”；
 * 3. 自由微调 6 类关键地学图元色彩 (功能块底色、海洋水系、陆地地貌、行政边界、道路路网、监控探头)；
 * 4. 针对各大要素提供一键快捷色块预选；
 * 5. 实时响应与 LocalStorage 记忆保存。
 */
import React from "react";
import { Palette, X, RotateCcw, Check, Sparkles } from "lucide-react";
import { THEME_PRESETS, DEFAULT_THEME } from "../utils/mapTheme";

const COLOR_FIELDS = [
  {
    key: "bg",
    label: "模块底色",
    hint: "功能块卡片外框与 3D 深空背景色彩",
    chips: [
      { label: "纯白", color: "#ffffff" },
      { label: "极黑", color: "#04040a" },
      { label: "深蓝", color: "#051329" },
      { label: "浅灰白", color: "#f1f5f9" },
      { label: "暖焦", color: "#140f0b" },
      { label: "墨绿", color: "#05140b" },
      { label: "幽紫", color: "#120722" },
      { label: "冷灰", color: "#18181b" },
    ],
  },
  {
    key: "ocean",
    label: "海洋水系",
    hint: "大洋海域、海湾与内陆水体色彩",
    chips: [
      { label: "海军蓝", color: "#2e405c" },
      { label: "极黑", color: "#05070a" },
      { label: "湛蓝大洋", color: "#0a3663" },
      { label: "天青蓝", color: "#bae6fd" },
      { label: "深墨绿", color: "#082013" },
      { label: "罗兰紫", color: "#170c2e" },
      { label: "深渊黑", color: "#09090b" },
    ],
  },
  {
    key: "land",
    label: "陆地地貌",
    hint: "各大洲陆块、岛屿及地表底衬色彩",
    chips: [
      { label: "极夜黑", color: "#0b0e14" },
      { label: "海军蓝", color: "#162a45" },
      { label: "象牙素白", color: "#e2e8f0" },
      { label: "暖赭大地", color: "#2b1d14" },
      { label: "战术墨绿", color: "#0f2e1b" },
      { label: "电光紫", color: "#2b1448" },
      { label: "石墨灰", color: "#3f3f46" },
    ],
  },
  {
    key: "border",
    label: "行政边界",
    hint: "国家与省州界限色彩",
    chips: [
      { label: "银灰", color: "#b0bdc9" },
      { label: "暗蓝灰", color: "#2a3b4c" },
      { label: "天蓝", color: "#38bdf8" },
      { label: "石板灰", color: "#64748b" },
      { label: "暖铜金", color: "#b48356" },
      { label: "荧光绿", color: "#22c55e" },
      { label: "明紫", color: "#a855f7" },
      { label: "雪白", color: "#f4f4f5" },
    ],
  },
  {
    key: "road",
    label: "道路路网",
    hint: "高速公路、主要干道与街道网络色彩",
    chips: [
      { label: "暗灰", color: "#16202c" },
      { label: "钴蓝", color: "#1e4976" },
      { label: "浅灰", color: "#cbd5e1" },
      { label: "古铜", color: "#4a3525" },
      { label: "墨绿", color: "#184729" },
      { label: "紫晶", color: "#49237c" },
      { label: "深灰", color: "#52525b" },
    ],
  },
  {
    key: "dots",
    label: "监控光标",
    hint: "实时摄像头脉冲圆点与标签注记色彩",
    chips: [
      { label: "翠绿", color: "#00e676" },
      { label: "极光青", color: "#00f0ff" },
      { label: "猩红", color: "#ef4444" },
      { label: "琥珀金", color: "#f59e0b" },
      { label: "荧光毒绿", color: "#39ff14" },
      { label: "霓虹粉", color: "#f43f5e" },
      { label: "冰川蓝", color: "#38bdf8" },
    ],
  },
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
      (preset.colors.ocean || "").toLowerCase() === (currentTheme.ocean || "").toLowerCase() &&
      (preset.colors.land || "").toLowerCase() === (currentTheme.land || "").toLowerCase() &&
      (preset.colors.border || "").toLowerCase() === (currentTheme.border || "").toLowerCase() &&
      (preset.colors.road || "").toLowerCase() === (currentTheme.road || "").toLowerCase() &&
      (preset.colors.dots || "").toLowerCase() === (currentTheme.dots || "").toLowerCase()
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

                    {/* 针对该地学要素的快捷预选色块推荐 */}
                    {field.chips && field.chips.length > 0 && (
                      <div className="livecam-quick-bg-chips">
                        <span className="livecam-quick-chip-hint">快捷预选:</span>
                        {field.chips.map((chip) => {
                          const isActive =
                            (colorVal || "").toLowerCase() === chip.color.toLowerCase();
                          return (
                            <button
                              key={chip.color}
                              type="button"
                              className={`livecam-quick-chip-btn ${isActive ? "is-active" : ""}`}
                              onClick={() => handleCustomColorChange(field.key, chip.color)}
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
