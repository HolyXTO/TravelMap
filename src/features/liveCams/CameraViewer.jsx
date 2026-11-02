// -*- coding: utf-8 -*-
/**
 * CameraViewer.jsx
 * 
 * OSIRIS 仿生监控流播放终端：
 * 1. 深度适配 HLS (.m3u8) 60FPS 实时视频流 (通过 Hls.js 硬件加速解码)；
 * 2. 深度适配 MP4 实况动态切片 (采用后台隐式双缓冲无感更新机制，保障零卡顿、零闪烁平滑过渡)；
 * 3. 规范化 Iframe (配置 strict-origin-when-cross-origin 避免 YouTube 153 报错)；
 * 4. 真实交通实况快照 (自动定时同步)；
 * 5. UI 标识严格分级 (24H 实时视频流 / 实况动态切片 / 实况快照节点)；
 * 6. 底部三按钮交互：刷新通道、访问原站、下一个探头 (安全越界闭环循环)。
 */
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  RefreshCw,
  ExternalLink,
  Radio,
  MapPin,
  Video,
  Eye,
  ShieldAlert,
  Sparkles,
  SkipForward,
} from "lucide-react";
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

export default function CameraViewer({ camera, onClose, onNextCamera }) {
  const [currentImgUrl, setCurrentImgUrl] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [liveTime, setLiveTime] = useState("");
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const pendingUpdateUrlRef = useRef(null);

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
    pendingUpdateUrlRef.current = null;

    const media = camera.media || {};
    const mediaType = media.type || "jpg";
    const videoSourceUrl = media.streamUrl || media.url;

    // 清理旧 Hls 实例
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let mp4Timer = null;

    // 2.0 播放器假死保护 (Watchdog)：若 HLS 或 MP4 视频等待 7 秒仍处于 0:00 无法播放，自动降级为封面快照或提示
    const stallWatchdog = setTimeout(() => {
      const v = videoRef.current;
      if (v && v.currentTime === 0 && (v.paused || v.readyState < 2)) {
        console.warn("[CameraViewer] Stream stalled at 0:00 after 7s timeout");
        if (media.posterUrl && media.posterUrl !== currentImgUrl) {
          setCurrentImgUrl(media.posterUrl);
          setIsMediaLoading(false);
        } else {
          setIsMediaLoading(false);
          setMediaError(true);
        }
      }
    }, 7000);

    const handleClearWatchdog = () => clearTimeout(stallWatchdog);
    if (videoRef.current) {
      videoRef.current.addEventListener("playing", handleClearWatchdog);
      videoRef.current.addEventListener("timeupdate", handleClearWatchdog);
    }

    // 2.1 HLS 实时视频流
    if (mediaType === "hls" && videoSourceUrl) {
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
      }

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
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.defaultMuted = true;
            videoRef.current.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("[CameraViewer HLS Network Error] Attempting recovery...", data);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("[CameraViewer HLS Media Error] Attempting recovery...", data);
                hls.recoverMediaError();
                break;
              default:
                console.warn("[CameraViewer HLS Fatal Error]", data);
                // 若备用快照图存在，平滑降级为展示快照，避免直接展示红盾阻断
                if (media.feedUrl || media.posterUrl) {
                  setCurrentImgUrl(media.feedUrl || media.posterUrl);
                  setIsMediaLoading(false);
                  setMediaError(false);
                } else {
                  setIsMediaLoading(false);
                  setMediaError(true);
                }
                hls.destroy();
                break;
            }
          }
        });
      } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari 原生 HLS 解码
        videoRef.current.muted = true;
        videoRef.current.src = videoSourceUrl;
        videoRef.current.addEventListener("loadedmetadata", () => {
          setIsMediaLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        videoRef.current.addEventListener("error", () => {
          if (media.feedUrl || media.posterUrl) {
            setCurrentImgUrl(media.feedUrl || media.posterUrl);
            setIsMediaLoading(false);
          } else {
            setIsMediaLoading(false);
            setMediaError(true);
          }
        });
      }
    }

    // 2.2 MP4 实况动态切片 (结合双缓冲后台静默探测更新)
    if (mediaType === "mp4" && videoSourceUrl) {
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
        videoRef.current.src = videoSourceUrl;
        videoRef.current.addEventListener("loadeddata", () => {
          setIsMediaLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        videoRef.current.addEventListener("error", () => {
          if (media.feedUrl || media.posterUrl) {
            setCurrentImgUrl(media.feedUrl || media.posterUrl);
            setIsMediaLoading(false);
          } else {
            setIsMediaLoading(false);
            setMediaError(true);
          }
        });

        // 监听播放进度：在当前切片播放到末尾的瞬间，若后台已预备好新切片，无感切换
        const handleTimeUpdate = () => {
          const v = videoRef.current;
          if (!v || !pendingUpdateUrlRef.current) return;
          if (v.duration && v.currentTime >= v.duration - 0.25) {
            const nextSrc = pendingUpdateUrlRef.current;
            pendingUpdateUrlRef.current = null;
            v.src = nextSrc;
            v.play().catch(() => {});
          }
        };
        videoRef.current.addEventListener("timeupdate", handleTimeUpdate);

        // 每隔 60 秒在后台静默预缓冲可能生成的新版视频切片 (不打断当前正在播放的画面)
        mp4Timer = setInterval(() => {
          const sep = videoSourceUrl.includes("?") ? "&" : "?";
          const probeUrl = `${videoSourceUrl}${sep}_t=${Date.now()}`;
          const preloadVideo = document.createElement("video");
          preloadVideo.preload = "auto";
          preloadVideo.muted = true;
          preloadVideo.src = probeUrl;
          preloadVideo.oncanplay = () => {
            // 后台预加载完成，标记在下一个循环点平滑接替
            pendingUpdateUrlRef.current = probeUrl;
          };
        }, 60000);
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
          clearTimeout(stallWatchdog);
          clearInterval(imgTimer);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      }
    }

    // 2.4 MJPEG 实时连续视频流 (单次挂载原生流地址，由浏览器内部流水线实时刷新，严禁定时器打断)
    if (mediaType === "mjpeg") {
      const stream = media.streamUrl || media.feedUrl || media.url;
      if (stream) {
        setCurrentImgUrl(stream);
        setIsMediaLoading(false);
      }
    }

    return () => {
      clearTimeout(stallWatchdog);
      if (mp4Timer) clearInterval(mp4Timer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [camera]);

  if (!camera) return null;

  const media = camera.media || {};
  const mediaType = media.type || "jpg";

  // UI 严格三级分级逻辑：
  // 1. 连续视频流 (HLS / YouTube / iframe / MJPEG)
  // 2. 动态切片 (MP4)
  // 3. 静态快照 (JPG / image)
  const isHlsOrLive =
    mediaType === "hls" ||
    mediaType === "iframe" ||
    mediaType === "mjpeg" ||
    camera.source === "YouTube Live";
  const isMp4Clip = mediaType === "mp4";
  const isSnapshot = !isHlsOrLive && !isMp4Clip;

  // 手动重新加载
  const handleManualRefresh = () => {
    setIsMediaLoading(true);
    setMediaError(false);
    pendingUpdateUrlRef.current = null;

    if (mediaType === "hls" && hlsRef.current && media.streamUrl) {
      hlsRef.current.loadSource(media.streamUrl);
      hlsRef.current.attachMedia(videoRef.current);
    } else if (mediaType === "mp4" && videoRef.current) {
      const sep = media.streamUrl.includes("?") ? "&" : "?";
      videoRef.current.src = `${media.streamUrl}${sep}_t=${Date.now()}`;
      videoRef.current.play().catch(() => {});
    } else if (mediaType === "mjpeg") {
      const stream = media.streamUrl || media.feedUrl || media.url;
      if (stream) {
        const sep = stream.includes("?") ? "&" : "?";
        setCurrentImgUrl(`${stream}${sep}_t=${Date.now()}`);
      }
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
            {isHlsOrLive ? (
              <span style={{ color: "#00e676", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span className="livecam-live-indicator-dot" />
                24H 实时视频流
              </span>
            ) : isMp4Clip ? (
              <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span className="livecam-clip-indicator-dot" />
                实况动态切片
              </span>
            ) : (
              <span style={{ color: "#00e5ff", display: "inline-flex", alignItems: "center", gap: 4 }}>
                ● 实况快照节点
              </span>
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
              可直接访问官方原始广播站进行高清观看，或一键切换下一个探头
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {camera.sourceUrl && (
                <a
                  href={camera.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="livecam-action-btn secondary"
                >
                  <ExternalLink size={14} />
                  <span>访问原站</span>
                </a>
              )}
              {onNextCamera && (
                <button
                  type="button"
                  className="livecam-action-btn primary"
                  onClick={onNextCamera}
                >
                  <SkipForward size={14} />
                  <span>下一个探头</span>
                </button>
              )}
            </div>
          </div>
        ) : mediaType === "hls" ? (
          <video
            ref={videoRef}
            className="livecam-media-element"
            poster={media.posterUrl || media.feedUrl}
            controls
            autoPlay
            muted
            defaultMuted
            playsInline
          />
        ) : mediaType === "mp4" ? (
          <video
            ref={videoRef}
            className="livecam-media-element"
            poster={media.posterUrl || media.feedUrl}
            controls
            autoPlay
            muted
            defaultMuted
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
              if (media.posterUrl && currentImgUrl !== media.posterUrl) {
                setCurrentImgUrl(media.posterUrl);
              }
            }}
          />
        )}

        {/* 画面上的科技态徽章 */}
        <div className="livecam-media-overlay-badge">
          <Radio size={11} className="livecam-pulse-dot" />
          <span>{isHlsOrLive ? "LIVE 60FPS" : isMp4Clip ? "DYNAMIC CLIP" : "LIVE SYNC"}</span>
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
            <span
              className="livecam-data-val"
              style={{
                color: isHlsOrLive ? "#00e676" : isMp4Clip ? "#38bdf8" : "#00e5ff",
              }}
            >
              {mediaType.toUpperCase()}{" "}
              {isHlsOrLive
                ? "· 实时视频流"
                : isMp4Clip
                ? "· 实况动态切片"
                : "· 道路实况快照"}
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

      {/* 底部操作行动按钮 (三按钮并排) */}
      <div className="livecam-viewer-actions">
        <button
          type="button"
          className="livecam-action-btn secondary"
          onClick={handleManualRefresh}
          title="重新请求最新画面数据"
        >
          <RefreshCw size={13} />
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
            <ExternalLink size={13} />
            <span>访问原站</span>
          </a>
        )}

        {onNextCamera && (
          <button
            type="button"
            className="livecam-action-btn next"
            onClick={onNextCamera}
            title="切换至下一路监控探头 (循环播放)"
          >
            <SkipForward size={13} />
            <span>下一个</span>
          </button>
        )}
      </div>
    </div>
  );
}
