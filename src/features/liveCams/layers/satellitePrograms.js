// -*- coding: utf-8 -*-
/**
 * satellitePrograms.js
 *
 * 按 MapLibre 投影着色器变体缓存 WebGL2 着色器程序 (marker / pick / orbit)，
 * 防止 2D (Mercator) 与 3D (Globe) 切换时因 prelude 变化导致渲染失败或程序泄漏。
 *
 * Adapted from OSIRIS satellite-programs.ts (MIT License, Copyright (c) 2026 simplifaisoul).
 */

export function createSatelliteProgramCache(compile, destroy, maxVariants = 4) {
  const variants = new Map();

  return {
    get(shader, kind) {
      const key = `${shader.variantName}\0${shader.define ?? ""}`;
      let programs = variants.get(key);
      if (!programs) {
        programs = new Map();
      }
      let program = programs.get(kind);
      if (!program) {
        program = compile(kind, shader.vertexShaderPrelude, shader.define ?? "");
        programs.set(kind, program);
      }
      variants.delete(key);
      variants.set(key, programs);
      while (variants.size > maxVariants) {
        const oldest = variants.keys().next().value;
        variants.get(oldest)?.forEach(destroy);
        variants.delete(oldest);
      }
      return program;
    },
    clear() {
      variants.forEach((programs) => programs.forEach(destroy));
      variants.clear();
    },
  };
}
