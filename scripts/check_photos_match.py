import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('src/data/mockData.js', 'r', encoding='utf-8') as f:
    mock_content = f.read()

m = re.search(r'export const initialVisits = (\[.*?\]);', mock_content, re.DOTALL)
visits = json.loads(m.group(1)) if m else []
visited_pids = set(v['placeId'] for v in visits)

with open('public/maps/china-cities.geojson', 'r', encoding='utf-8') as f:
    china_cities = json.load(f)
china_map = {feat['properties']['id']: feat['properties'] for feat in china_cities['features']}

with open('public/maps/place-index.json', 'r', encoding='utf-8') as f:
    place_index = json.load(f)
index_map = {p['id']: p for p in place_index}

with open('scratch_photos.json', 'r', encoding='utf-8') as f:
    photo_folders = json.load(f)

print(f"Total candidate folders: {len(photo_folders)}\n")

for item in photo_folders:
    name = item['folder']
    count = item['count']
    size = item['size_mb']
    # find in visited places
    matches = []
    for pid in visited_pids:
        info = china_map.get(pid) or index_map.get(pid)
        if not info:
            continue
        pname = info.get('localName') or info.get('name') or ''
        aliases = info.get('aliases') or []
        country = info.get('countryName') or ('中国' if pid.startswith('CN') else '')
        if name == pname or name in pname or any(name == a for a in aliases):
            matches.append((pid, pname, country, '中国城市多边形(矢量边界)' if pid in china_map else '国外城市(点坐标)'))
    print(f"【{name}】: {count} 张照片 ({size} MB)")
    if matches:
        for m in matches:
            print(f"   -> 匹配足迹城市: id={m[0]}, 城市名={m[1]}, 所属国家={m[2]}, 数据形态={m[3]}")
    else:
        print(f"   -> 未在足迹列表中找到精准匹配！")
