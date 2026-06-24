from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import shapefile


WGS84_A = 6378137.0
WGS84_E = 0.08181919084262149
COUNTRY_NAME_ALIASES_ZH = {
    "CHN": "中国",
    "USA": "美国",
}


def mercator_to_lonlat(x, y):
    lon = math.degrees(x / WGS84_A)
    t = math.exp(-y / WGS84_A)
    lat = math.pi / 2 - 2 * math.atan(t)
    for _ in range(8):
        esin = WGS84_E * math.sin(lat)
        lat = math.pi / 2 - 2 * math.atan(t * ((1 - esin) / (1 + esin)) ** (WGS84_E / 2))
    return [lon, math.degrees(lat)]


def to_lonlat(point):
    x, y = point
    if abs(x) <= 180 and abs(y) <= 90:
        return [x, y]
    return mercator_to_lonlat(x, y)


def point_distance_to_segment(point, start, end):
    px, py = point
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    if dx == 0 and dy == 0:
        return math.hypot(px - sx, py - sy)
    t = max(0, min(1, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)))
    nearest_x = sx + t * dx
    nearest_y = sy + t * dy
    return math.hypot(px - nearest_x, py - nearest_y)


def simplify_line(points, tolerance):
    if len(points) <= 2:
        return points
    max_distance = 0
    index = 0
    for idx in range(1, len(points) - 1):
        distance = point_distance_to_segment(points[idx], points[0], points[-1])
        if distance > max_distance:
            index = idx
            max_distance = distance
    if max_distance > tolerance:
        left = simplify_line(points[: index + 1], tolerance)
        right = simplify_line(points[index:], tolerance)
        return left[:-1] + right
    return [points[0], points[-1]]


def ring_area(ring):
    if len(ring) < 4:
        return 0
    area = 0
    for idx in range(len(ring) - 1):
        x1, y1 = ring[idx]
        x2, y2 = ring[idx + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def simplify_ring(ring, tolerance, min_area):
    if len(ring) < 4:
        return []
    ring = [to_lonlat(point) for point in ring]
    closed = ring[0] == ring[-1]
    work = ring[:-1] if closed else ring
    if len(work) < 3:
        return []
    simplified = simplify_line(work, tolerance)
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    if len(simplified) < 4:
        simplified = work + [work[0]]
    if ring_area(simplified) < min_area:
        return []
    return [[round(x, 5), round(y, 5)] for x, y in simplified]


def simplify_geometry(geometry: dict[str, Any], tolerance: float, min_area: float):
    gtype = geometry["type"]
    if gtype == "Polygon":
        rings = [
            simplified
            for ring in geometry["coordinates"]
            if (simplified := simplify_ring(ring, tolerance, min_area))
        ]
        if not rings:
            return None
        return {"type": "Polygon", "coordinates": rings}
    if gtype == "MultiPolygon":
        polygons = []
        for polygon in geometry["coordinates"]:
            rings = [
                simplified
                for ring in polygon
                if (simplified := simplify_ring(ring, tolerance, min_area))
            ]
            if rings:
                polygons.append(rings)
        if not polygons:
            return None
        return {"type": "MultiPolygon", "coordinates": polygons}
    return None


def clean_code(value):
    if value in (None, "", "-99"):
        return None
    return value


def build_feature(record: dict[str, Any], geometry, kind: str):
    if kind == "country":
        fid = (
            clean_code(record.get("ISO_A3_EH"))
            or clean_code(record.get("ADM0_ISO"))
            or clean_code(record.get("ISO_A3"))
            or clean_code(record.get("ADM0_A3"))
            or clean_code(record.get("SOV_A3"))
        )
        props = {
            "id": fid,
            "level": "country",
            "name": record.get("NAME_EN") or record.get("NAME") or record.get("ADMIN"),
            "localName": COUNTRY_NAME_ALIASES_ZH.get(fid)
            or record.get("NAME_ZH")
            or record.get("NAME")
            or record.get("ADMIN"),
            "code": fid,
            "isoA2": clean_code(record.get("ISO_A2_EH")) or clean_code(record.get("ISO_A2")),
            "continent": record.get("CONTINENT"),
            "region": record.get("REGION_UN") or record.get("CONTINENT"),
            "subregion": record.get("SUBREGION"),
        }
    else:
        fid = record.get("adm1_code") or record.get("iso_3166_2")
        props = {
            "id": fid,
            "level": "region",
            "parentId": record.get("adm0_a3"),
            "name": record.get("name_en") or record.get("name"),
            "localName": record.get("name_zh") or record.get("name"),
            "code": fid,
            "iso3166_2": record.get("iso_3166_2"),
            "country": record.get("admin"),
            "countryCode": record.get("adm0_a3"),
            "type": record.get("type_en") or record.get("type"),
            "latitude": record.get("latitude"),
            "longitude": record.get("longitude"),
        }
    return {"type": "Feature", "id": props["id"], "properties": props, "geometry": geometry}


def convert(source: Path, target: Path, kind: str, tolerance: float, min_area: float):
    reader = shapefile.Reader(str(source), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    features = []

    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        geometry = simplify_geometry(shape_record.shape.__geo_interface__, tolerance, min_area)
        if not geometry:
            continue
        features.append(build_feature(record, geometry, kind))

    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "source": source.name,
            "kind": kind,
            "tolerance": tolerance,
            "minArea": min_area,
            "featureCount": len(features),
        },
        "features": features,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{target}: {len(features)} features, {target.stat().st_size / 1024 / 1024:.2f} MB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="世界地图")
    parser.add_argument("--output-dir", default="public/maps")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    output_dir = Path(args.output_dir)
    convert(
        source_dir / "WorldBoundaries.shp",
        output_dir / "countries.geojson",
        "country",
        tolerance=0.12,
        min_area=0,
    )
    convert(
        source_dir / "WorldStates.shp",
        output_dir / "states.geojson",
        "region",
        tolerance=0.12,
        min_area=0,
    )


if __name__ == "__main__":
    main()
