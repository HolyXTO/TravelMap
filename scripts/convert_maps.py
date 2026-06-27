from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

import shapefile


WGS84_A = 6378137.0
WGS84_E = 0.08181919084262149

UN_AND_OBSERVER_ISO3 = {
    "AFG", "ALB", "DZA", "AND", "AGO", "ATG", "ARG", "ARM", "AUS", "AUT",
    "AZE", "BHS", "BHR", "BGD", "BRB", "BLR", "BEL", "BLZ", "BEN", "BTN",
    "BOL", "BIH", "BWA", "BRA", "BRN", "BGR", "BFA", "BDI", "CPV", "KHM",
    "CMR", "CAN", "CAF", "TCD", "CHL", "CHN", "COL", "COM", "COG", "CRI",
    "CIV", "HRV", "CUB", "CYP", "CZE", "COD", "DNK", "DJI", "DMA", "DOM",
    "ECU", "EGY", "SLV", "GNQ", "ERI", "EST", "SWZ", "ETH", "FJI", "FIN",
    "FRA", "GAB", "GMB", "GEO", "DEU", "GHA", "GRC", "GRD", "GTM", "GIN",
    "GNB", "GUY", "HTI", "HND", "HUN", "ISL", "IND", "IDN", "IRN", "IRQ",
    "IRL", "ISR", "ITA", "JAM", "JPN", "JOR", "KAZ", "KEN", "KIR", "PRK",
    "KOR", "KWT", "KGZ", "LAO", "LVA", "LBN", "LSO", "LBR", "LBY", "LIE",
    "LTU", "LUX", "MDG", "MWI", "MYS", "MDV", "MLI", "MLT", "MHL", "MRT",
    "MUS", "MEX", "FSM", "MDA", "MCO", "MNG", "MNE", "MAR", "MOZ", "MMR",
    "NAM", "NRU", "NPL", "NLD", "NZL", "NIC", "NER", "NGA", "MKD", "NOR",
    "OMN", "PAK", "PLW", "PAN", "PNG", "PRY", "PER", "PHL", "POL", "PRT",
    "QAT", "ROU", "RUS", "RWA", "KNA", "LCA", "VCT", "WSM", "SMR", "STP",
    "SAU", "SEN", "SRB", "SYC", "SLE", "SGP", "SVK", "SVN", "SLB", "SOM",
    "ZAF", "SSD", "ESP", "LKA", "SDN", "SUR", "SWE", "CHE", "SYR", "TJK",
    "THA", "TLS", "TGO", "TON", "TTO", "TUN", "TUR", "TKM", "TUV", "UGA",
    "UKR", "ARE", "GBR", "TZA", "USA", "URY", "UZB", "VUT", "VEN", "VNM",
    "YEM", "ZMB", "ZWE", "VAT", "PSE",
}

COUNTRY_MERGE_OVERRIDES = {
    "CYN": "CYP",
    "CNM": "CYP",
    "KOS": "SRB",
}

COUNTRY_NAME_ALIASES_ZH = {
    "CHN": "中国",
    "USA": "美国",
    "DEU": "德国",
    "FRA": "法国",
    "ITA": "意大利",
    "JPN": "日本",
    "KOR": "韩国",
    "SGP": "新加坡",
    "GBR": "英国",
    "RUS": "俄罗斯",
    "VAT": "梵蒂冈",
    "PSE": "巴勒斯坦",
    "ATA": "南极洲",
}

STATUS_OWNER_PREFIX = {
    "UK": "GBR",
    "FR": "FRA",
    "AU": "AUS",
    "US": "USA",
    "NZ": "NZL",
    "PT": "PRT",
    "CN": "CHN",
    "NL": "NLD",
    "DK": "DNK",
    "NO": "NOR",
}

TRADITIONAL_TO_SIMPLIFIED = str.maketrans(
    {
        "臺": "台",
        "灣": "湾",
        "縣": "县",
        "區": "区",
        "聖": "圣",
        "馬": "马",
        "諾": "诺",
        "羅": "罗",
        "義": "义",
        "蘭": "兰",
        "華": "华",
        "爾": "尔",
        "維": "维",
        "納": "纳",
        "薩": "萨",
        "亞": "亚",
        "達": "达",
        "魯": "鲁",
        "賓": "宾",
        "圖": "图",
        "倫": "伦",
        "頓": "顿",
        "漢": "汉",
        "麗": "丽",
        "廣": "广",
        "東": "东",
        "門": "门",
        "開": "开",
        "關": "关",
        "陽": "阳",
        "陰": "阴",
        "長": "长",
        "島": "岛",
        "國": "国",
        "聯": "联",
        "堅": "坚",
        "祿": "禄",
        "樂": "乐",
        "愛": "爱",
        "爭": "争",
        "書": "书",
        "萬": "万",
        "與": "与",
        "廣": "广",
        "慶": "庆",
        "瀋": "沈",
        "濟": "济",
        "寧": "宁",
        "鄭": "郑",
        "鄧": "邓",
        "貝": "贝",
        "奧": "奥",
        "凱": "凯",
        "萊": "莱",
        "內": "内",
        "紐": "纽",
        "約": "约",
        "聶": "聂",
        "茲": "兹",
        "費": "费",
        "賽": "赛",
        "盧": "卢",
        "蘇": "苏",
        "俄": "俄",
        "舊": "旧",
        "廳": "厅",
        "廈": "厦",
        "廟": "庙",
        "鄉": "乡",
        "鎮": "镇",
        "烏": "乌",
        "鴻": "鸿",
        "鷹": "鹰",
        "龍": "龙",
        "雙": "双",
        "鳳": "凤",
        "黃": "黄",
        "鹽": "盐",
        "臺": "台",
    }
)


def mercator_to_lonlat(x, y):
    lon = math.degrees(x / WGS84_A)
    t = math.exp(-y / WGS84_A)
    lat = math.pi / 2 - 2 * math.atan(t)
    for _ in range(8):
        esin = WGS84_E * math.sin(lat)
        lat = math.pi / 2 - 2 * math.atan(
            t * ((1 - esin) / (1 + esin)) ** (WGS84_E / 2)
        )
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


def clean_text(value):
    value = str(value or "").translate(TRADITIONAL_TO_SIMPLIFIED)
    return re.sub(r"[\[〔【（(]\s*\d+\s*[\]〕】）)]", "", value).strip()


def merge_geometry(base, extra):
    base_polygons = [base["coordinates"]] if base["type"] == "Polygon" else list(base["coordinates"])
    extra_polygons = [extra["coordinates"]] if extra["type"] == "Polygon" else list(extra["coordinates"])
    return {"type": "MultiPolygon", "coordinates": base_polygons + extra_polygons}


def build_feature(record: dict[str, Any], geometry, kind: str):
    if kind == "country":
        source_id = clean_code(record.get("ADM0_A3"))
        fid = COUNTRY_MERGE_OVERRIDES.get(source_id) or (
            clean_code(record.get("ISO_A3_EH"))
            or clean_code(record.get("ADM0_ISO"))
            or clean_code(record.get("ISO_A3"))
            or source_id
            or clean_code(record.get("SOV_A3"))
        )
        if fid not in UN_AND_OBSERVER_ISO3:
            return None
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
    elif kind == "region":
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
    else:
        fid = record.get("ADM2_PCODE")
        props = {
            "id": fid,
            "level": "city",
            "parentId": record.get("ADM1_PCODE"),
            "name": record.get("ADM2_EN"),
            "localName": record.get("ADM2_ZH") or record.get("ADM2_EN"),
            "code": fid,
            "country": record.get("ADM0_EN"),
            "countryCode": record.get("ADM0_PCODE"),
            "province": record.get("ADM1_ZH") or record.get("ADM1_EN"),
            "provinceCode": record.get("ADM1_PCODE"),
            "type": record.get("Admin_type"),
        }
    return {"type": "Feature", "id": props["id"], "properties": props, "geometry": geometry}


def target_country_id(record: dict[str, Any]):
    terr = clean_code(record.get("ISO_3_terr"))
    owner = clean_code(record.get("ISO_3_coun"))
    status = record.get("Status") or ""
    name = record.get("English_Na") or ""

    if terr in UN_AND_OBSERVER_ISO3:
        return COUNTRY_MERGE_OVERRIDES.get(terr, terr)
    if terr in {"TWN", "HKG", "MAC"}:
        return "CHN"
    if name in {"Gaza Strip", "West Bank"}:
        return "PSE"

    for prefix, country_id in STATUS_OWNER_PREFIX.items():
        if status.startswith(prefix):
            return country_id
    if status.startswith("Adm. by"):
        administered_by = status.replace("Adm. by", "").strip()
        return {"EGY": "EGY", "KEN": "KEN", "SDN": "SDN"}.get(administered_by, owner)
    if owner in UN_AND_OBSERVER_ISO3:
        return owner
    return None


def country_props(country_id: str, record: dict[str, Any], is_country=True):
    country_name_overrides = {
        "PSE": "Palestine",
        "VAT": "Holy See",
        "CHN": "China",
    }
    return {
        "id": country_id,
        "level": "country",
        "name": country_name_overrides.get(country_id)
        or clean_text(record.get("English_Na"))
        or country_id,
        "localName": COUNTRY_NAME_ALIASES_ZH.get(country_id)
        or clean_text(record.get("English_Na"))
        or country_id,
        "code": country_id,
        "isoA2": clean_code(record.get("ISO_3166_1")),
        "continent": record.get("Continent_") or "Other",
        "region": record.get("Continent_") or "Other",
        "subregion": record.get("Region_of_") or "",
        "isCountry": is_country,
    }


def build_country_features(source: Path, antarctica_source: Path, tolerance: float, min_area: float):
    reader = shapefile.Reader(str(source), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    grouped: dict[str, dict[str, Any]] = {}

    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        country_id = target_country_id(record)
        if not country_id:
            continue
        geometry = simplify_geometry(shape_record.shape.__geo_interface__, tolerance, min_area)
        if not geometry:
            continue
        is_main = (
            clean_code(record.get("ISO_3_terr")) == country_id
            and record.get("Status") in {"Member State", "Permanent Observer to the UN"}
        ) or country_id == "PSE"
        props = country_props(country_id, record)
        current = grouped.get(country_id)
        if current:
            current["geometry"] = merge_geometry(current["geometry"], geometry)
            if is_main:
                current["properties"].update(props)
            continue
        grouped[country_id] = {
            "type": "Feature",
            "id": country_id,
            "properties": props,
            "geometry": geometry,
        }

    antarctica = build_antarctica_feature(antarctica_source, tolerance, min_area)
    if antarctica:
        grouped["ATA"] = antarctica

    return [grouped[key] for key in sorted(grouped)]


def build_special_china_region_features(source: Path):
    special = {
        "TWN": {
            "id": "CN-TW",
            "name": "Taiwan",
            "localName": "台湾",
            "iso3166_2": "CN-TW",
            "type": "Province",
        },
        "HKG": {
            "id": "CN-HK",
            "name": "Hong Kong",
            "localName": "香港",
            "iso3166_2": "CN-HK",
            "type": "Special Administrative Region",
        },
        "MAC": {
            "id": "CN-MO",
            "name": "Macao",
            "localName": "澳门",
            "iso3166_2": "CN-MO",
            "type": "Special Administrative Region",
        },
    }
    reader = shapefile.Reader(str(source), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    features = []
    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        terr = clean_code(record.get("ISO_3_terr"))
        if terr not in special:
            continue
        geometry = simplify_geometry(shape_record.shape.__geo_interface__, 0.01, 0)
        if not geometry:
            continue
        item = special[terr]
        props = {
            "id": item["id"],
            "level": "region",
            "parentId": "CHN",
            "name": item["name"],
            "localName": item["localName"],
            "code": item["id"],
            "iso3166_2": item["iso3166_2"],
            "country": "China",
            "countryCode": "CHN",
            "type": item["type"],
            "latitude": geometryCenter_latlon(geometry)[1],
            "longitude": geometryCenter_latlon(geometry)[0],
        }
        features.append(
            {"type": "Feature", "id": item["id"], "properties": props, "geometry": geometry}
        )
    return features


def build_antarctica_feature(source: Path, tolerance: float, min_area: float):
    reader = shapefile.Reader(str(source), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        if record.get("ADM0_A3") != "ATA":
            continue
        geometry = simplify_geometry(shape_record.shape.__geo_interface__, tolerance, min_area)
        if not geometry:
            return None
        return {
            "type": "Feature",
            "id": "ATA",
            "properties": {
                "id": "ATA",
                "level": "country",
                "name": "Antarctica",
                "localName": "南极洲",
                "code": "ATA",
                "isoA2": "AQ",
                "continent": "Antarctica",
                "region": "Antarctica",
                "subregion": "Antarctica",
                "isCountry": False,
            },
            "geometry": geometry,
        }
    return None


def geometryCenter_latlon(geometry):
    points = []

    def collect(item):
        if not isinstance(item, list):
            return
        if item and isinstance(item[0], (int, float)):
            points.append(item)
            return
        for child in item:
            collect(child)

    collect(geometry.get("coordinates"))
    if not points:
        return [0, 0]
    lons = [point[0] for point in points]
    lats = [point[1] for point in points]
    return [round((min(lons) + max(lons)) / 2, 5), round((min(lats) + max(lats)) / 2, 5)]


def convert(source: Path, target: Path, kind: str, tolerance: float, min_area: float):
    reader = shapefile.Reader(str(source), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    features = []

    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        geometry = simplify_geometry(shape_record.shape.__geo_interface__, tolerance, min_area)
        if not geometry:
            continue
        feature = build_feature(record, geometry, kind)
        if not feature:
            continue
        if kind == "country":
            existing = next((item for item in features if item["id"] == feature["id"]), None)
            if existing:
                existing["geometry"] = merge_geometry(existing["geometry"], feature["geometry"])
                continue
        features.append(feature)

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
    target.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{target}: {len(features)} features, {target.stat().st_size / 1024 / 1024:.2f} MB")
    return collection


def convert_countries(source: Path, antarctica_source: Path, target: Path):
    features = build_country_features(source, antarctica_source, tolerance=0.01, min_area=0)
    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "source": source.name,
            "kind": "country",
            "tolerance": 0.01,
            "minArea": 0,
            "countryCount": sum(1 for item in features if item["properties"].get("isCountry", True)),
            "featureCount": len(features),
        },
        "features": features,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{target}: {len(features)} features, {target.stat().st_size / 1024 / 1024:.2f} MB")
    return collection


def convert_china_regions(source: Path, countries_source: Path, target: Path):
    reader = shapefile.Reader(str(source), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    features = []
    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        if record.get("adm0_a3") != "CHN":
            continue
        if not str(record.get("adm1_code") or "").startswith("CHN-"):
            continue
        geometry = simplify_geometry(shape_record.shape.__geo_interface__, 0.02, 0)
        if not geometry:
            continue
        feature = build_feature(record, geometry, "region")
        if feature:
            features.append(feature)
    features.extend(build_special_china_region_features(countries_source))
    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "source": source.name,
            "kind": "region",
            "scope": "China only",
            "tolerance": 0.02,
            "minArea": 0,
        "featureCount": len(features),
        },
        "features": features,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{target}: {len(features)} features, {target.stat().st_size / 1024 / 1024:.2f} MB")
    return collection


def flag_emoji(iso_a2: str | None):
    if not iso_a2 or len(iso_a2) != 2:
        return "◇"
    iso_a2 = iso_a2.upper()
    if not iso_a2.isalpha():
        return "◇"
    return "".join(chr(0x1F1E6 + ord(char) - ord("A")) for char in iso_a2)


def iso2_for_country(country_id, props=None):
    if props and props.get("isoA2"):
        return props.get("isoA2")
    return {
        "CHN": "CN",
        "HKG": "HK",
        "MAC": "MO",
        "TWN": "TW",
    }.get(country_id)


def center_from_geometry(geometry):
    points = []

    def collect(item):
        if not isinstance(item, list):
            return
        if item and isinstance(item[0], (int, float)):
            points.append(item)
            return
        for child in item:
            collect(child)

    collect(geometry.get("coordinates"))
    if not points:
        return [0, 0]
    lons = [point[0] for point in points]
    lats = [point[1] for point in points]
    return [round((min(lons) + max(lons)) / 2, 5), round((min(lats) + max(lats)) / 2, 5)]


def place_from_feature(feature):
    props = feature["properties"]
    center = [
        float(props.get("longitude") or 0),
        float(props.get("latitude") or 0),
    ]
    if center == [0.0, 0.0]:
        center = center_from_geometry(feature["geometry"])
    iso2 = iso2_for_country(props.get("code") or props.get("countryCode"), props)
    return {
        "id": props["id"],
        "level": props["level"],
        "name": clean_text(props.get("name")),
        "localName": clean_text(props.get("localName")),
        "parentId": props.get("parentId"),
        "countryCode": props.get("countryCode") or props.get("code") or props["id"],
        "countryName": props.get("country") or props.get("localName") or props.get("name"),
        "region": props.get("region") or props.get("continent") or "",
        "province": props.get("province") or "",
        "provinceCode": props.get("provinceCode") or "",
        "center": center,
        "isoA2": iso2,
        "flag": flag_emoji(iso2),
    }


def build_place_index(countries, regions, cities, world_points: Path, target: Path):
    country_by_id = {feature["id"]: feature["properties"] for feature in countries["features"]}
    province_by_name = {
        feature["properties"].get("localName"): feature["properties"]["id"]
        for feature in regions["features"]
    }
    places = []
    for feature in countries["features"]:
        props = feature["properties"]
        if props.get("isCountry", True):
            places.append(place_from_feature(feature))
    for feature in regions["features"]:
        place = place_from_feature(feature)
        place["countryCode"] = "CHN"
        place["countryName"] = "中国"
        place["flag"] = "🇨🇳"
        places.append(place)
    for feature in cities["features"]:
        props = feature["properties"]
        props["parentId"] = province_by_name.get(props.get("province"), props.get("parentId"))
        feature["properties"] = props
        place = place_from_feature(feature)
        place["countryCode"] = "CHN"
        place["countryName"] = "中国"
        place["flag"] = "🇨🇳"
        places.append(place)

    reader = shapefile.Reader(str(world_points), encoding="utf-8", encodingErrors="replace")
    fields = [field[0] for field in reader.fields[1:]]
    seen = {place["id"] for place in places}
    for shape_record in reader.iterShapeRecords():
        record = dict(zip(fields, shape_record.record))
        country_id = COUNTRY_MERGE_OVERRIDES.get(clean_code(record.get("ADM0_A3")), clean_code(record.get("ADM0_A3")))
        if country_id in {"CHN", None}:
            continue
        if country_id == "TWN":
            country_id = "CHN"
        if country_id not in country_by_id:
            continue
        lon = float(record.get("LONGITUDE") or shape_record.shape.points[0][0])
        lat = float(record.get("LATITUDE") or shape_record.shape.points[0][1])
        name = clean_text(record.get("NAMEASCII") or record.get("NAME"))
        local_name = clean_text(record.get("name_zh") or record.get("NAME"))
        geoname_id = clean_text(record.get("GEONAMEID"))
        place_id = f"W-{geoname_id}" if geoname_id else f"W-{country_id}-{name}-{round(lon, 3)}-{round(lat, 3)}"
        if place_id in seen:
            continue
        seen.add(place_id)
        country = country_by_id[country_id]
        places.append(
            {
                "id": place_id,
                "level": "city",
                "name": name,
                "localName": local_name or name,
                "parentId": country_id,
                "countryCode": country_id,
                "countryName": country.get("localName") or country.get("name"),
                "province": clean_text(record.get("ADM1NAME")),
                "region": country.get("region") or country.get("continent") or "",
                "center": [round(lon, 5), round(lat, 5)],
                "isoA2": iso2_for_country(country_id, country),
                "flag": flag_emoji(iso2_for_country(country_id, country)),
                "population": int(record.get("POP_MAX") or 0),
            }
        )

    places.sort(key=lambda item: (item["level"] != "country", item.get("countryName", ""), item.get("localName", "")))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(places, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{target}: {len(places)} places, {target.stat().st_size / 1024 / 1024:.2f} MB")
    return places


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default="世界地图")
    parser.add_argument("--output-dir", default="public/maps")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    output_dir = Path(args.output_dir)
    countries = convert_countries(
        source_dir / "world-administrative-boundaries_256.shp",
        source_dir / "WorldBoundaries.shp",
        output_dir / "countries.geojson",
    )
    regions = convert_china_regions(
        source_dir / "WorldStates.shp",
        source_dir / "world-administrative-boundaries_256.shp",
        output_dir / "states.geojson",
    )
    cities = convert(
        source_dir / "ChinaCityBoundaries.shp",
        output_dir / "china-cities.geojson",
        "city",
        tolerance=0.02,
        min_area=0,
    )
    build_place_index(
        countries,
        regions,
        cities,
        source_dir / "世界地名points.shp",
        output_dir / "place-index.json",
    )


if __name__ == "__main__":
    main()
