// -*- coding: utf-8 -*-
/**
 * dayNightLayer.js
 * 负责 MapLibre 真实晨昏线与夜半球暗色阴影遮罩图层的注入、数据热更新与显隐控制。
 */
import { computeSolarTerminatorGeoJSON } from "../utils/solarTerminator";

export const NIGHT_SHADE_SOURCE_ID = "livecam-night-source";
export const TERMINATOR_LINE_SOURCE_ID = "livecam-terminator-source";

export const NIGHT_SHADE_LAYER_ID = "livecam-night-shade";
export const TERMINATOR_GLOW_LAYER_ID = "livecam-terminator-glow";
export const TERMINATOR_LINE_LAYER_ID = "livecam-terminator-line";

/**
 * 初始化晨昏线与夜半球图层
 * @param {import('maplibre-gl').Map} map 
 * @param {boolean} initialVisible 
 */
export function initDayNightLayers(map, initialVisible = true) {
  if (!map) return;
  const { lineGeoJSON, nightGeoJSON } = computeSolarTerminatorGeoJSON(new Date());

  // 1. 添加 Source
  if (!map.getSource(NIGHT_SHADE_SOURCE_ID)) {
    map.addSource(NIGHT_SHADE_SOURCE_ID, {
      type: "geojson",
      data: nightGeoJSON
    });
  }

  if (!map.getSource(TERMINATOR_LINE_SOURCE_ID)) {
    map.addSource(TERMINATOR_LINE_SOURCE_ID, {
      type: "geojson",
      data: lineGeoJSON
    });
  }

  const visibility = initialVisible ? "visible" : "none";

  // 2. 添加夜半球半透明阴影遮罩
  if (!map.getLayer(NIGHT_SHADE_LAYER_ID)) {
    map.addLayer({
      id: NIGHT_SHADE_LAYER_ID,
      type: "fill",
      source: NIGHT_SHADE_SOURCE_ID,
      layout: {
        visibility
      },
      paint: {
        // OSIRIS 同款深邃半透明暗夜蓝色阴影
        "fill-color": "#01010c",
        "fill-opacity": 0.32
      }
    });
  }

  // 3. 添加晨昏线外围青色发光光晕
  if (!map.getLayer(TERMINATOR_GLOW_LAYER_ID)) {
    map.addLayer({
      id: TERMINATOR_GLOW_LAYER_ID,
      type: "line",
      source: TERMINATOR_LINE_SOURCE_ID,
      layout: {
        visibility,
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "#00e5ff",
        "line-width": 4.5,
        "line-opacity": 0.35,
        "line-blur": 2
      }
    });
  }

  // 4. 添加晨昏线核心发光金青色线条
  if (!map.getLayer(TERMINATOR_LINE_LAYER_ID)) {
    map.addLayer({
      id: TERMINATOR_LINE_LAYER_ID,
      type: "line",
      source: TERMINATOR_LINE_SOURCE_ID,
      layout: {
        visibility,
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": "#38bdf8",
        "line-width": 1.5,
        "line-opacity": 0.88
      }
    });
  }
}

/**
 * 刷新晨昏线几何数据 (根据最新 UTC 时间)
 * @param {import('maplibre-gl').Map} map 
 * @param {Date} date 
 */
export function updateDayNightData(map, date = new Date()) {
  if (!map) return;
  const { lineGeoJSON, nightGeoJSON } = computeSolarTerminatorGeoJSON(date);

  const nightSource = map.getSource(NIGHT_SHADE_SOURCE_ID);
  if (nightSource && typeof nightSource.setData === "function") {
    nightSource.setData(nightGeoJSON);
  }

  const lineSource = map.getSource(TERMINATOR_LINE_SOURCE_ID);
  if (lineSource && typeof lineSource.setData === "function") {
    lineSource.setData(lineGeoJSON);
  }
}

/**
 * 切换晨昏线与夜半球图层显隐
 * @param {import('maplibre-gl').Map} map 
 * @param {boolean} visible 
 */
export function setDayNightVisibility(map, visible) {
  if (!map) return;
  const target = visible ? "visible" : "none";
  const layerIds = [NIGHT_SHADE_LAYER_ID, TERMINATOR_GLOW_LAYER_ID, TERMINATOR_LINE_LAYER_ID];

  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", target);
    }
  }
}
