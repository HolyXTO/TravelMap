/**
 * OSIRIS 同款全球实时航班渲染图层系统 (Flight Layers)
 * 采用 WebGL Symbol Layer 硬件级加速渲染万架航班，支持 3D 地球与 2D 平面自适应航向旋转。
 */

const EMPTY_FC = { type: "FeatureCollection", features: [] };

export const FLIGHT_LAYER_IDS = [
  "fl-commercial",
  "fl-private",
  "fl-jets",
  "fl-military",
  "fl-callsign-label",
  "flight-selected-glow",
  "flight-selected-dot",
  "flight-route-glow",
  "flight-route-core",
  "flight-airports-glow",
  "flight-airports-dot",
  "flight-airports-label",
];

/**
 * 注册 OSIRIS 经典飞机矢量轮廓 Canvas 纹理
 */
export function initFlightIcons(map) {
  if (!map) return;

  const createPlaneIcon = (id, color, size = 28) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;

    // 绘制微光外圈底影，提升在明暗底图上的高辨识度
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // OSIRIS 原生精密飞机多边形拓扑
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.42); // 尖机头
    ctx.lineTo(cx - size * 0.11, cy + size * 0.08); // 左翼前缘
    ctx.lineTo(cx - size * 0.44, cy + size * 0.22); // 左翼梢
    ctx.lineTo(cx - size * 0.44, cy + size * 0.3); // 左翼后缘外侧
    ctx.lineTo(cx - size * 0.11, cy + size * 0.16); // 左翼根
    ctx.lineTo(cx - size * 0.06, cy + size * 0.32); // 机身中段
    ctx.lineTo(cx - size * 0.22, cy + size * 0.44); // 左水平尾翼梢
    ctx.lineTo(cx - size * 0.22, cy + size * 0.48); // 左尾翼后缘
    ctx.lineTo(cx, cy + size * 0.38); // 尾锥
    ctx.lineTo(cx + size * 0.22, cy + size * 0.48); // 右尾翼后缘
    ctx.lineTo(cx + size * 0.22, cy + size * 0.44); // 右水平尾翼梢
    ctx.lineTo(cx + size * 0.06, cy + size * 0.32); // 机身中段
    ctx.lineTo(cx + size * 0.11, cy + size * 0.16); // 右翼根
    ctx.lineTo(cx + size * 0.44, cy + size * 0.3); // 右翼后缘外侧
    ctx.lineTo(cx + size * 0.44, cy + size * 0.22); // 右翼梢
    ctx.lineTo(cx + size * 0.11, cy + size * 0.08); // 右翼前缘
    ctx.closePath();
    ctx.fill();

    const imgData = ctx.getImageData(0, 0, size, size);
    map.addImage(id, { width: size, height: size, data: new Uint8Array(imgData.data) });
  };

  // 1. 商业客运/货运航班：OSIRIS 极光青蓝
  createPlaneIcon("plane-cyan", "#00E5FF", 28);
  // 2. 私人航空器：OSIRIS 薄荷嫩绿
  createPlaneIcon("plane-green", "#00E676", 28);
  // 3. 公务喷气机：OSIRIS 亮粉/炽橙
  createPlaneIcon("plane-pink", "#FF4081", 28);
  // 4. 军用航空器：OSIRIS 战术绯红
  createPlaneIcon("plane-red", "#FF3D00", 28);
  // 5. 选中高亮追踪飞机：耀眼金黄
  createPlaneIcon("plane-gold", "#FFD700", 32);
}

/**
 * 初始化航班数据源与矢量图层
 */
export function initFlightLayers(map) {
  if (!map) return;

  // 1. 注册基础数据源
  if (!map.getSource("flights-source")) {
    map.addSource("flights-source", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("flight-selected-source")) {
    map.addSource("flight-selected-source", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("flight-route-source")) {
    map.addSource("flight-route-source", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("flight-airports-source")) {
    map.addSource("flight-airports-source", { type: "geojson", data: EMPTY_FC });
  }

  // 2. 四大类别飞机渲染图层 (WebGL Symbol，支持万级流畅平移缩放)
  // 先将全量常规飞机图层加入底端，确保后续的选中航线与起降机场在飞机集群上方醒目渲染
  const categoryLayers = [
    { id: "fl-commercial", filter: ["==", ["get", "category"], "commercial"], icon: "plane-cyan" },
    { id: "fl-private", filter: ["==", ["get", "category"], "private"], icon: "plane-green" },
    { id: "fl-jets", filter: ["==", ["get", "category"], "jet"], icon: "plane-pink" },
    { id: "fl-military", filter: ["==", ["get", "category"], "military"], icon: "plane-red" },
  ];

  categoryLayers.forEach((item) => {
    if (!map.getLayer(item.id)) {
      map.addLayer({
        id: item.id,
        type: "symbol",
        source: "flights-source",
        filter: item.filter,
        layout: {
          "icon-image": item.icon,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1, 0.45,
            3, 0.6,
            6, 0.82,
            10, 1.05,
          ],
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": 0.9,
        },
      });
    }
  });

  // 3. 航班呼号注记 (在 zoom >= 7.5 时淡入呈现，避免全球缩放时文字堆叠)
  if (!map.getLayer("fl-callsign-label")) {
    map.addLayer({
      id: "fl-callsign-label",
      type: "symbol",
      source: "flights-source",
      minzoom: 7.5,
      layout: {
        "text-field": ["get", "callsign"],
        "text-size": 10,
        "text-font": ["Open Sans Bold"],
        "text-offset": [0, 1.5],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#E0E0E0",
        "text-halo-color": "#05070E",
        "text-halo-width": 1.5,
        "text-opacity": 0.9,
      },
    });
  }

  // 4. 航线弧线图层 (默认置于飞机上方渲染，缩小地球时大圆航线始终醒目可见)
  if (!map.getLayer("flight-route-glow")) {
    map.addLayer({
      id: "flight-route-glow",
      type: "line",
      source: "flight-route-source",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#00E5FF",
        "line-width": 7,
        "line-opacity": 0.5,
        "line-blur": 2.5,
      },
    });
  }
  if (!map.getLayer("flight-route-core")) {
    map.addLayer({
      id: "flight-route-core",
      type: "line",
      source: "flight-route-source",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#FFFFFF",
        "line-width": 2.8,
        "line-opacity": 1.0,
      },
    });
  }

  // 5. 起降机场图层
  if (!map.getLayer("flight-airports-glow")) {
    map.addLayer({
      id: "flight-airports-glow",
      type: "circle",
      source: "flight-airports-source",
      paint: {
        "circle-radius": 14,
        "circle-color": "#00E5FF",
        "circle-opacity": 0.28,
        "circle-blur": 0.8,
      },
    });
  }
  if (!map.getLayer("flight-airports-dot")) {
    map.addLayer({
      id: "flight-airports-dot",
      type: "circle",
      source: "flight-airports-source",
      paint: {
        "circle-radius": 5.5,
        "circle-color": "#FFFFFF",
        "circle-stroke-width": 2.2,
        "circle-stroke-color": "#00E5FF",
      },
    });
  }
  if (!map.getLayer("flight-airports-label")) {
    map.addLayer({
      id: "flight-airports-label",
      type: "symbol",
      source: "flight-airports-source",
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-font": ["Open Sans Bold"],
        "text-offset": [0, 1.6],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#FFFFFF",
        "text-halo-color": "#000000",
        "text-halo-width": 2,
      },
    });
  }

  // 6. 当前选中飞机的战术锁定光圈
  if (!map.getLayer("flight-selected-glow")) {
    map.addLayer({
      id: "flight-selected-glow",
      type: "circle",
      source: "flight-selected-source",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 14,
          5, 20,
          10, 26,
        ],
        "circle-color": "#FFD700",
        "circle-opacity": 0.25,
        "circle-blur": 0.8,
      },
    });
  }
  if (!map.getLayer("flight-selected-dot")) {
    map.addLayer({
      id: "flight-selected-dot",
      type: "symbol",
      source: "flight-selected-source",
      layout: {
        "icon-image": "plane-gold",
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 0.65,
          3, 0.85,
          6, 1.1,
          10, 1.35,
        ],
        "icon-rotate": ["get", "heading"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": 1.0,
      },
    });
  }
}

/**
 * 刷新全量航班 GeoJSON Source
 */
export function updateFlightsSource(map, flights) {
  if (!map) return;
  const src = map.getSource("flights-source");
  if (!src) return;

  if (!flights || flights.length === 0) {
    src.setData(EMPTY_FC);
    return;
  }

  const features = flights.map((f) => ({
    type: "Feature",
    properties: {
      icao24: f.icao24,
      callsign: f.callsign,
      category: f.category,
      heading: f.heading || 0,
      alt: f.alt || 0,
      speed_knots: f.speed_knots || 0,
      model: f.model || "Unknown",
      country: f.country || "",
      registration: f.registration || "",
      squawk: f.squawk || "",
    },
    geometry: {
      type: "Point",
      coordinates: [f.lng, f.lat],
    },
  }));

  src.setData({
    type: "FeatureCollection",
    features,
  });
}

/**
 * 更新选中飞机的战术高亮与起降航线
 */
export function updateSelectedFlight(map, selectedFlight, routeData) {
  if (!map) return;

  // 1. 选中飞机高亮
  const selSrc = map.getSource("flight-selected-source");
  if (selSrc) {
    if (selectedFlight && Number.isFinite(selectedFlight.lat) && Number.isFinite(selectedFlight.lng)) {
      selSrc.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              heading: selectedFlight.heading || 0,
              callsign: selectedFlight.callsign,
            },
            geometry: {
              type: "Point",
              coordinates: [selectedFlight.lng, selectedFlight.lat],
            },
          },
        ],
      });
      if (map.getLayer("flight-selected-glow")) map.setLayoutProperty("flight-selected-glow", "visibility", "visible");
      if (map.getLayer("flight-selected-dot")) map.setLayoutProperty("flight-selected-dot", "visibility", "visible");
    } else {
      selSrc.setData(EMPTY_FC);
    }
  }

  // 2. 航线弧线
  const routeSrc = map.getSource("flight-route-source");
  if (routeSrc) {
    if (routeData && routeData.found && Array.isArray(routeData.geodesicPoints) && routeData.geodesicPoints.length > 1) {
      routeSrc.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { callsign: routeData.callsign },
            geometry: {
              type: "LineString",
              coordinates: routeData.geodesicPoints,
            },
          },
        ],
      });
      if (map.getLayer("flight-route-glow")) map.setLayoutProperty("flight-route-glow", "visibility", "visible");
      if (map.getLayer("flight-route-core")) map.setLayoutProperty("flight-route-core", "visibility", "visible");
    } else {
      routeSrc.setData(EMPTY_FC);
    }
  }

  // 3. 起降机场标注
  const aptSrc = map.getSource("flight-airports-source");
  if (aptSrc) {
    if (routeData && routeData.found && routeData.origin && routeData.destination) {
      const o = routeData.origin;
      const d = routeData.destination;
      const features = [
        {
          type: "Feature",
          properties: { label: `DEP: ${o.iata || o.icao} (${o.city || ""})` },
          geometry: { type: "Point", coordinates: [o.lng, o.lat] },
        },
        {
          type: "Feature",
          properties: { label: `ARR: ${d.iata || d.icao} (${d.city || ""})` },
          geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        },
      ];
      aptSrc.setData({ type: "FeatureCollection", features });
      if (map.getLayer("flight-airports-glow")) map.setLayoutProperty("flight-airports-glow", "visibility", "visible");
      if (map.getLayer("flight-airports-dot")) map.setLayoutProperty("flight-airports-dot", "visibility", "visible");
      if (map.getLayer("flight-airports-label")) map.setLayoutProperty("flight-airports-label", "visibility", "visible");
    } else {
      aptSrc.setData(EMPTY_FC);
    }
  }

  // 4. 确保航线弧线、起降机场与选中飞机标记始终绘制在普通飞机图层上层 (保证缩放地球时不被密集机群遮挡)
  const topLayers = [
    "flight-route-glow",
    "flight-route-core",
    "flight-airports-glow",
    "flight-airports-dot",
    "flight-airports-label",
    "flight-selected-glow",
    "flight-selected-dot",
  ];
  topLayers.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId);
    }
  });
}

/**
 * 批量切换航班图层显隐
 */
export function setFlightLayersVisibility(map, visible) {
  if (!map) return;
  const val = visible ? "visible" : "none";
  FLIGHT_LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", val);
    }
  });
}
