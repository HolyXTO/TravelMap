// -*- coding: utf-8 -*-
/**
 * satellite3DLayer.js
 *
 * MapLibre GL JS (6.7.0) WebGL2 自定义三维卫星图层：
 * 1. 分离真实轨道高度 (`altKm`) 与三维显示高度 (`displayElevation`)，LEO/MEO/GEO 分层清晰可见；
 * 2. Globe 模式 (`exaggeration = 1`) 离地悬浮并带地球背面遮挡；2D Mercator (`exaggeration = 0`) 自动贴地显示星下点；
 * 3. 与相机渲染严格同源的 GPU 离屏拾取 (`pick(x, y)`)；
 * 4. 选中目标同时在三维轨道高度渲染过去与未来半周期轨迹（含选中高亮光环）；
 * 5. `SAT_MAX_ZOOM` 以上自动让路地面摄像头点位交互。
 *
 * WebGL instanced satellite layer & elevation curve adapted from OSIRIS satellite-layer.ts
 * (MIT License, Copyright (c) 2026 simplifaisoul).
 */
import { MercatorCoordinate } from "maplibre-gl";
import { createSatelliteProgramCache } from "./satellitePrograms";

export const SATELLITE_LAYER_ID = "live-satellites-3d-layer";
export const SAT_MAX_ZOOM = 8.5;

const KM_TO_M = 1000;
const FLOOR_KM = 620;
const CEILING_KM = 2500;
const MIN_ALT_KM = 150;
const MAX_ALT_KM = 36000;

export function displayElevation(altKm, exaggeration = 1) {
  if (!Number.isFinite(altKm) || altKm <= 0 || exaggeration <= 0) return 0;
  const clamped = Math.min(Math.max(altKm, MIN_ALT_KM), MAX_ALT_KM);
  const t =
    (Math.sqrt(clamped) - Math.sqrt(MIN_ALT_KM)) /
    (Math.sqrt(MAX_ALT_KM) - Math.sqrt(MIN_ALT_KM));
  return (FLOOR_KM + (CEILING_KM - FLOOR_KM) * t) * exaggeration * KM_TO_M;
}

const VERT = `
in vec2 a_corner;
in vec3 a_pos;
in vec3 a_color;
in float a_size;
uniform vec2 u_viewport;
uniform int u_selected;
uniform int u_hovered;
out vec2 v_corner;
out vec3 v_color;
out float v_hot;
out float v_hover;
void main() {
  vec4 clip = projectTileFor3D(a_pos.xy, a_pos.z);
  float px = clamp(a_size * 260.0 / max(clip.w, 0.0001), 2.8, 16.0);
  v_hot = gl_InstanceID == u_selected ? 1.0 : 0.0;
  v_hover = gl_InstanceID == u_hovered ? 1.0 : 0.0;
  px += v_hot * 9.5 + v_hover * 4.5;
  gl_Position = clip + vec4(a_corner * px / u_viewport * 2.0 * clip.w, 0.0, 0.0);
  v_corner = a_corner;
  v_color = a_color;
}`;

const FRAG = `
precision mediump float;
in vec2 v_corner;
in vec3 v_color;
in float v_hot;
in float v_hover;
out vec4 fragColor;
void main() {
  float r = length(v_corner);
  if (r > 1.0) discard;
  if (v_hot > 0.5) {
    float ring = smoothstep(0.54, 0.74, r) * smoothstep(1.0, 0.84, r);
    vec3 c = mix(v_color, vec3(1.0), 0.6);
    float core = smoothstep(0.46, 0.0, r);
    fragColor = vec4(c, max(ring, core) * 0.96);
    return;
  }
  if (v_hover > 0.5) {
    float ring = smoothstep(0.62, 0.78, r) * smoothstep(1.0, 0.88, r);
    vec3 c = mix(v_color, vec3(1.0), 0.45);
    fragColor = vec4(c, max(ring * 0.85, smoothstep(0.55, 0.1, r)));
    return;
  }
  float glow = smoothstep(1.0, 0.35, r);
  vec3 tint = mix(v_color, vec3(1.0), smoothstep(0.42, 0.0, r) * 0.35);
  fragColor = vec4(tint, glow * 0.92);
}`;

const PICK_VERT = `
in vec2 a_corner;
in vec3 a_pos;
in float a_size;
uniform vec2 u_viewport;
flat out vec3 v_id;
out vec2 v_corner;
void main() {
  vec4 clip = projectTileFor3D(a_pos.xy, a_pos.z);
  float px = clamp(a_size * 260.0 / max(clip.w, 0.0001), 2.8, 16.0) + 4.5;
  gl_Position = clip + vec4(a_corner * px / u_viewport * 2.0 * clip.w, 0.0, 0.0);
  int id = gl_InstanceID + 1;
  v_id = vec3(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255)) / 255.0;
  v_corner = a_corner;
}`;

const PICK_FRAG = `
precision mediump float;
flat in vec3 v_id;
in vec2 v_corner;
out vec4 fragColor;
void main() {
  if (length(v_corner) > 1.0) discard;
  fragColor = vec4(v_id, 1.0);
}`;

const ORBIT_VERT = `
in vec3 a_pos;
in vec3 a_other;
in vec2 a_extrude;
uniform vec2 u_viewport;
uniform float u_half_width;
out float v_edge;
void main() {
  vec4 clipA = projectTileFor3D(a_pos.xy, a_pos.z);
  vec4 clipB = projectTileFor3D(a_other.xy, a_other.z);
  vec2 ndcA = clipA.xy / max(abs(clipA.w), 0.0001);
  vec2 ndcB = clipB.xy / max(abs(clipB.w), 0.0001);
  vec2 screenVec = (ndcB - ndcA) * u_viewport * 0.5 * a_extrude.y;
  float len = length(screenVec);
  vec2 tangent = len > 0.0001 ? screenVec / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-tangent.y, tangent.x);
  vec2 offsetNdc = normal * a_extrude.x * u_half_width / max(u_viewport * 0.5, vec2(1.0));
  gl_Position = clipA + vec4(offsetNdc * clipA.w, 0.0, 0.0);
  v_edge = a_extrude.x;
}`;

const ORBIT_FRAG = `
precision mediump float;
uniform vec4 u_color;
in float v_edge;
out vec4 fragColor;
void main() {
  float d = abs(v_edge);
  float core = 1.0 - smoothstep(0.28, 0.58, d);
  float halo = (1.0 - smoothstep(0.42, 1.0, d)) * 0.55;
  vec3 col = mix(u_color.rgb, vec3(1.0), core * 0.42);
  float a = clamp((core + halo) * u_color.a, 0.0, 1.0);
  if (a < 0.02) discard;
  fragColor = vec4(col, a);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`satellite layer shader failed: ${log}`);
  }
  return sh;
}

export function packOrbitSegment(segment, exaggeration = 1) {
  // 每个采样点产出左/右两条带状顶点，每顶点 8 float: a_pos(3) + a_other(3) + a_extrude(2)
  const STRIDE = 8;
  const coords = segment.map((p) => {
    const m = MercatorCoordinate.fromLngLat({ lng: p.lng, lat: p.lat }, 0);
    return [m.x, m.y, displayElevation(p.altKm, exaggeration)];
  });
  const out = new Float32Array(coords.length * 2 * STRIDE);

  for (let i = 0; i < coords.length; i += 1) {
    const curr = coords[i];
    const isLast = i === coords.length - 1;
    const other = isLast ? coords[i - 1] : coords[i + 1];
    const dirSign = isLast ? -1 : 1;

    for (let s = 0; s < 2; s += 1) {
      const side = s === 0 ? -1 : 1;
      const o = (i * 2 + s) * STRIDE;
      out[o] = curr[0];
      out[o + 1] = curr[1];
      out[o + 2] = curr[2];
      out[o + 3] = other[0];
      out[o + 4] = other[1];
      out[o + 5] = other[2];
      out[o + 6] = side;
      out[o + 7] = dirSign;
    }
  }
  return out;
}

export function parseColorInt(hex, fallback = 0x38bdf8) {
  if (!hex) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  return m ? parseInt(m[1], 16) : fallback;
}

export function createSatelliteLayer(id = SATELLITE_LAYER_ID) {
  let gl = null;
  let map = null;
  let program = null;
  let activeShader = null;
  let buffer = null;
  let quad = null;
  let pickProgram = null;
  let pickFbo = null;
  let pickTex = null;
  let pickDepth = null;
  let pickSize = { w: 0, h: 0 };
  let lastProjection = null;

  let orbitProgram = null;
  let pastOrbitBuffers = [];
  let futureOrbitBuffers = [];
  let orbitData = null; // { pastSegments, futureSegments }
  let orbitFutureColor = 0x38bdf8;
  let orbitPastColor = 0x94a3b8;
  let orbitDirty = false;

  let selected = -1;
  let hovered = -1;
  let visible = false;
  let vertices = new Float32Array(0);
  let count = 0;
  let exaggeration = 1;
  let points = []; // [{ lng, lat, altKm, r, g, b, size, satIndex }]
  let dirty = false;

  const link = (prelude, define, vert, frag) => {
    const vs = compile(gl, gl.VERTEX_SHADER, `#version 300 es\n${prelude}\n${define}\n${vert}`);
    const fs = compile(gl, gl.FRAGMENT_SHADER, `#version 300 es\n${frag}`);
    const pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(pr);
      gl.deleteProgram(pr);
      throw new Error(`satellite layer link failed: ${log}`);
    }
    return pr;
  };

  const programs = createSatelliteProgramCache(
    (kind, prelude, define) => {
      if (kind === "pick") return link(prelude, define, PICK_VERT, PICK_FRAG);
      if (kind === "orbit") return link(prelude, define, ORBIT_VERT, ORBIT_FRAG);
      return link(prelude, define, VERT, FRAG);
    },
    (pr) => gl?.deleteProgram(pr),
  );

  const ensurePickTargets = (w, h) => {
    if (!gl || (pickSize.w === w && pickSize.h === h && pickFbo)) return;
    if (pickTex) gl.deleteTexture(pickTex);
    if (pickDepth) gl.deleteRenderbuffer(pickDepth);
    if (pickFbo) gl.deleteFramebuffer(pickFbo);

    pickTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pickTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    pickDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, pickDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

    pickFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    pickSize = { w, h };
  };

  const bindAttributes = (pr) => {
    const cornerLoc = gl.getAttribLocation(pr, "a_corner");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(cornerLoc);
    gl.vertexAttribPointer(cornerLoc, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(cornerLoc, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const STRIDE = 7 * 4;
    const attrs = [
      ["a_pos", 3, 0],
      ["a_color", 3, 12],
      ["a_size", 1, 24],
    ];
    for (const [name, size, offset] of attrs) {
      const loc = gl.getAttribLocation(pr, name);
      if (loc < 0) continue;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    return cornerLoc;
  };

  const clearDivisors = (pr, cornerLoc) => {
    gl.vertexAttribDivisor(cornerLoc, 0);
    for (const n of ["a_pos", "a_color", "a_size"]) {
      const loc = gl.getAttribLocation(pr, n);
      if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
    }
  };

  const setProjectionUniforms = (pr, proj) => {
    const u = (name) => gl.getUniformLocation(pr, name);
    gl.uniformMatrix4fv(u("u_projection_matrix"), false, proj.mainMatrix);
    gl.uniform4f(
      u("u_projection_tile_mercator_coords"),
      proj.tileMercatorCoords[0],
      proj.tileMercatorCoords[1],
      proj.tileMercatorCoords[2],
      proj.tileMercatorCoords[3],
    );
    gl.uniform4f(
      u("u_projection_clipping_plane"),
      proj.clippingPlane[0],
      proj.clippingPlane[1],
      proj.clippingPlane[2],
      proj.clippingPlane[3],
    );
    gl.uniform1f(u("u_projection_transition"), proj.projectionTransition);
    gl.uniformMatrix4fv(u("u_projection_fallback_matrix"), false, proj.fallbackMatrix);
  };

  const clearOrbitBuffers = () => {
    if (!gl) return;
    for (const o of pastOrbitBuffers) gl.deleteBuffer(o.buf);
    for (const o of futureOrbitBuffers) gl.deleteBuffer(o.buf);
    pastOrbitBuffers = [];
    futureOrbitBuffers = [];
  };

  const buildVertices = () => {
    const STRIDE = 7;
    const out = new Float32Array(points.length * STRIDE);
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const m = MercatorCoordinate.fromLngLat({ lng: p.lng, lat: p.lat }, 0);
      const o = i * STRIDE;
      out[o] = m.x;
      out[o + 1] = m.y;
      out[o + 2] = displayElevation(p.altKm, exaggeration);
      out[o + 3] = p.r;
      out[o + 4] = p.g;
      out[o + 5] = p.b;
      out[o + 6] = p.size;
    }
    return out;
  };

  return {
    id,
    type: "custom",
    renderingMode: "3d",

    onAdd(m, context) {
      map = m;
      gl = context;
      buffer = gl.createBuffer();
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      dirty = true;
    },

    onRemove() {
      if (gl) {
        programs.clear();
        if (buffer) gl.deleteBuffer(buffer);
        if (quad) gl.deleteBuffer(quad);
        if (pickTex) gl.deleteTexture(pickTex);
        if (pickDepth) gl.deleteRenderbuffer(pickDepth);
        if (pickFbo) gl.deleteFramebuffer(pickFbo);
        clearOrbitBuffers();
      }
      program = null;
      activeShader = null;
      lastProjection = null;
      buffer = null;
      quad = null;
      pickProgram = null;
      pickTex = null;
      pickDepth = null;
      pickFbo = null;
      pickSize = { w: 0, h: 0 };
      orbitProgram = null;
      gl = null;
      map = null;
    },

    setVisible(nextVisible) {
      const v = Boolean(nextVisible);
      if (visible !== v) {
        visible = v;
        if (!v) {
          lastProjection = null;
          hovered = -1;
        }
        map?.triggerRepaint();
      }
    },

    setPoints(nextPoints) {
      points = Array.isArray(nextPoints) ? nextPoints : [];
      dirty = true;
      map?.triggerRepaint();
    },

    setExaggeration(value) {
      const next = Number(value) || 0;
      if (exaggeration !== next) {
        exaggeration = next;
        dirty = true;
        orbitDirty = true;
        map?.triggerRepaint();
      }
    },

    setSelected(instanceIndex) {
      const next = instanceIndex === null || instanceIndex === undefined ? -1 : instanceIndex;
      if (selected !== next) {
        selected = next;
        map?.triggerRepaint();
      }
    },

    setHovered(instanceIndex) {
      const next = instanceIndex === null || instanceIndex === undefined ? -1 : instanceIndex;
      if (hovered !== next) {
        hovered = next;
        map?.triggerRepaint();
      }
    },

    setOrbit(orbit, futureHex = 0x38bdf8, pastHex = 0x94a3b8) {
      orbitData = orbit;
      orbitFutureColor = futureHex;
      orbitPastColor = pastHex;
      orbitDirty = true;
      map?.triggerRepaint();
    },

    pick(x, y) {
      if (!visible || !gl || !activeShader || !buffer || !lastProjection || count === 0) {
        return null;
      }
      if (map && map.getZoom() > SAT_MAX_ZOOM) return null;

      try {
        pickProgram = programs.get(activeShader, "pick");
      } catch {
        return null;
      }

      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const clientWidth = gl.canvas?.clientWidth || w;
      if (!clientWidth || w <= 0 || h <= 0) return null;

      ensurePickTargets(w, h);
      if (!pickFbo) return null;

      const ratio = w / clientWidth;
      const px = Math.round(x * ratio);
      const py = Math.round(h - y * ratio);

      const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const prevBlend = gl.isEnabled(gl.BLEND);
      const prevDepthTest = gl.isEnabled(gl.DEPTH_TEST);

      gl.bindFramebuffer(gl.FRAMEBUFFER, pickFbo);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);

      gl.useProgram(pickProgram);
      setProjectionUniforms(pickProgram, lastProjection);
      gl.uniform2f(gl.getUniformLocation(pickProgram, "u_viewport"), w, h);
      const cornerLoc = bindAttributes(pickProgram);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      clearDivisors(pickProgram, cornerLoc);

      const R = 7;
      const x0 = Math.max(0, px - R);
      const y0 = Math.max(0, py - R);
      const bw = Math.min(w - x0, R * 2 + 1);
      const bh = Math.min(h - y0, R * 2 + 1);

      let best = null;
      if (bw > 0 && bh > 0) {
        const buf = new Uint8Array(bw * bh * 4);
        gl.readPixels(x0, y0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let bestDist = Infinity;
        for (let iy = 0; iy < bh; iy += 1) {
          for (let ix = 0; ix < bw; ix += 1) {
            const o = (iy * bw + ix) * 4;
            const instId = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16);
            if (instId === 0) continue;
            const dx = x0 + ix - px;
            const dy = y0 + iy - py;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
              bestDist = d;
              best = instId - 1;
            }
          }
        }
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
      gl.viewport(0, 0, w, h);
      if (prevBlend) gl.enable(gl.BLEND);
      else gl.disable(gl.BLEND);
      if (prevDepthTest) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);

      return best !== null && best >= 0 && best < count ? best : null;
    },

    render(_context, args) {
      if (!visible || !gl || !buffer) {
        lastProjection = null;
        return;
      }
      if (!points.length) {
        count = 0;
        lastProjection = null;
        return;
      }
      if (map && map.getZoom() > SAT_MAX_ZOOM) {
        lastProjection = null;
        return;
      }

      const shader = args?.shaderData;
      if (!shader?.vertexShaderPrelude) return;

      const hasOrbit =
        orbitData &&
        ((orbitData.pastSegments && orbitData.pastSegments.length > 0) ||
          (orbitData.futureSegments && orbitData.futureSegments.length > 0));

      try {
        program = programs.get(shader, "marker");
        orbitProgram = hasOrbit ? programs.get(shader, "orbit") : null;
        activeShader = shader;
      } catch (err) {
        console.error("[TravelMap] satellite3DLayer shader compile failed:", err);
        return;
      }
      if (!program) return;

      if (dirty) {
        vertices = buildVertices();
        count = points.length;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        dirty = false;
      }
      if (count === 0) return;

      const proj = args.defaultProjectionData;
      lastProjection = proj ?? lastProjection;
      if (!proj) return;

      // 1. 先画选中卫星发光宽带轨道线（屏幕空间 TRIANGLE_STRIP 发光核心 + 柔光外晕）
      if (orbitDirty && orbitProgram) {
        clearOrbitBuffers();
        const buildBuffers = (segs) =>
          (segs || [])
            .filter((seg) => seg && seg.length > 1)
            .map((seg) => {
              const data = packOrbitSegment(seg, exaggeration);
              const buf = gl.createBuffer();
              gl.bindBuffer(gl.ARRAY_BUFFER, buf);
              gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
              return { buf, count: seg.length * 2 };
            });

        pastOrbitBuffers = buildBuffers(orbitData?.pastSegments);
        futureOrbitBuffers = buildBuffers(orbitData?.futureSegments);
        orbitDirty = false;
      }

      if (orbitProgram && (pastOrbitBuffers.length || futureOrbitBuffers.length)) {
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const ratio = gl.canvas?.clientWidth ? w / gl.canvas.clientWidth : 1;

        gl.useProgram(orbitProgram);
        setProjectionUniforms(orbitProgram, proj);
        gl.uniform2f(gl.getUniformLocation(orbitProgram, "u_viewport"), w, h);

        const posLoc = gl.getAttribLocation(orbitProgram, "a_pos");
        const otherLoc = gl.getAttribLocation(orbitProgram, "a_other");
        const extrudeLoc = gl.getAttribLocation(orbitProgram, "a_extrude");
        const ORBIT_STRIDE = 8 * 4;

        const prevCull = gl.isEnabled(gl.CULL_FACE);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);

        const drawSegList = (list, hex, alpha, halfWidthCssPx) => {
          if (!list.length || posLoc < 0) return;
          gl.uniform4f(
            gl.getUniformLocation(orbitProgram, "u_color"),
            ((hex >> 16) & 0xff) / 255,
            ((hex >> 8) & 0xff) / 255,
            (hex & 0xff) / 255,
            alpha,
          );
          gl.uniform1f(
            gl.getUniformLocation(orbitProgram, "u_half_width"),
            halfWidthCssPx * ratio,
          );

          for (const o of list) {
            gl.bindBuffer(gl.ARRAY_BUFFER, o.buf);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, ORBIT_STRIDE, 0);
            gl.vertexAttribDivisor(posLoc, 0);

            if (otherLoc >= 0) {
              gl.enableVertexAttribArray(otherLoc);
              gl.vertexAttribPointer(otherLoc, 3, gl.FLOAT, false, ORBIT_STRIDE, 12);
              gl.vertexAttribDivisor(otherLoc, 0);
            }
            if (extrudeLoc >= 0) {
              gl.enableVertexAttribArray(extrudeLoc);
              gl.vertexAttribPointer(extrudeLoc, 2, gl.FLOAT, false, ORBIT_STRIDE, 24);
              gl.vertexAttribDivisor(extrudeLoc, 0);
            }

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, o.count);
          }
        };

        drawSegList(pastOrbitBuffers, 0xcbd5e1, 0.72, 3.6);
        drawSegList(futureOrbitBuffers, orbitFutureColor, 0.98, 5.4);

        if (prevCull) gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
      }

      // 2. 绘制全量卫星发光点与选中高亮环
      gl.useProgram(program);
      setProjectionUniforms(program, proj);
      const cornerLoc = bindAttributes(program);
      gl.uniform2f(
        gl.getUniformLocation(program, "u_viewport"),
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      );
      gl.uniform1i(gl.getUniformLocation(program, "u_selected"), selected);
      gl.uniform1i(gl.getUniformLocation(program, "u_hovered"), hovered);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      gl.depthMask(true);
      clearDivisors(program, cornerLoc);
    },
  };
}
