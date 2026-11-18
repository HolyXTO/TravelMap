// -*- coding: utf-8 -*-
/**
 * orbit.js
 *
 * SGP4/SDP4 浏览器端轨道传播与轨迹采样工具 (基于 satellite.js)。
 * - 支持 CelesTrak GP OMM 对象 (`json2satrec`) 与标准双行根数 TLE (`twoline2satrec`)
 * - 位置与真实三维轨道速度矢量模长 (`velKmS`) 均由 `satellite.propagate` 计算
 * - 自动处理国际日界线 (antimeridian) 跨线分段，避免 2D/3D 连线横穿地球
 *
 * Orbit sampling & antimeridian-splitting design adapted from OSIRIS
 * (MIT License, Copyright (c) 2026 simplifaisoul).
 */
import {
  json2satrec,
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from "satellite.js";

const TWO_PI = Math.PI * 2;
const MIN_ALT_KM = 80;
const MAX_ALT_KM = 60000;

export function initSatRec(sat) {
  if (!sat) return null;
  try {
    if (sat.omm && sat.omm.EPOCH && sat.omm.MEAN_MOTION) {
      const satrec = json2satrec(sat.omm);
      if (satrec && !satrec.error) return satrec;
    }
    if (sat.tle1 && sat.tle2) {
      const satrec = twoline2satrec(sat.tle1, sat.tle2);
      if (satrec && !satrec.error) return satrec;
    }
    if (sat.omm) {
      return json2satrec(sat.omm);
    }
  } catch {
    return null;
  }
  return null;
}

export function propagateAtDate(satrec, date) {
  if (!satrec) return null;
  try {
    const pv = propagate(satrec, date);
    if (!pv || !pv.position || typeof pv.position === "boolean") {
      return null;
    }
    const gmst = gstime(date);
    const gd = eciToGeodetic(pv.position, gmst);
    const lat = degreesLat(gd.latitude);
    const lng = degreesLong(gd.longitude);
    const altKm = gd.height;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(altKm) ||
      altKm < MIN_ALT_KM ||
      altKm > MAX_ALT_KM
    ) {
      return null;
    }

    let velKmS = NaN;
    if (pv.velocity && typeof pv.velocity !== "boolean") {
      const v = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
      if (Number.isFinite(v)) {
        velKmS = v;
      }
    }

    return { lat, lng, altKm, velKmS };
  } catch {
    return null;
  }
}

export function orbitalPeriodMinutes(satrec) {
  if (!satrec || !Number.isFinite(satrec.no) || satrec.no <= 0) {
    return 95;
  }
  const minutes = TWO_PI / satrec.no;
  if (!Number.isFinite(minutes) || minutes < 60 || minutes > 3000) {
    return 95;
  }
  return minutes;
}

export function classifyOrbitRegime(altKm) {
  if (!Number.isFinite(altKm)) return { code: "LEO", label: "近地轨道 (LEO)" };
  if (altKm < 2000) return { code: "LEO", label: "近地轨道 (LEO)" };
  if (altKm < 34000) return { code: "MEO", label: "中地球轨道 (MEO)" };
  if (altKm <= 37500) return { code: "GEO", label: "地球同步轨道 (GEO)" };
  return { code: "HEO", label: "高椭圆／高轨 (HEO)" };
}

/**
 * 在日界线跨越处切分经纬度点序列 (`|Δlng| > 180°`)。
 * 每个点结构: { lng, lat, altKm }
 */
export function splitAtAntimeridian(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const segments = [];
  let current = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (Math.abs(curr.lng - prev.lng) > 180) {
      if (current.length >= 2) segments.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

/**
 * 基于当前 UTC 时间前后各半个轨道周期 (`-0.5P ~ +0.5P`) 采样完整单星轨迹。
 */
export function computeOrbitSegments(satrec, centerMs = Date.now(), samples = 128) {
  if (!satrec) return { pastSegments: [], futureSegments: [], periodMinutes: 95 };

  const periodMinutes = orbitalPeriodMinutes(satrec);
  const halfPeriodMs = (periodMinutes * 60 * 1000) / 2;
  const halfSteps = Math.max(24, Math.floor(samples / 2));

  const pastPoints = [];
  const futurePoints = [];

  for (let i = 0; i <= halfSteps; i += 1) {
    const tPast = centerMs - halfPeriodMs + (halfPeriodMs * i) / halfSteps;
    const posPast = propagateAtDate(satrec, new Date(tPast));
    if (posPast) {
      pastPoints.push({ lng: posPast.lng, lat: posPast.lat, altKm: posPast.altKm });
    }
  }

  for (let i = 0; i <= halfSteps; i += 1) {
    const tFuture = centerMs + (halfPeriodMs * i) / halfSteps;
    const posFuture = propagateAtDate(satrec, new Date(tFuture));
    if (posFuture) {
      futurePoints.push({ lng: posFuture.lng, lat: posFuture.lat, altKm: posFuture.altKm });
    }
  }

  return {
    pastSegments: splitAtAntimeridian(pastPoints),
    futureSegments: splitAtAntimeridian(futurePoints),
    periodMinutes,
  };
}
