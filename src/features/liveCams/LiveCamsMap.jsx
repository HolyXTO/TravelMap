// -*- coding: utf-8 -*-
/**
 * LiveCamsMap.jsx
 * 
 * 基于 MapLibre GL JS 的独立全球实时摄像头地图组件。
 * 核心特性：
 * 1. 3D Globe (真实三维球体) / 2D Mercator (平面地图) 无缝切换；
 * 2. 本地高可靠 CARTO Dark Matter 暗黑底图与 ESRI 全球卫星影像 (SAT) 平滑切换；
 * 3. 真实天文晨昏线 (Solar Terminator) 与夜半球暗色阴影遮罩；
 * 4. 摄像头图层空间聚类、发光晕染圆点与点击交互；
 * 5. ResizeObserver 自适应与健全的生命周期垃圾回收。
 */
import React, { useState, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cartoDarkStyle from "./layers/cartoDarkStyle.json";
import {
  NIGHT_SHADE_SOURCE_ID,
  TERMINATOR_LINE_SOURCE_ID,
  NIGHT_SHADE_LAYER_ID,
  TERMINATOR_GLOW_LAYER_ID,
  TERMINATOR_LINE_LAYER_ID,
  updateDayNightData,
  setDayNightVisibility,
} from "./layers/dayNightLayer";
import {
  CAMERAS_SOURCE_ID,
  CAMERAS_DOTS_LAYER_ID,
  CAMERAS_GLOW_LAYER_ID,
  CAMERAS_LABEL_LAYER_ID,
  updateCameraData,
} from "./layers/cameraLayers";
import { computeSolarTerminatorGeoJSON } from "./utils/solarTerminator";
import { camerasToGeoJSON } from "./services/cameraCatalog";
import {
  applyMapTheme,
  LAND_LAYERS,
  OCEAN_LAYERS,
  BORDER_LAYERS,
  ROAD_LAYERS,
  PLACE_LABEL_LAYERS,
  WATER_LABEL_LAYERS,
  getLuminance,
} from "./utils/mapTheme";
import CctvPreviews from "./components/CctvPreviews";
import {
  initFlightIcons,
  initFlightLayers,
  updateFlightsSource,
  updateSelectedFlight,
  setFlightLayersVisibility,
} from "./layers/flightLayers";

const SATELLITE_SOURCE_ID = "livecam-satellite-source";
const SATELLITE_LAYER_ID = "livecam-satellite-layer";

export default function LiveCamsMap({
  cameras,
  projectionMode, // '3d' | '2d'
  baseMapType, // 'dark' | 'sat'
  dayNightVisible,
  selectedCamera,
  onSelectCamera,
  onMapReady,
  resetTrigger,
  mapTheme,
  // ── 航班模块专属新属性 ──
  activeModuleTab = "cameras", // 'cameras' | 'aviation'
  flights = [],
  selectedFlight = null,
  flightRouteData = null,
  onSelectFlight,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const isLoadedRef = useRef(false);
  const camerasMapRef = useRef(new Map());
  const camerasRef = useRef(cameras);
  const flightsRef = useRef(flights);
  const flightsMapRef = useRef(new Map());
  const selectedFlightRef = useRef(selectedFlight);
  const flightRouteDataRef = useRef(flightRouteData);
  const activeModuleTabRef = useRef(activeModuleTab);
  const onSelectCameraRef = useRef(onSelectCamera);
  const onSelectFlightRef = useRef(onSelectFlight);

  // 同步最新引用
  activeModuleTabRef.current = activeModuleTab;
  onSelectCameraRef.current = onSelectCamera;
  onSelectFlightRef.current = onSelectFlight;
  camerasRef.current = cameras;
  flightsRef.current = flights;

  // 维护快速 O(1) 航班检索表
  useEffect(() => {
    const fm = new Map();
    if (flights) {
      for (const f of flights) {
        if (f.icao24) fm.set(String(f.icao24).toLowerCase(), f);
      }
    }
    flightsMapRef.current = fm;
  }, [flights]);

  // 维护快速 O(1) ID 探查映射表
  useEffect(() => {
    const m = new Map();
    if (cameras) {
      for (const c of cameras) {
        m.set(String(c.id), c);
      }
    }
    camerasMapRef.current = m;
  }, [cameras]);

  // 1. 初始化 MapLibre 地图实例
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const container = mapContainerRef.current;

    // 配置独立静态 Web Worker 路径，避免 Vite dev 动态导入失败
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      maplibregl.setWorkerUrl(`${baseUrl}/vendor/maplibre/6.7.0/maplibre-gl-worker.mjs`);
    } catch (e) {
      console.warn("[LiveCamsMap] Worker URL set fallback:", e);
    }

    const facingLng = Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4));
    const { lineGeoJSON, nightGeoJSON } = computeSolarTerminatorGeoJSON(new Date());
    const cameraGeoJSON = camerasToGeoJSON(cameras);

    // 1:1 严格复刻 OSIRIS 的 CARTO Dark Matter 矢量底图系统 (93 矢量图层 + 纯正黑夜美学)
    const baseStyle = JSON.parse(JSON.stringify(cartoDarkStyle));

    // 根据当前选定配色方案预设初始样式
    if (mapTheme) {
      const isLandLight = getLuminance(mapTheme.land) > 0.55;
      const placeTextColor = isLandLight ? "#0f172a" : "#cbd5e1";
      const placeHaloColor = isLandLight ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 0, 0, 0.85)";
      const isOceanLight = getLuminance(mapTheme.ocean) > 0.55;
      const oceanTextColor = isOceanLight ? "#0369a1" : "#7dd3fc";
      const oceanHaloColor = isOceanLight ? "rgba(255, 255, 255, 0.95)" : "rgba(0, 0, 0, 0.8)";

      for (const l of baseStyle.layers) {
        if (!l.paint) continue;
        if (l.id === "background" && mapTheme.land) {
          l.paint["background-color"] = mapTheme.land;
        } else if (LAND_LAYERS.includes(l.id) && mapTheme.land) {
          l.paint["fill-color"] = mapTheme.land;
        } else if (OCEAN_LAYERS.includes(l.id) && mapTheme.ocean) {
          if (l.id === "waterway") {
            l.paint["line-color"] = mapTheme.ocean;
          } else {
            l.paint["fill-color"] = mapTheme.ocean;
          }
        } else if (BORDER_LAYERS.includes(l.id) && mapTheme.border) {
          l.paint["line-color"] = mapTheme.border;
        } else if (ROAD_LAYERS.includes(l.id) && mapTheme.road) {
          l.paint["line-color"] = mapTheme.road;
        } else if (PLACE_LABEL_LAYERS.includes(l.id)) {
          l.paint["text-color"] = placeTextColor;
          l.paint["text-halo-color"] = placeHaloColor;
          l.paint["text-halo-width"] = 1.2;
        } else if (WATER_LABEL_LAYERS.includes(l.id)) {
          l.paint["text-color"] = oceanTextColor;
          l.paint["text-halo-color"] = oceanHaloColor;
          l.paint["text-halo-width"] = 1.0;
        }
      }
    }

    baseStyle.sources[SATELLITE_SOURCE_ID] = {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    };
    baseStyle.sources[NIGHT_SHADE_SOURCE_ID] = {
      type: "geojson",
      data: nightGeoJSON,
    };
    baseStyle.sources[TERMINATOR_LINE_SOURCE_ID] = {
      type: "geojson",
      data: lineGeoJSON,
    };
    baseStyle.sources[CAMERAS_SOURCE_ID] = {
      type: "geojson",
      data: cameraGeoJSON,
      cluster: false,
    };

    // 卫星底图图层（默认根据 baseMapType 决定是否呈现）
    baseStyle.layers.push({
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
      layout: {
        visibility: baseMapType === "sat" ? "visible" : "none",
      },
      paint: {
        "raster-opacity": 0.88,
      },
    });

    // 晨昏线与夜半球遮罩：置于文字注记图层 (symbol) 之下，确保全球各国注记与地名清晰透亮，不受夜半球暗色滤镜遮蔽
    const dayNightLayers = [
      {
        id: NIGHT_SHADE_LAYER_ID,
        type: "fill",
        source: NIGHT_SHADE_SOURCE_ID,
        layout: {
          visibility: dayNightVisible ? "visible" : "none",
        },
        paint: {
          "fill-color": "#000022",
          "fill-opacity": 0.35,
        },
      },
      {
        id: TERMINATOR_LINE_LAYER_ID,
        type: "line",
        source: TERMINATOR_LINE_SOURCE_ID,
        layout: {
          visibility: dayNightVisible ? "visible" : "none",
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 1.5,
          "line-opacity": 0.88,
        },
      },
    ];
    const firstSymbolIdx = baseStyle.layers.findIndex((l) => l.type === "symbol");
    if (firstSymbolIdx >= 0) {
      baseStyle.layers.splice(firstSymbolIdx, 0, ...dayNightLayers);
    } else {
      baseStyle.layers.push(...dayNightLayers);
    }

    const initialCamVis = activeModuleTab === "aviation" ? "none" : "visible";

    // 探头外层阴影圈 (OSIRIS cctv-glow: 黑色柔和底衬)
    baseStyle.layers.push({
      id: CAMERAS_GLOW_LAYER_ID,
      type: "circle",
      source: CAMERAS_SOURCE_ID,
      layout: {
        visibility: initialCamVis,
      },
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

    // 探头核心实体圆点 (OSIRIS cctv-dots: 2.5px 纯黑外圈 + 鲜明科技绿 #00E676 核心)
    baseStyle.layers.push({
      id: CAMERAS_DOTS_LAYER_ID,
      type: "circle",
      source: CAMERAS_SOURCE_ID,
      layout: {
        visibility: initialCamVis,
      },
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
        "circle-color": mapTheme?.dots || "#00E676",
        "circle-opacity": 0.9,
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#000000",
        "circle-stroke-opacity": 0.9,
      },
    });

    // 探头文本路名注记 (OSIRIS cctv-label: 在 zoom >= 10 时优雅淡入)
    baseStyle.layers.push({
      id: CAMERAS_LABEL_LAYER_ID,
      type: "symbol",
      source: CAMERAS_SOURCE_ID,
      minzoom: 10,
      layout: {
        visibility: initialCamVis,
        "text-field": ["get", "name"],
        "text-size": 9.5,
        "text-offset": [0, 1.8],
        "text-max-width": 12,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": mapTheme?.dots || "#00E676",
        "text-halo-color": "#000000",
        "text-halo-width": 1.5,
        "text-opacity": 0.85,
      },
    });

    baseStyle.projection = {
      type: projectionMode === "3d" ? "globe" : "mercator",
    };

    const baseOptions = {
      container,
      style: baseStyle,
      projection: { type: projectionMode === "3d" ? "globe" : "mercator" },
      center: [33.21, 18.21],
      zoom: 2.3,
      minZoom: 1.2,
      maxZoom: 18,
      pitch: 0,
      maxPitch: 85,
      padding: { top: 0, bottom: 34, left: 0, right: 0 },
      attributionControl: {
        compact: true,
        customAttribution: "OSIRIS CCTV © OpenStreetMap / Esri",
      },
    };

    // WebGL 上下文降级策略
    const attributeFallbacks = [
      undefined,
      { powerPreference: "low-power", failIfMajorPerformanceCaveat: false },
      { powerPreference: "low-power", failIfMajorPerformanceCaveat: false, antialias: false },
    ];

    let map;
    for (const canvasContextAttributes of attributeFallbacks) {
      try {
        map = new maplibregl.Map(
          canvasContextAttributes ? { ...baseOptions, canvasContextAttributes } : baseOptions
        );
        break;
      } catch (e) {
        container.innerHTML = "";
        if (canvasContextAttributes === attributeFallbacks[attributeFallbacks.length - 1]) {
          console.error("[LiveCamsMap] Failed to initialize WebGL context:", e);
          return;
        }
      }
    }

    if (!map) return;
    mapRef.current = map;
    setMapInstance(map);
    if (onMapReady) onMapReady(map);
    if (typeof window !== "undefined") {
      window.__maplibreMap = map;
    }

    map.on("error", (e) => {
      if (e.error?.message?.includes("Tile") || e.error?.message?.includes("glyph")) {
        return;
      }
      console.warn("[LiveCamsMap Notice]", e.error?.message || e);
    });

    const setupInteractions = () => {
      if (isLoadedRef.current) return;
      isLoadedRef.current = true;

      // 1.0 应用初始地图配色方案
      if (mapTheme) {
        applyMapTheme(map, mapTheme);
      }

      // 1.1 设置投影为 3D Globe 或 2D Mercator
      try {
        if (map.setProjection) {
          map.setProjection({
            type: projectionMode === "3d" ? "globe" : "mercator",
          });
        }
        if (projectionMode === "3d" && typeof map.setSky === "function") {
          const skyColor = mapTheme?.bg || "#ffffff";
          map.setSky({
            "sky-color": skyColor,
            "sky-horizon-blend": 0.5,
            "horizon-color": skyColor,
            "horizon-fog-blend": 0.3,
            "fog-color": skyColor,
            "fog-ground-blend": 0.05,
          });
        }
      } catch (err) {
        console.warn("[LiveCamsMap] Projection/Sky init notice:", err);
      }

      // 1.2 悬停高科技信息浮标 (Hover Tooltip)
      const hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "livecam-hover-popup",
        offset: 8,
      });

      const handleMouseEnter = (e) => {
        if (activeModuleTabRef.current !== "cameras") return;
        map.getCanvas().style.cursor = "pointer";
        const features = map.queryRenderedFeatures(e.point, {
          layers: [CAMERAS_DOTS_LAYER_ID, CAMERAS_GLOW_LAYER_ID, CAMERAS_LABEL_LAYER_ID],
        });
        if (features && features.length > 0) {
          const p = features[0].properties;
          const coords = features[0].geometry?.coordinates?.slice() || [e.lngLat.lng, e.lngLat.lat];
          const isVideo = p.hasLiveVideo === 1;
          const badgeHtml = isVideo
            ? '<span class="livecam-tip-badge is-video">● LIVE 60FPS</span>'
            : '<span class="livecam-tip-badge">● 快照</span>';

          hoverPopup
            .setLngLat(coords)
            .setHTML(
              `<div class="livecam-tip-content">
                <div class="livecam-tip-header">
                  ${badgeHtml}
                  <span class="livecam-tip-city">${p.city || ""}, ${p.country || ""}</span>
                </div>
                <div class="livecam-tip-name">${p.name || "CCTV Camera"}</div>
              </div>`
            )
            .addTo(map);
        }
      };

      const handleMouseLeave = () => {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
      };

      map.on("mouseenter", CAMERAS_DOTS_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", CAMERAS_DOTS_LAYER_ID, handleMouseLeave);
      map.on("mouseenter", CAMERAS_GLOW_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", CAMERAS_GLOW_LAYER_ID, handleMouseLeave);
      map.on("mouseenter", CAMERAS_LABEL_LAYER_ID, handleMouseEnter);
      map.on("mouseleave", CAMERAS_LABEL_LAYER_ID, handleMouseLeave);

      // 1.3 绑定单探头点击事件 (无论在任何缩放层级，点击任意散点都能立即选中、打开抽屉并飞入)
      const handleSingleCamClick = (e) => {
        if (activeModuleTabRef.current !== "cameras") return;
        const features = map.queryRenderedFeatures(e.point, {
          layers: [CAMERAS_DOTS_LAYER_ID, CAMERAS_GLOW_LAYER_ID, CAMERAS_LABEL_LAYER_ID],
        });
        if (features && features.length > 0) {
          const camId = features[0].properties?.id;
          const targetCam = camerasMapRef.current.get(String(camId));
          if (targetCam) {
            hoverPopup.remove();
            onSelectCameraRef.current?.(targetCam);
            map.flyTo({
              center: [targetCam.lng, targetCam.lat],
              zoom: Math.max(map.getZoom(), 12.5),
              duration: 1000,
            });
          }
        }
      };

      map.on("click", CAMERAS_DOTS_LAYER_ID, handleSingleCamClick);
      map.on("click", CAMERAS_GLOW_LAYER_ID, handleSingleCamClick);
      map.on("click", CAMERAS_LABEL_LAYER_ID, handleSingleCamClick);

      // 1.4 初始化并挂载全球实时航班 WebGL 图层系统
      try {
        initFlightIcons(map);
        initFlightLayers(map);

        const FLIGHT_INTERACTION_LAYERS = [
          "fl-commercial",
          "fl-private",
          "fl-jets",
          "fl-military",
          "flight-selected-dot",
          "flight-selected-glow",
          "fl-callsign-label",
        ];
        FLIGHT_INTERACTION_LAYERS.forEach((layerId) => {
          map.on("mouseenter", layerId, (e) => {
            if (activeModuleTabRef.current !== "aviation") return;
            map.getCanvas().style.cursor = "pointer";
            const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
            if (features && features.length > 0) {
              const p = features[0].properties;
              const coords = features[0].geometry?.coordinates?.slice() || [e.lngLat.lng, e.lngLat.lat];
              const altM = Math.round(p.alt || 0);
              const altFt = Math.round(altM * 3.28084);
              const catColor =
                p.category === "military"
                  ? "#FF3D00"
                  : p.category === "jet"
                  ? "#FF4081"
                  : p.category === "private"
                  ? "#00E676"
                  : "#00E5FF";

              hoverPopup
                .setLngLat(coords)
                .setHTML(
                  `<div class="livecam-tip-content">
                    <div class="livecam-tip-header">
                      <span class="livecam-tip-badge is-video" style="border-color:${catColor};color:${catColor};">✈️ ${p.callsign || "FLIGHT"}</span>
                      <span class="livecam-tip-city">${p.model || "AIRCRAFT"} · ${p.country || ""}</span>
                    </div>
                    <div class="livecam-tip-name" style="font-family:monospace;font-size:11px;color:#38bdf8;margin-top:2px;">
                      ALT: ${altM}m (${altFt.toLocaleString()}ft) · SPD: ${Math.round(p.speed_knots || 0)}kt · HDG: ${Math.round(p.heading || 0)}°
                    </div>
                  </div>`
                )
                .addTo(map);
            }
          });

          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
            hoverPopup.remove();
          });

          map.on("click", layerId, (e) => {
            if (activeModuleTabRef.current !== "aviation") return;
            const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
            if (features && features.length > 0) {
              const p = features[0].properties;
              const icao24 = p?.icao24;
              let targetFlight = icao24 ? flightsMapRef.current.get(String(icao24).toLowerCase()) : null;
              if (!targetFlight && p?.callsign) {
                targetFlight = flightsRef.current.find((f) => f.callsign === p.callsign);
              }
              if (targetFlight) {
                hoverPopup.remove();
                onSelectFlightRef.current?.(targetFlight);
                const curZoom = map.getZoom();
                const targetZoom = curZoom > 8 ? 5.8 : Math.max(curZoom, 5.5);
                map.flyTo({
                  center: [targetFlight.lng, targetFlight.lat],
                  zoom: targetZoom,
                  duration: 900,
                });
              }
            }
          });
        });

        // 刷新初始航班数据
        if (flightsRef.current && flightsRef.current.length > 0) {
          updateFlightsSource(map, flightsRef.current);
        }

        // 根据当前最新 activeModuleTabRef 设置图层可见性
        const isAviation = activeModuleTabRef.current === "aviation";
        setFlightLayersVisibility(map, isAviation);
        updateSelectedFlight(
          map,
          isAviation ? selectedFlightRef.current : null,
          isAviation ? flightRouteDataRef.current : null,
          isAviation
        );
        const camVis = isAviation ? "none" : "visible";
        [CAMERAS_DOTS_LAYER_ID, CAMERAS_GLOW_LAYER_ID, CAMERAS_LABEL_LAYER_ID].forEach((cid) => {
          if (map.getLayer(cid)) map.setLayoutProperty(cid, "visibility", camVis);
        });
      } catch (err) {
        console.warn("[LiveCamsMap] Flight layers init notice:", err);
      }

      // 无论首屏加载先后，确保最新探头数据全量灌注进 WebGL 渲染管线
      if (camerasRef.current && camerasRef.current.length > 0) {
        updateCameraData(map, camerasRef.current);
      }

      // 尺寸初次测量与渐进式校准 (仅在初始化时执行一次)
      map.resize();
      setTimeout(() => map.resize(), 100);
      setTimeout(() => map.resize(), 300);
    };

    if (map.isStyleLoaded() || map.loaded()) {
      setupInteractions();
    } else {
      map.once("style.load", setupInteractions);
      map.once("load", setupInteractions);
    }

    // 2. 容器 Resize 监听
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    resizeObserver.observe(container);

    // 3. 晨昏线定时更新 (每 5 分钟)
    const dayNightTimer = setInterval(() => {
      if (mapRef.current && isLoadedRef.current) {
        updateDayNightData(mapRef.current, new Date());
      }
    }, 5 * 60 * 1000);

    // 4. 页面切回前台时唤醒更新
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mapRef.current && isLoadedRef.current) {
        updateDayNightData(mapRef.current, new Date());
        mapRef.current.resize();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(dayNightTimer);
      resizeObserver.disconnect();
      try {
        map.remove();
      } catch (e) {}
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, []);

  // 2. 投影模式切换 (3D Globe vs 2D Mercator)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    map.setProjection({
      type: projectionMode === "3d" ? "globe" : "mercator",
    });

    if (projectionMode === "3d") {
      if (typeof map.setSky === "function") {
        const skyColor = mapTheme?.bg || "#ffffff";
        map.setSky({
          "sky-color": skyColor,
          "sky-horizon-blend": 0.5,
          "horizon-color": skyColor,
          "horizon-fog-blend": 0.3,
          "fog-color": skyColor,
          "fog-ground-blend": 0.05,
        });
      }
    } else {
      map.easeTo({ pitch: 0, duration: 600 });
    }
  }, [projectionMode]);

  // 3. 底图切换 (MAP vs SAT)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    if (map.getLayer(SATELLITE_LAYER_ID)) {
      map.setLayoutProperty(
        SATELLITE_LAYER_ID,
        "visibility",
        baseMapType === "sat" ? "visible" : "none"
      );
    }
  }, [baseMapType]);

  // 4. 晨昏线显隐切换
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;
    setDayNightVisibility(map, dayNightVisible);
  }, [dayNightVisible]);

  // 5. 摄像头数据过滤热更新
  useEffect(() => {
    camerasRef.current = cameras;
    const map = mapRef.current;
    if (!map) return;
    if (isLoadedRef.current || map.isStyleLoaded()) {
      updateCameraData(map, cameras);
    }
  }, [cameras]);

  // 6. 地图多样性配色热更新 (零闪烁、16ms WebGL 原生无缝重绘)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapTheme) return;
    if (isLoadedRef.current || map.isStyleLoaded()) {
      applyMapTheme(map, mapTheme);
    }
  }, [mapTheme]);

  // 7. 重置全球视角 (复位至初始完美地球姿态)
  useEffect(() => {
    if (!resetTrigger) return;
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    map.flyTo({
      center: [33.21, 18.21],
      zoom: 2.3,
      pitch: 0,
      bearing: 0,
      padding: { top: 0, bottom: 34, left: 0, right: 0 },
      duration: 1200,
    });
  }, [resetTrigger, projectionMode]);

  const hasInitialFlownRef = useRef(false);

  // 7. 当外部选中某摄像头时飞过去 (初始加载跳过自动下潜放大，保持 3D 地球宏观全貌；后续用户点击或按“下一个”时飞过去)
  useEffect(() => {
    if (!selectedCamera) return;
    const map = mapRef.current;
    if (!map || !isLoadedRef.current) return;

    if (!hasInitialFlownRef.current) {
      hasInitialFlownRef.current = true;
      return;
    }

    map.flyTo({
      center: [selectedCamera.lng, selectedCamera.lat],
      zoom: Math.max(map.getZoom(), 12.5),
      duration: 1000,
      essential: true,
    });
  }, [selectedCamera]);

  // 8. 实时子功能选项卡切换：探头图层 vs 航班图层显隐协同切换
  useEffect(() => {
    activeModuleTabRef.current = activeModuleTab;
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      const isAviation = activeModuleTab === "aviation";
      setFlightLayersVisibility(map, isAviation);
      updateSelectedFlight(
        map,
        isAviation ? selectedFlightRef.current : null,
        isAviation ? flightRouteDataRef.current : null,
        isAviation
      );

      const camVis = isAviation ? "none" : "visible";
      [CAMERAS_DOTS_LAYER_ID, CAMERAS_GLOW_LAYER_ID, CAMERAS_LABEL_LAYER_ID].forEach((cid) => {
        if (map.getLayer(cid)) {
          map.setLayoutProperty(cid, "visibility", camVis);
        }
      });

      // 切换选项卡时立即清除遗留的悬浮提示弹窗
      const popups = document.querySelectorAll(".livecam-hover-popup");
      popups.forEach((p) => p.remove());
    };

    if (isLoadedRef.current || map.isStyleLoaded()) {
      applyVisibility();
    } else {
      map.once("styledata", applyVisibility);
    }
  }, [activeModuleTab]);

  // 9. 航班数据更新推送进 WebGL 渲染管线
  useEffect(() => {
    flightsRef.current = flights;
    const map = mapRef.current;
    if (!map) return;
    if (isLoadedRef.current || map.isStyleLoaded()) {
      updateFlightsSource(map, flights);
    }
  }, [flights]);

  // 10. 选中航班高亮与其起降大圆航线弧线更新
  useEffect(() => {
    selectedFlightRef.current = selectedFlight;
    flightRouteDataRef.current = flightRouteData;
    const map = mapRef.current;
    if (!map) return;
    const isAviation = activeModuleTab === "aviation";
    if (isLoadedRef.current || map.isStyleLoaded()) {
      updateSelectedFlight(
        map,
        isAviation ? selectedFlight : null,
        isAviation ? flightRouteData : null,
        isAviation
      );
    }
  }, [selectedFlight, flightRouteData, activeModuleTab]);

  return (
    <div className="livecam-map-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapContainerRef}
        className="livecam-map-canvas"
        style={{ backgroundColor: mapTheme?.bg || "#04040a" }}
      />
      {activeModuleTab === "cameras" && (
        <CctvPreviews
          map={mapInstance}
          mapRef={mapRef}
          cameras={cameras}
          selectedCameraId={selectedCamera?.id}
          onSelectCamera={onSelectCamera}
        />
      )}
    </div>
  );
}
