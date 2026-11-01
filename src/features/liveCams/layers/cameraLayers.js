// -*- coding: utf-8 -*-
/**
 * cameraLayers.js
 * 
 * 1:1 严格复刻 OSIRIS 原版的发光摄像头全景散点系统 (CCTV Glow & Dots & Label)：
 * 采用 OSIRIS 原生符号化参数：2.5px 纯黑高对比描边、黑色阴影环、绿色实心核心与 Zoom 10+ 道路标签。
 * 在 2D/3D 全球视野上以高密度绿色发光散点全量呈现 45,000+ 个探头，
 * 支持在任何缩放层级自由悬停探测、点击弹窗与即时定位。
 */
import { camerasToGeoJSON } from "../services/cameraCatalog";

export const CAMERAS_SOURCE_ID = "livecam-cameras-source";
export const CAMERAS_GLOW_LAYER_ID = "livecam-cameras-glow";
export const CAMERAS_DOTS_LAYER_ID = "livecam-cameras-dots";
export const CAMERAS_LABEL_LAYER_ID = "livecam-cameras-label";

/**
 * 向 MapLibre 地图实例初始化摄像头数据源与发光渲染图层
 * @param {import('maplibre-gl').Map} map 
 * @param {Array} cameras 
 */
export function initCameraLayers(map, cameras) {
  if (!map) return;
  const geojson = camerasToGeoJSON(cameras);

  // 1. 添加全量散点 GeoJSON Source (不聚类，完美呈现全球散点星图)
  if (!map.getSource(CAMERAS_SOURCE_ID)) {
    map.addSource(CAMERAS_SOURCE_ID, {
      type: "geojson",
      data: geojson,
      cluster: false,
    });
  }

  // 2. 探头外层阴影光晕圈 (OSIRIS cctv-glow: 黑色柔和阴影底衬)
  if (!map.getLayer(CAMERAS_GLOW_LAYER_ID)) {
    map.addLayer({
      id: CAMERAS_GLOW_LAYER_ID,
      type: "circle",
      source: CAMERAS_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 5,
          5, 8,
          10, 14,
          14, 20,
        ],
        "circle-color": "#000000",
        "circle-opacity": 0.35,
        "circle-blur": 1,
      },
    });
  }

  // 3. 探头核心实体圆点 (OSIRIS cctv-dots: 2.5px 纯黑外圈 + 鲜明科技绿 #00E676 核心)
  if (!map.getLayer(CAMERAS_DOTS_LAYER_ID)) {
    map.addLayer({
      id: CAMERAS_DOTS_LAYER_ID,
      type: "circle",
      source: CAMERAS_SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 3,
          5, 5,
          10, 8,
          14, 12,
        ],
        "circle-color": "#00E676",
        "circle-opacity": 0.9,
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#000000",
        "circle-stroke-opacity": 0.9,
      },
    });
  }

  // 4. 探头文本路名注记 (OSIRIS cctv-label: 在 zoom >= 10 时优雅淡入)
  if (!map.getLayer(CAMERAS_LABEL_LAYER_ID)) {
    map.addLayer({
      id: CAMERAS_LABEL_LAYER_ID,
      type: "symbol",
      source: CAMERAS_SOURCE_ID,
      minzoom: 10,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 9.5,
        "text-offset": [0, 1.8],
        "text-max-width": 12,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#00E676",
        "text-halo-color": "#000000",
        "text-halo-width": 1.5,
        "text-opacity": 0.85,
      },
    });
  }
}

/**
 * 热更新摄像头数据源
 * @param {import('maplibre-gl').Map} map 
 * @param {Array} cameras 
 */
export function updateCameraData(map, cameras) {
  if (!map) return;
  const source = map.getSource(CAMERAS_SOURCE_ID);
  if (source && typeof source.setData === "function") {
    source.setData(camerasToGeoJSON(cameras));
  }
}
