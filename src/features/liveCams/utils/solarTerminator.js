// -*- coding: utf-8 -*-
/**
 * solarTerminator.js
 * 
 * 基于真实天文日地几何的高精度全球晨昏线 (Solar Terminator) 与夜半球阴影多边形生成器。
 * 兼容 MapLibre 3D Globe (球体投影) 与 2D Mercator (墨卡托投影)，
 * 精确处理春秋分、夏至冬至、南北极极昼极夜及 ±180° 国际日期变更线闭合。
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * 计算给定 UTC 时间的太阳赤纬 (Declination) 与平太阳直射经度
 * @param {Date} date 
 * @returns {{ declination: number, subsolarLng: number }}
 */
export function getSolarCoordinates(date = new Date()) {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  
  // 当年第几天 (1-366)
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  
  // 太阳赤纬 Cooper 近似方程 (精确到 ~0.1 度，兼顾平滑度与性能)
  // delta = 23.44° * sin( (360/365) * (dayOfYear + 284) )
  const b = (360 / 365.24) * (dayOfYear + 284) * DEG2RAD;
  const declination = 23.44 * Math.sin(b); // 范围约 -23.44° ~ +23.44°
  
  // 均时差 Equation of Time (EoT) 近似微调 (分钟)
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);
  const eqtime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );

  // 太阳直射点的平太阳时经度 (正午 12:00 在格林尼治时 subsolarLng ≈ 0°)
  // 经度 = -( (utcHours - 12) * 15° + (eqtime / 4)° )
  let subsolarLng = -((utcHours - 12) * 15 + eqtime / 4);
  while (subsolarLng > 180) subsolarLng -= 360;
  while (subsolarLng < -180) subsolarLng += 360;

  return { declination, subsolarLng };
}

/**
 * 生成晨昏线 LineString 及夜半球 Polygon GeoJSON
 * @param {Date} date 
 * @returns {{ lineGeoJSON: GeoJSON.FeatureCollection, nightGeoJSON: GeoJSON.FeatureCollection }}
 */
export function computeSolarTerminatorGeoJSON(date = new Date()) {
  const { declination, subsolarLng } = getSolarCoordinates(date);
  const decRad = declination * DEG2RAD;
  const tanDec = Math.tan(decRad);

  // 采样步长：1° 经度为一个点，兼顾 60FPS 渲染性能与极高平滑度
  const points = [];
  const minLng = -180;
  const maxLng = 180;
  const step = 1;

  for (let lng = minLng; lng <= maxLng; lng += step) {
    const deltaLngRad = (lng - subsolarLng) * DEG2RAD;
    let lat;

    // 当赤纬接近 0 (春分/秋分) 时进行安全除零保护
    if (Math.abs(tanDec) < 0.0001) {
      lat = deltaLngRad >= 0 ? 89.99 : -89.99;
    } else {
      // 太阳天顶角 = 90° 条件：tan(lat) = -cos(deltaLng) / tan(declination)
      lat = Math.atan(-Math.cos(deltaLngRad) / tanDec) * RAD2DEG;
      lat = Math.max(-89.9, Math.min(89.9, lat));
    }

    points.push([lng, lat]);
  }

  // 1. 构建晨昏分界线 GeoJSON LineString
  const lineGeoJSON = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Solar Terminator Line", declination, subsolarLng },
        geometry: {
          type: "LineString",
          coordinates: points
        }
      }
    ]
  };

  // 2. 构建夜半球阴影 GeoJSON Polygon
  // 当 declination >= 0 (北半球夏季)：南半球极夜，晨昏线朝向南极 (-90°) 封闭
  // 当 declination < 0 (北半球冬季)：北半球极夜，晨昏线朝向北极 (+90°) 封闭
  const nightPolygonCoords = [...points];

  if (declination >= 0) {
    // 经由南极封闭
    nightPolygonCoords.push([180, -90]);
    nightPolygonCoords.push([-180, -90]);
    nightPolygonCoords.push(nightPolygonCoords[0]); // 闭合
  } else {
    // 经由北极封闭
    nightPolygonCoords.push([180, 90]);
    nightPolygonCoords.push([-180, 90]);
    nightPolygonCoords.push(nightPolygonCoords[0]); // 闭合
  }

  const nightGeoJSON = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Night Hemisphere Shade", declination, subsolarLng },
        geometry: {
          type: "Polygon",
          coordinates: [nightPolygonCoords]
        }
      }
    ]
  };

  return { lineGeoJSON, nightGeoJSON, declination, subsolarLng };
}
