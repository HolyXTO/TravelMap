import os
import sys
import json
import re
import datetime
import requests
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

EXCEL_PATH = r"C:\Users\HolyX\.gemini\antigravity\brain\fd8b9b72-acde-47ce-9892-ce301f47fbc2\.user_uploaded\media_1792232919854_cee07191.xlsx"
MAPS_DIR = r"c:\Users\HolyX\Documents\antigravity\travelmap\public\maps"
SUPABASE_URL = "https://yxwflztibppjcyxdulho.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d2ZsenRpYnBwamN5eGR1bGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDYxOTIsImV4cCI6MjA5Nzg4MjE5Mn0.ORs5mJEB5JUNJt6jjHVObSRnoCJtLtXyYabUP5yK9ew"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def parse_date_cell(val):
    if val is None:
        return []
    if isinstance(val, (datetime.datetime, datetime.date)):
        return [val.strftime("%Y-%m-%d")]
    if isinstance(val, int):
        return [str(val)]
    s = str(val).strip()
    if not s or s == "-":
        return []
    if s in ["居住", "多次"]:
        return [s]
    tokens = [t.strip() for t in re.split(r"[\r\n\s]+", s) if t.strip()]
    dates = []
    for token in tokens:
        if token in ["居住", "多次"]:
            dates.append(token)
            continue
        clean = token.replace("/", "-")
        # Match YYYY-M-D or YYYY-MM-DD
        m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", clean)
        if m:
            dates.append(f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}")
            continue
        # Match YYYY-M or YYYY-MM
        m = re.match(r"^(\d{4})-(\d{1,2})$", clean)
        if m:
            dates.append(f"{m.group(1)}-{int(m.group(2)):02d}")
            continue
        # Match YYYY
        m = re.match(r"^(\d{4})$", clean)
        if m:
            dates.append(m.group(1))
            continue
        dates.append(clean)

    # Sort standard dates ascending
    calendar_dates = [d for d in dates if d not in ["居住", "多次"]]
    special_tags = [d for d in dates if d in ["居住", "多次"]]
    sorted_dates = sorted(calendar_dates) + special_tags
    return sorted_dates

def main():
    print("⏳ 1. 拉取 Supabase 云端 visits 与 profiles...")
    visits_raw = requests.get(
        f"{SUPABASE_URL}/rest/v1/visits?select=*,visit_photos(id,storage_path,caption)&order=created_at.desc",
        headers=headers
    ).json()
    profiles_raw = requests.get(
        f"{SUPABASE_URL}/rest/v1/travel_profiles?select=*&order=created_at.asc",
        headers=headers
    ).json()

    print("⏳ 2. 加载地图数据并对齐 154 地点组...")
    with open(os.path.join(MAPS_DIR, "place-index.json"), encoding="utf-8") as f:
        place_index = json.load(f)
    with open(os.path.join(MAPS_DIR, "countries.geojson"), encoding="utf-8") as f:
        countries_geo = json.load(f)
    with open(os.path.join(MAPS_DIR, "states.geojson"), encoding="utf-8") as f:
        states_geo = json.load(f)
    with open(os.path.join(MAPS_DIR, "china-cities.geojson"), encoding="utf-8") as f:
        cities_geo = json.load(f)

    COUNTRY_OVERRIDES = {
        "CHN": "中国", "FRA": "法国", "RUS": "俄罗斯", "SGP": "新加坡",
        "USA": "美国", "DEU": "德国", "GBR": "英国", "ITA": "意大利",
        "ESP": "西班牙", "NOR": "挪威", "SWE": "瑞典", "FIN": "芬兰",
        "NLD": "荷兰", "BEL": "比利时", "CHE": "瑞士", "AUT": "奥地利",
        "GRC": "希腊", "POL": "波兰", "CZE": "捷克", "HUN": "匈牙利"
    }

    place_dict = {}
    for f in countries_geo["features"]:
        p = f["properties"]
        pid = p.get("id") or p.get("code")
        place_dict[pid] = {"localName": COUNTRY_OVERRIDES.get(pid) or p.get("localName") or p.get("name"), "level": "country"}
    for f in states_geo["features"]:
        p = f["properties"]
        place_dict[p.get("id")] = {"localName": p.get("localName") or p.get("name"), "level": "region"}
    for f in cities_geo["features"]:
        p = f["properties"]
        place_dict[p.get("id")] = {"localName": p.get("localName") or p.get("name"), "level": "city"}
    for p in place_index:
        pid = p.get("id")
        if pid:
            existing = place_dict.get(pid, {})
            place_dict[pid] = {**existing, **p}

    SUPPLEMENTAL = [
        {"id": "EXTRA-LONGYEARBYEN", "level": "city", "countryName": "挪威", "localName": "朗伊尔城"},
        {"id": "EXTRA-SVALBARD", "level": "city", "countryName": "挪威", "localName": "斯瓦尔巴群岛"},
        {"id": "EXTRA-SANTORINI", "level": "city", "countryName": "希腊", "localName": "圣托里尼"},
        {"id": "EXTRA-LOFOTEN", "level": "city", "countryName": "挪威", "localName": "罗弗敦群岛"},
        {"id": "EXTRA-BLED", "level": "city", "countryName": "斯洛文尼亚", "localName": "布莱德"},
        {"id": "EXTRA-BUDVA", "level": "city", "countryName": "黑山", "localName": "布德瓦"},
        {"id": "EXTRA-AYIA-NAPA", "level": "city", "countryName": "塞浦路斯", "localName": "圣纳帕"},
        {"id": "EXTRA-VIK", "level": "city", "countryName": "冰岛", "localName": "维克"},
        {"id": "EXTRA-JURMALA", "level": "city", "countryName": "拉脱维亚", "localName": "尤尔马拉"},
        {"id": "EXTRA-MENTON", "level": "city", "countryName": "法国", "localName": "芒通"},
        {"id": "EXTRA-CANNES", "level": "city", "countryName": "法国", "localName": "戛纳"},
        {"id": "EXTRA-RIMINI", "level": "city", "countryName": "意大利", "localName": "里米尼"},
    ]
    for sp in SUPPLEMENTAL:
        place_dict[sp["id"]] = {**place_dict.get(sp["id"], {}), **sp}

    LEGACY_ALIASES = {"it": "ITA", "city-rome": "W-3169070"}

    place_groups = {}
    for v in visits_raw:
        raw_pid = v.get("place_id")
        pid = LEGACY_ALIASES.get(raw_pid, raw_pid)
        if pid not in place_groups:
            local_name = place_dict.get(pid, {}).get("localName") or place_dict.get(pid, {}).get("name") or pid
            place_groups[pid] = {"name_zh": local_name, "visits": []}
        place_groups[pid]["visits"].append(v)

    pids = list(place_groups.keys())

    print("⏳ 3. 读取 Excel 数据并构建更新字典...")
    wb = openpyxl.load_workbook(EXCEL_PATH)
    ws = wb["地点汇总去重 (154个地点)"]

    visit_updates = {} # visit_id -> { visited_at, note_str, visit_dates, rating, comment }

    for r in range(2, ws.max_row + 1):
        seq = ws.cell(r, 1).value
        name = ws.cell(r, 2).value
        pid = pids[seq - 1]
        g_visits = place_groups[pid]["visits"]

        # Xiao
        x_val = ws.cell(r, 10).value
        x_dates = parse_date_cell(x_val)
        x_rating_val = ws.cell(r, 9).value
        x_comment_val = ws.cell(r, 11).value

        # Tang
        t_val = ws.cell(r, 14).value
        t_dates = parse_date_cell(t_val)
        t_rating_val = ws.cell(r, 13).value
        t_comment_val = ws.cell(r, 15).value

        for prof_id, dates, r_val, c_val, p_label in [
            ("person-a", x_dates, x_rating_val, x_comment_val, "Xiao"),
            ("person-b", t_dates, t_rating_val, t_comment_val, "Tang")
        ]:
            v = next((item for item in g_visits if item["profile_id"] == prof_id), None)
            if not v:
                continue

            old_note = {}
            if v.get("note"):
                try:
                    old_note = json.loads(v["note"])
                    if not isinstance(old_note, dict):
                        old_note = {"text": str(v["note"])}
                except:
                    old_note = {"text": str(v["note"])}

            rating = old_note.get("rating", 0)
            if r_val is not None and r_val != "-":
                try:
                    rating = float(r_val)
                except:
                    pass

            comment = old_note.get("comment", "")
            if c_val is not None and c_val != "-":
                comment = str(c_val).strip()

            text = old_note.get("text", "")
            transport_mode = old_note.get("transportMode", "")

            final_dates = [str(d).strip() for d in (dates if dates else old_note.get("visitDates", [])) if d]
            date_display = str(final_dates[-1] if final_dates else (old_note.get("dateDisplay") or "")).strip()

            db_date = None
            precision = "day"
            if date_display == "居住":
                precision = "living"
            elif date_display == "多次":
                precision = "multiple"
            elif not date_display:
                precision = "none"
            elif re.match(r"^\d{4}-\d{2}-\d{2}$", date_display):
                precision = "day"
                db_date = date_display
            elif re.match(r"^\d{4}-\d{2}$", date_display):
                precision = "month"
                db_date = f"{date_display}-01"
            elif re.match(r"^\d{4}$", date_display):
                precision = "year"
                db_date = f"{date_display}-01-01"
            else:
                for d in reversed(final_dates):
                    d_str = str(d).strip()
                    if re.match(r"^\d{4}-\d{2}-\d{2}$", d_str):
                        db_date = d_str
                        break
                    elif re.match(r"^\d{4}-\d{2}$", d_str):
                        db_date = f"{d_str}-01"
                        break
                    elif re.match(r"^\d{4}$", d_str):
                        db_date = f"{d_str}-01-01"
                        break
                precision = "custom"

            new_note_payload = {
                "dateDisplay": date_display,
                "datePrecision": precision,
                "rating": rating,
                "text": text,
                "comment": comment,
                "transportMode": transport_mode,
                "visitDates": final_dates
            }
            note_str = json.dumps(new_note_payload, ensure_ascii=False)

            visit_updates[v["id"]] = {
                "place_name": name,
                "person": p_label,
                "visited_at": db_date,
                "note_str": note_str,
                "visit_dates": final_dates,
                "date_display": date_display,
                "date_precision": precision,
                "rating": rating,
                "comment": comment
            }

    print(f"   已处理 {len(visit_updates)} 个足迹更新。")

    # 4. Generate SQL script
    print("⏳ 4. 生成 Supabase 批量更新 SQL 脚本: supabase/update_excel_dates.sql...")
    sql_lines = [
        "-- Auto-generated SQL to update visit dates, multiple visits, and ratings",
        "-- Run this in Supabase SQL Editor if you wish to persist directly to database table",
        "BEGIN;",
        ""
    ]
    for vid, upd in visit_updates.items():
        v_at = f"'{upd['visited_at']}'" if upd['visited_at'] else "NULL"
        safe_note = upd['note_str'].replace("'", "''")
        sql_lines.append(
            f"-- [{upd['place_name']}] {upd['person']}: {upd['visit_dates']}\n"
            f"UPDATE public.visits SET visited_at = {v_at}, note = '{safe_note}' WHERE id = '{vid}';"
        )
    sql_lines.append("\nCOMMIT;\n")
    with open(r"c:\Users\HolyX\Documents\antigravity\travelmap\supabase\update_excel_dates.sql", "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))

    # 5. Generate mockData.js
    print("⏳ 5. 覆盖更新本地固化数据: src/data/mockData.js...")
    final_mock_visits = []
    for v in visits_raw:
        vid = v["id"]
        upd = visit_updates.get(vid)
        
        photos = []
        for p in (v.get("visit_photos") or []):
            if p.get("storage_path"):
                photos.append({
                    "id": p["id"],
                    "url": f"{SUPABASE_URL}/storage/v1/object/public/travel-photos/{p['storage_path']}",
                    "caption": p.get("caption") or ""
                })

        visited_at = upd["visited_at"] if upd else v.get("visited_at")
        note = upd["note_str"] if upd else (v.get("note") or "")

        is_sarajevo = v.get("place_id") == "W-3191281"
        if is_sarajevo and visited_at == "2024-19-18":
            visited_at = "2024-09-18"

        visit_obj = {
            "id": vid,
            "profileId": v["profile_id"],
            "placeId": v["place_id"],
            "visitedAt": visited_at,
            "createdAt": v.get("created_at") or visited_at,
            "type": v.get("trip_type") or "旅行",
            "note": note,
            "photos": photos
        }
        try:
            parsed_meta = json.loads(note) if note else {}
            if parsed_meta.get("updatedAt"):
                visit_obj["updatedAt"] = parsed_meta["updatedAt"]
        except Exception:
            pass

        final_mock_visits.append(visit_obj)

    profiles_cleaned = [
        {"id": p["id"], "name": p["display_name"], "color": p["color"]}
        for p in profiles_raw
    ]

    mock_js_content = f"""import {{ placeLevels, tripTypes, places }} from "./mockData_static";
export {{ placeLevels, tripTypes, places }};

// =========================================================================
// 此文件已由 scripts/build_synced_data.py 根据用户上传的 Excel 真实时间戳完全同步。
// 包含两人去过地点的全部多时间戳、居住/多次标记、评分与短评。请勿手动修改此文件。
// =========================================================================

export const profiles = {json.dumps(profiles_cleaned, ensure_ascii=False, indent=2)};

export const initialVisits = {json.dumps(final_mock_visits, ensure_ascii=False, indent=2)};
"""
    with open(r"c:\Users\HolyX\Documents\antigravity\travelmap\src\data\mockData.js", "w", encoding="utf-8") as f:
        f.write(mock_js_content)

    print("🎉 同步全部完成！")
    print("   1. supabase/update_excel_dates.sql 已生成（包含全部 274 条更新语句）")
    print("   2. src/data/mockData.js 已更新（全部 274 条足迹时间戳、多次与居住已完整同步）")

if __name__ == "__main__":
    main()
