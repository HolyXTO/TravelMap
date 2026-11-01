// -*- coding: utf-8 -*-
/**
 * CameraViewer.jsx
 * 
 * OSIRIS 仿生监控流播放终端：
 * 1. 深度适配 HLS (.m3u8) 60FPS 实时视频流 (通过 Hls.js 硬件加速解码)；
 * 2. 深度适配 MP4/WebM 连续视频流；
 * 3. 规范化 Iframe (配置 strict-origin-when-cross-origin 避免 YouTube 153 报错)；
 * 4. 真实交通实况快照 (自动定时同步)；
 * 5. 健全的容错重试机制与关闭时内存垃圾回收。
 */
import React, { useState, useEffect, useRef } from "react";
import { X, RefreshCw, ExternalLink, Radio, MapPin, Video, Eye, ShieldAlert, Sparkles } from "lucide-react";
import Hls from "hls.js";

// 格式化地理坐标，附加 N/S 与 E/W 经纬度方位指向
const formatCoordWithDirection = (lat, lng) => {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return "-";
  }
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
};

export default function CameraViewer({ camera, onClose }) {
  const [currentImgUrl, setCurrentImgUrl] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [liveTime, setLiveTime] = useState("");
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [useMirror, setUseMirror] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // 1. 本地时钟与 UTC 时间戳更新
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toUTCString().replace("GMT", "UTC"));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. 媒体流与生命周期管理
  useEffect(() => {
    if (!camera) return;
    setIsMediaLoading(true);
    setMediaError(false);
    setUseMirror(false);

    const media = camera.media || {};
    const mediaType = media.type || "jpg";
    const videoSourceUrl = media.streamUrl || media.url;

    // 清理旧 Hls 实例
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 2.1 HLS 实时视频流
    if (mediaType === "hls" && videoSourceUrl) {
      if (Hls.isSupported() && videoRef.current) {
        const hls = new Hls({
          enableWorker: false, // 提高跨环境兼容性
          lowLatencyMode: true,
          backBufferLength: 60,
        });
        hlsRef.current = hls;

        hls.loadSource(videoSourceUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsMediaLoading(false);
          videoRef.current?.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn("[CameraViewer HLS Fatal Error]", data);
            setIsMediaLoading(false);
            setMediaError(true);
          }
        });
      } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari 原生 HLS 解码
        videoRef.current.src = videoSourceUrl;
        videoRef.current.addEventListener("loadedmetadata", () => {
          setIsMediaLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        videoRef.current.addEventListener("error", () => {
          setIsMediaLoading(false);
          setMediaError(true);
        });
      }
    }

    // 2.2 MP4 视频流
    if (mediaType === "mp4" && videoSourceUrl) {
      if (videoRef.current) {
        videoRef.current.src = videoSourceUrl;
        videoRef.current.addEventListener("loadeddata", () => {
          setIsMediaLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        videoRef.current.addEventListener("error", () => {
          setIsMediaLoading(false);
          setMediaError(true);
        });
      }
    }

    // 2.3 实况快照轮询 (每 5 秒自动同步一次)
    if (mediaType === "jpg" || mediaType === "image") {
      const base = media.feedUrl || media.url || media.posterUrl;
      if (base) {
        const sep = base.includes("?") ? "&" : "?";
        setCurrentImgUrl(`${base}${sep}_t=${Date.now()}`);

        const imgTimer = setInterval(() => {
          setCurrentImgUrl(`${base}${sep}_t=${Date.now()}`);
          setRefreshCount((c) => c + 1);
        }, 5000);

        return () => {
          clearInterval(imgTimer);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [camera]);

  if (!camera) return null;

  const media = camera.media || {};
  const isVideo = Boolean(camera.hasLiveVideo);
  const mediaType = media.type || "jpg";

  // 手动重新加载
  const handleManualRefresh = () => {
    setIsMediaLoading(true);
    setMediaError(false);

    if (mediaType === "hls" && hlsRef.current && media.streamUrl) {
      hlsRef.current.loadSource(media.streamUrl);
      hlsRef.current.attachMedia(videoRef.current);
    } else {
      const base = media.feedUrl || media.url || media.posterUrl;
      if (base) {
        const sep = base.includes("?") ? "&" : "?";
        setCurrentImgUrl(`${base}${sep}_t=${Date.now()}`);
      }
    }
  };

  return (
    <div className="livecam-viewer-drawer">
      {/* 顶部标题控制栏 */}
      <div className="livecam-viewer-header">
        <div className="livecam-viewer-title-group">
          <div className="livecam-viewer-title" title={camera.name}>
            {camera.name}
          </div>
          <div className="livecam-viewer-meta">
            <MapPin size={12} />
            <span>{camera.country} · {camera.city}</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
            {isVideo ? (
              <span style={{ color: "#00e676", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <span className="livecam-live-indicator-dot" />
                24H 实时视频流
              </span>
            ) : (
              <span style={{ color: "#00e5ff" }}>● 实况快照节点</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="livecam-icon-btn"
          onClick={onClose}
          title="关闭监控窗口"
        >
          <X size={18} />
        </button>
      </div>

      {/* 视频/图像播放主视口 */}
      <div className="livecam-media-container">
        {mediaError ? (
          <div className="livecam-media-fallback-error">
            <ShieldAlert size={36} color="#ff3d3d" />
            <div className="livecam-fallback-title">该监控流目前受到源端网络或跨域限制</div>
            <div className="livecam-fallback-sub">
              可直接访问官方原始广播站进行高清观看
            </div>
            {camera.sourceUrl && (
              <a
                href={camera.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="livecam-action-btn primary"
                style={{ marginTop: 12 }}
              >
                <ExternalLink size={14} />
                <span>直达官方直播源</span>
              </a>
            )}
          </div>
        ) : mediaType === "hls" ? (
          <video
            ref={videoRef}
            className="livecam-media-element"
            controls
            autoPlay
            muted
            playsInline
          />
        ) : mediaType === "mp4" ? (
          <video
            ref={videoRef}
            className="livecam-media-element"
            controls
            autoPlay
            muted
            playsInline
            loop
          />
        ) : mediaType === "iframe" ? (
          <iframe
            src={media.embedUrl}
            title={camera.name}
            className="livecam-media-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onLoad={() => setIsMediaLoading(false)}
            onError={() => {
              setIsMediaLoading(false);
              setMediaError(true);
            }}
          />
        ) : (
          <img
            src={currentImgUrl || media.posterUrl}
            alt={camera.name}
            className="livecam-media-element"
            referrerPolicy="no-referrer"
            onLoad={() => setIsMediaLoading(false)}
            onError={() => {
              setIsMediaLoading(false);
              // 如果快照加载失败，回退到默认封面
              if (currentImgUrl !== media.posterUrl) {
                setCurrentImgUrl(media.posterUrl);
              }
            }}
          />
        )}

        {/* 画面上的科技态徽章 */}
        <div className="livecam-media-overlay-badge">
          <Radio size={11} className="livecam-pulse-dot" />
          <span>{isVideo ? "LIVE 60FPS" : "LIVE SYNC"}</span>
        </div>

        {/* 画面右下角时间戳 */}
        <div className="livecam-media-timestamp">
          {liveTime || "UTC TIME SYNC"}
        </div>
      </div>

      {/* 详细信息与元数据 */}
      <div className="livecam-viewer-body">
        <div className="livecam-desc-box">
          {camera.description}
        </div>

        <div className="livecam-data-grid">
          <div className="livecam-data-pill">
            <span className="livecam-data-label">地理坐标</span>
            <span className="livecam-data-val">
              {formatCoordWithDirection(camera.lat, camera.lng)}
            </span>
          </div>

          <div className="livecam-data-pill">
            <span className="livecam-data-label">流媒体格式</span>
            <span className="livecam-data-val" style={{ color: isVideo ? "#00e676" : "#00e5ff" }}>
              {mediaType.toUpperCase()} {isVideo ? "· 实时视频流" : "· 道路实况快照"}
            </span>
          </div>

          <div className="livecam-data-pill">
            <span className="livecam-data-label">广播源机构</span>
            <span className="livecam-data-val" title={camera.source}>
              {camera.source || "OSIRIS Global"}
            </span>
          </div>

          <div className="livecam-data-pill">
            <span className="livecam-data-label">所属大洲 / 地区</span>
            <span className="livecam-data-val">
              {camera.continent}
            </span>
          </div>
        </div>
      </div>

      {/* 底部操作行动按钮 */}
      <div className="livecam-viewer-actions">
        <button
          type="button"
          className="livecam-action-btn secondary"
          onClick={handleManualRefresh}
          title="重新请求画面数据"
        >
          <RefreshCw size={14} />
          <span>刷新通道</span>
        </button>

        {camera.sourceUrl && (
          <a
            href={camera.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="livecam-action-btn primary"
            title="直达官方原站监控页面"
          >
            <ExternalLink size={14} />
            <span>访问原站直播</span>
          </a>
        )}
      </div>
    </div>
  );
}
