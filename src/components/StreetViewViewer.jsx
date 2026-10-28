import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Navigation,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import "./StreetViewViewer.css";

export default function StreetViewViewer({
  panoUrl,
  initialHeading = 0,
  onLoaded,
  onError,
  className = "",
}) {
  const mountRef = useRef(null);
  const containerWrapperRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentBearing, setCurrentBearing] = useState(initialHeading);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 渲染器与交互内部引用
  const isInteractingRef = useRef(false);
  const pointerStartXRef = useRef(0);
  const pointerStartYRef = useRef(0);
  const lonRef = useRef(initialHeading || 0);
  const latRef = useRef(0);
  const startLonRef = useRef(initialHeading || 0);
  const startLatRef = useRef(0);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const activeTextureRef = useRef(null);

  // 初始化 Three.js 360° 球面全景视口
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    setIsLoading(true);
    setLoadError(null);
    lonRef.current = initialHeading || 0;
    latRef.current = 0;
    setCurrentBearing(Math.round(initialHeading || 0));

    // 1. 创建场景
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. 创建透视相机
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);
    cameraRef.current = camera;

    // 3. 创建 WebGL 渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    // 清空现有 DOM 并挂载
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    // 4. 创建球面全景几何体 (反转面法线使其内部可见)
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    // 5. 加载高精 360° 全景纹理 (支持跨域 CDN 与本地资源)
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    const effectivePanoUrl = panoUrl || "/TravelMap/game-panos/paris_butte_360.jpg";

    textureLoader.load(
      effectivePanoUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        activeTextureRef.current = texture;

        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(geometry, material);
        meshRef.current = mesh;
        scene.add(mesh);

        setIsLoading(false);
        setLoadError(null);
        if (onLoaded) onLoaded();
      },
      undefined,
      (err) => {
        console.error("Three.js panorama load failed:", err);
        setIsLoading(false);
        setLoadError("全景街景图片读取超时或丢失");
        if (onError) onError(err);
      }
    );

    // 6. 核心渲染帧循环
    const target = new THREE.Vector3();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // 将经纬度角转化为视点方向
      const phi = THREE.MathUtils.degToRad(90 - latRef.current);
      const theta = THREE.MathUtils.degToRad(lonRef.current);

      target.x = 500 * Math.sin(phi) * Math.cos(theta);
      target.y = 500 * Math.cos(phi);
      target.z = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(target);
      renderer.render(scene, camera);
    };
    animate();

    const updateCanvasSize = () => {
      if (mount && cameraRef.current && rendererRef.current) {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w > 0 && h > 0) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    };
    requestAnimationFrame(updateCanvasSize);
    const initialTimer = setTimeout(updateCanvasSize, 80);

    // 7. 响应尺寸自适应 (支持分屏拖拽实时缩放，使用 rAF 避免 ResizeObserver 帧循环警告)
    let resizeRafId = null;
    const resizeObserver = new ResizeObserver((entries) => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
          }
        }
      });
    });
    resizeObserver.observe(mount);

    // 安全卸载清理
    return () => {
      clearTimeout(initialTimer);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (resizeRafId) {
        cancelAnimationFrame(resizeRafId);
      }
      resizeObserver.disconnect();
      if (activeTextureRef.current) {
        activeTextureRef.current.dispose();
      }
      geometry.dispose();
      if (renderer) {
        renderer.dispose();
      }
      if (mount) {
        mount.innerHTML = "";
      }
    };
  }, [panoUrl, initialHeading]);

  // 鼠标 / 触控交互事件处理
  const handlePointerDown = (e) => {
    isInteractingRef.current = true;
    pointerStartXRef.current = e.clientX;
    pointerStartYRef.current = e.clientY;
    startLonRef.current = lonRef.current;
    startLatRef.current = latRef.current;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e) => {
    if (!isInteractingRef.current) return;
    const deltaX = e.clientX - pointerStartXRef.current;
    const deltaY = e.clientY - pointerStartYRef.current;

    // 水平朝向 (0-360° 循环)
    lonRef.current = (startLonRef.current - deltaX * 0.15 + 3600) % 360;
    // 俯仰角度 (-85° 到 85° 限制，防止天顶万向锁)
    latRef.current = Math.max(-85, Math.min(85, startLatRef.current + deltaY * 0.15));

    setCurrentBearing(Math.round(lonRef.current));
  };

  const handlePointerUp = (e) => {
    isInteractingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // 滚轮无级变焦 (FOV 范围 25° 极细微辨识 - 85° 广阔视角)
  const handleWheel = (e) => {
    e.preventDefault();
    if (!cameraRef.current) return;
    const currentFov = cameraRef.current.fov;
    const nextFov = Math.max(25, Math.min(85, currentFov + e.deltaY * 0.05));
    cameraRef.current.fov = nextFov;
    cameraRef.current.updateProjectionMatrix();
  };

  // 视角复位到初始朝向
  const handleResetPov = useCallback(() => {
    lonRef.current = initialHeading || 0;
    latRef.current = 0;
    setCurrentBearing(Math.round(initialHeading || 0));
    if (cameraRef.current) {
      cameraRef.current.fov = 75;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [initialHeading]);

  // 放大视角
  const handleZoomIn = useCallback(() => {
    if (!cameraRef.current) return;
    cameraRef.current.fov = Math.max(25, cameraRef.current.fov - 15);
    cameraRef.current.updateProjectionMatrix();
  }, []);

  // 缩小视野
  const handleZoomOut = useCallback(() => {
    if (!cameraRef.current) return;
    cameraRef.current.fov = Math.min(85, cameraRef.current.fov + 15);
    cameraRef.current.updateProjectionMatrix();
  }, []);

  // 全屏沉浸切换
  const handleToggleFullscreen = useCallback(() => {
    const el = containerWrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // 计算指南针方位缩写 (如 N, NE, E, SE, S, SW, W, NW)
  const getCompassDirection = (deg) => {
    const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
    return directions[index];
  };

  return (
    <div
      ref={containerWrapperRef}
      className={`streetview-master-wrapper ${className}`}
      onWheel={handleWheel}
    >
      {/* Three.js WebGL 画布挂载层 */}
      <div
        ref={mountRef}
        className="streetview-canvas-mount"
        style={{ cursor: "grab" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* 实时动态朝向指北针 (左上角) */}
      <div
        className="streetview-compass-badge"
        title="点击快速校准回正北方向"
        onClick={() => {
          lonRef.current = 0;
          setCurrentBearing(0);
        }}
        style={{ cursor: "pointer" }}
      >
        <span
          className="streetview-compass-needle"
          style={{ transform: `rotate(${-currentBearing}deg)` }}
        >
          <Compass size={17} />
        </span>
        <span className="streetview-compass-deg">
          {currentBearing}° {getCompassDirection(currentBearing)}
        </span>
      </div>

      {/* 街景模式标识 (左下角) */}
      <div className="streetview-rule-badge free">
        <Sparkles size={13} style={{ color: "#38bdf8" }} />
        <span>360° 真实街景 · 自由旋转与滚轮变焦</span>
      </div>

      {/* 右上角快捷操作栏 */}
      <div className="streetview-hud-controls">
        <button
          type="button"
          className="streetview-hud-btn"
          onClick={handleResetPov}
          title="视角复位 (恢复初始拍摄朝向)"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className="streetview-hud-btn"
          onClick={handleZoomIn}
          title="放大细节 (观察路牌、文字、植被)"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className="streetview-hud-btn"
          onClick={handleZoomOut}
          title="缩小视野 (纵览天地全景)"
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          className="streetview-hud-btn"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? "退出全屏" : "街景沉浸全屏"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* 加载骨架屏 (极速淡出) */}
      {isLoading && (
        <div className="streetview-loading-skeleton">
          <div className="streetview-spinner-ring" />
          <div className="streetview-loading-title">正在载入 360° 真实街景...</div>
          <div className="streetview-loading-sub">
            正在通过 WebGL 调度高精实拍球面纹理
          </div>
        </div>
      )}

      {/* 错误提示浮层 */}
      {loadError && (
        <div className="streetview-error-fallback">
          <AlertCircle size={36} className="streetview-error-icon" />
          <div className="streetview-error-msg">{loadError}</div>
          <div className="streetview-error-actions">
            <button
              type="button"
              className="streetview-error-btn retry"
              onClick={() => {
                setLoadError(null);
                setIsLoading(true);
              }}
            >
              重新载入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
