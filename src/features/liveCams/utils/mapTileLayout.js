// -*- coding: utf-8 -*-
/**
 * mapTileLayout.js
 * 
 * 计算地图上摄像头预览浮层 (CCTV Preview Tiles) 的屏幕坐标与碰撞防重叠算法。
 * 移植自 OSIRIS 核心布局引擎。
 */

export const TILE_GEOM = {
  width: 176,
  imageHeight: 99,
  labelHeight: 22,
  gap: 26,
};

const EDGE_PADDING = 30;
const EDGE_TOP = 65;
const EDGE_BOTTOM = 60;

export function getTileHeight(geom = TILE_GEOM) {
  return geom.imageHeight + geom.labelHeight;
}

/**
 * 根据标记点屏幕坐标计算卡片位置与翻转状态
 * @param {{ x: number, y: number }} pt 标记点屏幕投影坐标
 * @param {{ width: number, height: number }} viewport 地图视口尺寸
 * @param {typeof TILE_GEOM} geom 几何尺寸定义
 */
export function layoutTile(pt, viewport, geom = TILE_GEOM) {
  const h = getTileHeight(geom);
  const maxX = viewport.width - geom.width - EDGE_PADDING;
  const maxY = viewport.height - h - EDGE_BOTTOM;

  // 默认置于标记点上方；若上方空间不足则翻转至下方
  const above = pt.y - h - geom.gap;
  const flipped = above < EDGE_TOP;
  const wantX = pt.x - geom.width / 2;
  const wantY = flipped ? pt.y + geom.gap : above;

  const x = Math.min(Math.max(wantX, EDGE_PADDING), Math.max(EDGE_PADDING, maxX));
  const y = Math.min(Math.max(wantY, EDGE_TOP), Math.max(EDGE_TOP, maxY));

  return {
    x,
    y,
    flipped,
    anchored: Math.abs(x - wantX) < 2 && Math.abs(y - wantY) < 2,
  };
}

/**
 * 判定两个放置好的卡片是否在屏幕上重叠
 */
export function tilesOverlap(a, b, geom = TILE_GEOM) {
  return (
    Math.abs(a.x - b.x) < geom.width + 10 &&
    Math.abs(a.y - b.y) < getTileHeight(geom) + geom.gap
  );
}
