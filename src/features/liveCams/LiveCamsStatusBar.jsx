// -*- coding: utf-8 -*-
/**
 * LiveCamsStatusBar.jsx
 * 
 * OSIRIS 风格底部极简半透明状态栏：
 * 实时展示相机视心经纬度、地图缩放层级、3D/2D 投影标识、UTC 时间与开放底图署名。
 */
import React, { useState, useEffect } from "react";
import { Compass, Eye, Clock, Layers } from "lucide-react";

export default function LiveCamsStatusBar({
  map,
  centerCoords = { lat: 0, lng: 15 },
  zoom = 1.8,
  projectionMode = "3d",
  baseMapType = "dark",
}) {
  const [coords, setCoords] = useState(centerCoords);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [utcTime, setUtcTime] = useState("");

  useEffect(() => {
    if (!map) return;
    let rafId = null;

    const handleUpdate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          const c = map.getCenter();
          const z = map.getZoom();
          setCoords({ lat: c.lat, lng: c.lng });
          setCurrentZoom(z);
        } catch {}
      });
    };

    handleUpdate();
    map.on("move", handleUpdate);
    map.on("zoom", handleUpdate);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      map.off("move", handleUpdate);
      map.off("zoom", handleUpdate);
    };
  }, [map]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace("GMT", "UTC"));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const latStr = `${Math.abs(coords.lat).toFixed(2)}°${coords.lat >= 0 ? "N" : "S"}`;
  const lngStr = `${Math.abs(coords.lng).toFixed(2)}°${coords.lng >= 0 ? "E" : "W"}`;

  return (
    <div className="livecam-statusbar">
      <div className="livecam-status-left">
        <div className="livecam-status-item">
          <Compass size={13} color="#00e5ff" />
          <span>{latStr}, {lngStr}</span>
        </div>
        <div className="livecam-status-item">
          <Eye size={13} color="#d4af37" />
          <span>ZOOM {currentZoom.toFixed(1)}</span>
        </div>
        <div className="livecam-status-item">
          <Layers size={13} color="#00e676" />
          <span>{projectionMode.toUpperCase()} · {baseMapType.toUpperCase()}</span>
        </div>
      </div>

      <div className="livecam-status-right">
        <div className="livecam-status-item">
          <Clock size={13} />
          <span>{utcTime}</span>
        </div>
        <div className="livecam-status-item" style={{ opacity: 0.65 }}>
          <span>© CARTO / OSM / Open Data</span>
        </div>
      </div>
    </div>
  );
}
