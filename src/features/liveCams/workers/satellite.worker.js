// -*- coding: utf-8 -*-
/**
 * satellite.worker.js
 *
 * 浏览器端 Web Worker：负责在独立线程初始化 SGP4 satrec、批量推算全量在轨卫星位置
 * 并按需计算单颗选中目标的过去／未来轨道轨迹，避免阻塞地图交互与 UI 主线程。
 */
import {
  initSatRec,
  propagateAtDate,
  orbitalPeriodMinutes,
  computeOrbitSegments,
} from "../utils/orbit";

let currentElementSetId = "";
let entries = []; // [{ noradId, index, satrec, periodMinutes }]
let noradIndexMap = new Map();

function propagateAllToBuffer(timestampMs) {
  const count = entries.length;
  const array = new Float32Array(count * 4);
  const date = new Date(timestampMs);
  let validCount = 0;

  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    const item = entries[i];
    if (!item || !item.satrec) {
      array[offset] = NaN;
      array[offset + 1] = NaN;
      array[offset + 2] = NaN;
      array[offset + 3] = NaN;
      continue;
    }
    const pos = propagateAtDate(item.satrec, date);
    if (!pos) {
      array[offset] = NaN;
      array[offset + 1] = NaN;
      array[offset + 2] = NaN;
      array[offset + 3] = NaN;
      continue;
    }
    array[offset] = pos.lng;
    array[offset + 1] = pos.lat;
    array[offset + 2] = pos.altKm;
    array[offset + 3] = Number.isFinite(pos.velKmS) ? pos.velKmS : NaN;
    validCount += 1;
  }

  return { array, validCount };
}

self.onmessage = (event) => {
  const msg = event?.data;
  if (!msg || !msg.type) return;

  if (msg.type === "INIT_CATALOG") {
    const { elementSetId, satellites = [], timestampMs = Date.now() } = msg;
    currentElementSetId = String(elementSetId || "");
    noradIndexMap = new Map();
    entries = satellites.map((sat, idx) => {
      const satrec = initSatRec(sat);
      const periodMinutes = satrec ? orbitalPeriodMinutes(satrec) : 95;
      const noradId = String(sat.noradId || "");
      if (noradId) {
        noradIndexMap.set(noradId, idx);
      }
      return {
        noradId,
        index: idx,
        satrec,
        periodMinutes,
      };
    });

    const { array, validCount } = propagateAllToBuffer(timestampMs);
    self.postMessage(
      {
        type: "POSITIONS",
        elementSetId: currentElementSetId,
        timestampMs,
        count: entries.length,
        validCount,
        buffer: array.buffer,
      },
      [array.buffer],
    );
    return;
  }

  if (msg.type === "PROPAGATE_ALL") {
    const { elementSetId, timestampMs = Date.now() } = msg;
    if (!entries.length || (elementSetId && elementSetId !== currentElementSetId)) {
      return;
    }
    const { array, validCount } = propagateAllToBuffer(timestampMs);
    self.postMessage(
      {
        type: "POSITIONS",
        elementSetId: currentElementSetId,
        timestampMs,
        count: entries.length,
        validCount,
        buffer: array.buffer,
      },
      [array.buffer],
    );
    return;
  }

  if (msg.type === "COMPUTE_ORBIT") {
    const {
      requestId,
      elementSetId,
      noradId,
      timestampMs = Date.now(),
      samples = 128,
    } = msg;

    if (elementSetId && elementSetId !== currentElementSetId) {
      return;
    }

    const idx = noradIndexMap.get(String(noradId || ""));
    const entry = idx !== undefined ? entries[idx] : null;
    if (!entry || !entry.satrec) {
      self.postMessage({
        type: "ORBIT_PATH",
        requestId,
        elementSetId: currentElementSetId,
        noradId: String(noradId || ""),
        timestampMs,
        pastSegments: [],
        futureSegments: [],
        periodMinutes: 95,
        current: null,
      });
      return;
    }

    const orbit = computeOrbitSegments(entry.satrec, timestampMs, samples);
    const current = propagateAtDate(entry.satrec, new Date(timestampMs));

    self.postMessage({
      type: "ORBIT_PATH",
      requestId,
      elementSetId: currentElementSetId,
      noradId: entry.noradId,
      timestampMs,
      pastSegments: orbit.pastSegments,
      futureSegments: orbit.futureSegments,
      periodMinutes: orbit.periodMinutes,
      current,
    });
  }
};
