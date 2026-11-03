// -*- coding: utf-8 -*-
/**
 * CctvPreviews.jsx
 * 
 * OSIRIS (osirisai.live) 同款地图内嵌实时摄像头悬浮探查卡片 (Map CCTV Preview HUDs)：
 * 1. 缩放到局部区域 (Zoom >= 10.5) 自动探查视野内的探头节点；
 * 2. 智能防碰撞排版与屏幕动态跟踪，最高并发渲染 8 个中心探查节点；
 * 3. 画面实时轮询，失败时自动呈现 OSIRIS 同款 "Temporarily Unavailable" 战术条纹卡片；
 * 4. 激光指示连线 (Connector Stem) 垂直锚定地图圆形点位；
 * 5. 点击任意悬浮卡片即刻聚焦并呼出全屏/大窗监控终端口。
 */
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Maximize2, Radio } from "lucide-react";
import Hls from "hls.js";
import { TILE_GEOM, getTileHeight, layoutTile, tilesOverlap } from "../utils/mapTileLayout";
import { CAMERAS_DOTS_LAYER_ID } from "../layers/cameraLayers";

// OSIRIS 原版阈值：只有在街区级别 (Zoom >= 13) 才触发视频与图像悬浮预览
const MIN_ZOOM = 13;
const MAX_TILES = 8;

/**
 * 单个悬浮探查卡片组件
 * 全面支持 HLS 60FPS 实时视频流、MP4 实况流、MJPEG 实况流、YouTube 封面及图片快照。
 */
function PreviewTile({ cam, onOpen, isCurrentSelected }) {
  const [mediaError, setMediaError] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const streamUrl = cam.media?.streamUrl || cam.stream_url || "";
  const feedUrl = cam.media?.feedUrl || cam.feed_url || "";
  const mediaType = cam.media?.type || cam.stream_type || "";

  // 判断是否具备图片快照（排除 .m3u8 与 .mp4 假快照地址）
  const hasImageFeed = Boolean(
    feedUrl &&
    !feedUrl.includes(".m3u8") &&
    !feedUrl.includes(".mp4") &&
    !feedUrl.includes("youtube.com")
  );

  // 若该探头已在主播放器中大窗播放，地图悬浮卡片跳过重复解码，避免带宽与硬件解码器争抢
  const isHls = !isCurrentSelected && !hasImageFeed && (mediaType === "hls" || (streamUrl && streamUrl.includes(".m3u8")));
  const isMp4 = !isCurrentSelected && !hasImageFeed && (mediaType === "mp4" || (streamUrl && streamUrl.includes(".mp4")));
  const isMjpeg = mediaType === "mjpeg" || (streamUrl && (streamUrl.includes("mjpg") || streamUrl.includes("mjpeg")));
  const isYouTube = !hasImageFeed && streamUrl && (streamUrl.includes("youtube.com") || streamUrl.includes("youtu.be"));

  // 1. YouTube 缩略图快速提取
  let youtubeThumb = null;
  if (isYouTube) {
    const ytMatch = streamUrl.match(/(?:embed\/|v=|vi\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      youtubeThumb = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
    }
  }

  // 2. 静态图片 / MJPEG / YouTube 封面处理
  const rawImageUrl = hasImageFeed ? feedUrl : (youtubeThumb || (isMjpeg ? streamUrl : null));
  const [imgSrc, setImgSrc] = useState(() => {
    if (!rawImageUrl) return null;
    if (isMjpeg || isYouTube) return rawImageUrl;
    const sep = rawImageUrl.includes("?") ? "&" : "?";
    return `${rawImageUrl}${sep}_t=${Date.now()}`;
  });

  useEffect(() => {
    if (!rawImageUrl) return;
    setMediaError(false);
    setMediaLoaded(false);

    if (isMjpeg || isYouTube) {
      setImgSrc(rawImageUrl);
      return;
    }

    const getFreshUrl = () => {
      const sep = rawImageUrl.includes("?") ? "&" : "?";
      return `${rawImageUrl}${sep}_t=${Date.now()}`;
    };

    setImgSrc(getFreshUrl());
    const timer = setInterval(() => {
      setImgSrc(getFreshUrl());
    }, 15000 + Math.random() * 3000);

    return () => clearInterval(timer);
  }, [rawImageUrl, isMjpeg, isYouTube]);

  // 3. HLS 迷你实况流自动轻量解码 (解决 DelDOT 等无 feed_url 探头地图卡片报错)
  useEffect(() => {
    if (!isHls || !streamUrl || !videoRef.current) return;
    setMediaError(false);
    setMediaLoaded(false);

    const video = videoRef.current;
    video.muted = true;
    video.defaultMuted = true;

    let hls = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: false,
        lowLatencyMode: true,
        backBufferLength: 4,
        maxBufferLength: 6,
        maxMaxBufferLength: 8,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setMediaLoaded(true);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn("[PreviewTile HLS Fatal]", cam.name, data.details);
          setMediaError(true);
          hls.destroy();
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      const onLoaded = () => {
        video.play().catch(() => {});
        setMediaLoaded(true);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", () => setMediaError(true));
    } else {
      setMediaError(true);
    }

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.stopLoad();
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch (e) {}
        hlsRef.current = null;
      }
      if (video) {
        try {
          const oldSrc = video.src;
          video.pause();
          video.removeAttribute("src");
          video.load();
          if (oldSrc && oldSrc.startsWith("blob:")) {
            try { URL.revokeObjectURL(oldSrc); } catch (e) {}
          }
        } catch (e) {}
      }
    };
  }, [isHls, streamUrl, cam.name]);

  // 4. MP4 连续实况视频
  useEffect(() => {
    if (!isMp4 || !streamUrl || !videoRef.current) return;
    setMediaError(false);
    setMediaLoaded(false);
    const video = videoRef.current;
    video.muted = true;
    video.defaultMuted = true;
    video.src = streamUrl;
    video.play().catch(() => {});

    return () => {
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch (e) {}
      }
    };
  }, [isMp4, streamUrl]);

  return (
    <button
      type="button"
      className="livecam-hud-tile group"
      onClick={() => onOpen(cam)}
      title={`${cam.name} (${cam.city}, ${cam.country})`}
      style={{ width: TILE_GEOM.width }}
    >
      {/* 画面视口容器 */}
      <div
        className="livecam-hud-viewport"
        style={{ height: TILE_GEOM.imageHeight }}
      >
        {mediaError || (!isHls && !isMp4 && !imgSrc) ? (
          /* OSIRIS 标志性 Temporarily Unavailable 战术条纹备选屏 */
          <div className="livecam-hud-unavailable">
            <div className="livecam-hud-scanlines-pattern" />
            <div className="livecam-hud-unavailable-text">
              Temporarily<br />Unavailable
            </div>
          </div>
        ) : isHls || isMp4 ? (
          /* 真实连续视频流解码画面 (DelDOT / MDOT / INDOT / TfL) */
          <video
            ref={videoRef}
            className={`livecam-hud-img ${mediaLoaded ? "is-loaded" : ""}`}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setMediaLoaded(true)}
            onError={() => setMediaError(true)}
          />
        ) : (
          /* 真实实时快照图像 / MJPEG 连续图像 / YouTube 封面 */
          <img
            src={imgSrc}
            alt={cam.name}
            className={`livecam-hud-img ${mediaLoaded ? "is-loaded" : ""}`}
            referrerPolicy="no-referrer"
            onLoad={() => setMediaLoaded(true)}
            onError={() => setMediaError(true)}
            draggable={false}
          />
        )}

        {/* CRT 电子扫描线滤镜 */}
        <div className="livecam-hud-crt-overlay" />

        {/* 四角高科技取景框直角标 */}
        <span className="livecam-hud-corner corner-tl" />
        <span className="livecam-hud-corner corner-tr" />
        <span className="livecam-hud-corner corner-bl" />
        <span className="livecam-hud-corner corner-br" />

        {/* 左上角 LIVE 红色脉冲标签 */}
        <div className="livecam-hud-live-tag">
          <span className="livecam-hud-live-dot" />
          <span>LIVE</span>
        </div>

        {/* 右上角悬浮 OPEN 放大指引 */}
        <div className="livecam-hud-open-btn">
          <Maximize2 size={9} />
          <span>OPEN</span>
        </div>

        {/* 加载中的扫描动效 */}
        {!mediaLoaded && !mediaError && (
          <div className="livecam-hud-loading">
            <div className="livecam-hud-sweep-line" />
            <span>LINKING...</span>
          </div>
        )}
      </div>

      {/* 底部探头名称标题栏 */}
      <div
        className="livecam-hud-label-bar"
        style={{ height: TILE_GEOM.labelHeight }}
      >
        <span className="livecam-hud-label-dot" />
        <span className="livecam-hud-label-text" title={cam.name}>
          {cam.name}
        </span>
      </div>
    </button>
  );
}

/**
 * 探针连接线 (从卡片直指地图点位)
 */
function StemConnector() {
  const h = getTileHeight();
  return (
    <>
      <span
        className="livecam-hud-stem stem-down"
        style={{ top: h, height: TILE_GEOM.gap - 4 }}
      />
      <span
        className="livecam-hud-stem stem-up"
        style={{ bottom: h, height: TILE_GEOM.gap - 4 }}
      />
    </>
  );
}

/**
 * 主预览层组件
 */
function CctvPreviews({ map: propMap, mapRef, cameras, selectedCameraId, onSelectCamera }) {
  const [visibleCams, setVisibleCams] = useState([]);
  const tileDomMap = useRef(new Map());

  const activeMap = propMap || mapRef?.current;

  // 建立 ID 快速索引表
  const camById = useMemo(() => {
    const m = new Map();
    if (cameras) {
      for (const c of cameras) {
        m.set(String(c.id), c);
      }
    }
    return m;
  }, [cameras]);

  // 1. 根据当前地图视口探查摄像头 (OSIRIS 同款 queryRenderedFeatures + 空间几何即时降级)
  const recomputePreviews = useCallback(() => {
    const map = activeMap;
    if (!map || map.getZoom() < MIN_ZOOM || !cameras || cameras.length === 0) {
      setVisibleCams((prev) => (prev.length ? [] : prev));
      return;
    }

    const canvas = map.getCanvas();
    const vp = { width: canvas.clientWidth, height: canvas.clientHeight };
    const cx = vp.width / 2;
    const cy = vp.height / 2;

    const seen = new Set();
    const candidates = [];

    // 1.1 首选从 WebGL 渲染帧探查 (queryRenderedFeatures)
    let feats = [];
    try {
      feats = map.queryRenderedFeatures({ layers: [CAMERAS_DOTS_LAYER_ID] });
    } catch {
      feats = [];
    }

    for (const f of feats) {
      const id = String(f.properties?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const fullCam = camById.get(id);
      if (!fullCam) continue;

      const hasUrl = Boolean(fullCam.media?.feedUrl || fullCam.media?.streamUrl || fullCam.media?.url);
      if (!hasUrl) continue;

      const coords = f.geometry?.coordinates;
      if (!coords) continue;

      const pt = map.project(coords);
      if (pt.x < -20 || pt.x > vp.width + 20 || pt.y < -20 || pt.y > vp.height + 20) {
        continue;
      }

      const box = layoutTile(pt, vp);
      candidates.push({
        cam: fullCam,
        box,
        d: (pt.x - cx) ** 2 + (pt.y - cy) ** 2,
      });
    }

    // 1.2 降级保障：若 WebGL 帧缓冲尚未刷新，先用经纬度范围粗筛，再进行几何投影计算，杜绝卡片闪烁与 CPU 阻塞
    if (candidates.length === 0) {
      const center = map.getCenter();
      const zoom = map.getZoom();
      // 在 zoom >= 9.5 时，屏幕覆盖的经纬度跨度极小（通常在 1~3 度之内）
      // 快速数值比对过滤掉全地球 99.8% 的探头，仅对视野邻近的候选点调用 map.project
      const spanDeg = Math.max(1.5, (360 / Math.pow(2, zoom)) * (vp.width / 256) * 1.2);
      const minLat = center.lat - spanDeg;
      const maxLat = center.lat + spanDeg;
      const minLng = center.lng - spanDeg;
      const maxLng = center.lng + spanDeg;

      for (const cam of cameras) {
        if (cam.lat < minLat || cam.lat > maxLat) continue;
        if (cam.lng < minLng || cam.lng > maxLng) continue;

        const hasUrl = Boolean(cam.media?.feedUrl || cam.media?.streamUrl || cam.media?.url);
        if (!hasUrl) continue;

        const pt = map.project([cam.lng, cam.lat]);
        if (pt.x >= 0 && pt.x <= vp.width && pt.y >= 0 && pt.y <= vp.height) {
          const box = layoutTile(pt, vp);
          candidates.push({
            cam,
            box,
            d: (pt.x - cx) ** 2 + (pt.y - cy) ** 2,
          });
        }
      }
    }

    candidates.sort((a, b) => a.d - b.d);
    const picked = [];
    for (const c of candidates) {
      if (picked.length >= MAX_TILES) break;
      const clash = picked.some((p) => tilesOverlap(p.box, c.box));
      if (!clash) picked.push(c);
    }

    setVisibleCams((prev) => {
      const same =
        prev.length === picked.length &&
        prev.every((p, i) => p.id === picked[i].cam.id);
      return same ? prev : picked.map((p) => p.cam);
    });
  }, [activeMap, cameras, camById]);

  // 2. 监听地图视口停定事件 (moveend, zoomend)，增加轻量防抖
  useEffect(() => {
    const map = activeMap;
    if (!map) return;

    recomputePreviews();

    let debounceTimer = null;
    const debouncedRecompute = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        recomputePreviews();
      }, 60);
    };

    map.on("moveend", debouncedRecompute);
    map.on("zoomend", debouncedRecompute);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off("moveend", debouncedRecompute);
      map.off("zoomend", debouncedRecompute);
    };
  }, [activeMap, recomputePreviews]);

  // 3. 在平移地图时，使用 requestAnimationFrame 锁频更新 DOM 的 translate3d (保持 60fps 丝滑跟随)
  useEffect(() => {
    const map = activeMap;
    if (!map) return;

    let rafId = null;
    const syncPositions = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const canvas = map.getCanvas();
        if (!canvas) return;
        const vp = { width: canvas.clientWidth, height: canvas.clientHeight };

        for (const cam of visibleCams) {
          const el = tileDomMap.current.get(cam.id);
          if (!el) continue;

          const pt = map.project([cam.lng, cam.lat]);
          const box = layoutTile(pt, vp);

          el.dataset.flip = !box.anchored ? "none" : box.flipped ? "below" : "above";
          el.style.transform = `translate3d(${Math.round(box.x)}px, ${Math.round(box.y)}px, 0)`;
        }
      });
    };

    syncPositions();
    map.on("move", syncPositions);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      map.off("move", syncPositions);
    };
  }, [activeMap, visibleCams]);

  if (!visibleCams.length) return null;

  return (
    <div className="livecam-hud-overlay-container">
      {visibleCams.map((cam) => (
        <div
          key={cam.id}
          ref={(el) => {
            if (el) tileDomMap.current.set(cam.id, el);
            else tileDomMap.current.delete(cam.id);
          }}
          data-flip="above"
          className="livecam-hud-tile-wrapper"
          style={{ width: TILE_GEOM.width }}
        >
          <PreviewTile
            cam={cam}
            onOpen={onSelectCamera}
            isCurrentSelected={String(cam.id) === String(selectedCameraId)}
          />
          <StemConnector />
        </div>
      ))}
    </div>
  );
}

export default memo(CctvPreviews);
