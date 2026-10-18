import os
import json
import re
import sys
from PIL import Image, ImageOps

sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r'C:\Users\HolyX\Desktop\图寻照片candidate\第一批'
PUBLIC_OUTPUT = os.path.join('public', 'game-photos')
DATA_OUTPUT = os.path.join('src', 'data', 'guessGameData.json')

CITY_CONFIG = {
    "北京": {
        "cityId": "CN011010",
        "cityName": "北京",
        "fullCityName": "北京市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "北京"
    },
    "南宁": {
        "cityId": "CN045110",
        "cityName": "南宁",
        "fullCityName": "南宁市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "广西"
    },
    "哈尔滨": {
        "cityId": "CN023030",
        "cityName": "哈尔滨",
        "fullCityName": "哈尔滨市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "黑龙江"
    },
    "多哈": {
        "cityId": "W-290030",
        "cityName": "多哈",
        "fullCityName": "多哈",
        "countryName": "卡塔尔",
        "countryCode": "QAT",
        "region": "foreign",
        "province": "Ad Dawhah"
    },
    "崇左": {
        "cityId": "CN045030",
        "cityName": "崇左",
        "fullCityName": "崇左市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "广西"
    },
    "布拉格": {
        "cityId": "W-4548393",
        "cityName": "布拉格",
        "fullCityName": "布拉格",
        "countryName": "捷克",
        "countryCode": "CZE",
        "region": "foreign",
        "province": "Hlavni Mesto Praha"
    },
    "德累斯顿": {
        "cityId": "W-2935022",
        "cityName": "德累斯顿",
        "fullCityName": "德累斯顿",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Sachsen"
    },
    "柳州": {
        "cityId": "CN045100",
        "cityName": "柳州",
        "fullCityName": "柳州市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "广西"
    },
    "法兰克福": {
        "cityId": "W-2925533",
        "cityName": "法兰克福",
        "fullCityName": "美茵河畔法兰克福",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Hessen"
    },
    "衢州": {
        "cityId": "CN033070",
        "cityName": "衢州",
        "fullCityName": "衢州市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "浙江"
    },
    "重庆": {
        "cityId": "CN050010",
        "cityName": "重庆",
        "fullCityName": "重庆市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "重庆"
    },
    "金华": {
        "cityId": "CN033040",
        "cityName": "金华",
        "fullCityName": "金华市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "浙江"
    },
    "阿布扎比": {
        "cityId": "W-292968",
        "cityName": "阿布扎比",
        "fullCityName": "阿布扎比",
        "countryName": "阿联酋",
        "countryCode": "ARE",
        "region": "foreign",
        "province": "Abu Dhabi"
    }
}

def get_geometry_center(geometry):
    if not geometry:
        return [0, 0]
    points = []
    def collect(item):
        if not isinstance(item, list):
            return
        if len(item) >= 2 and isinstance(item[0], (int, float)) and isinstance(item[1], (int, float)):
            points.append(item)
            return
        for sub in item:
            collect(sub)
    collect(geometry.get('coordinates', []))
    if not points:
        return [0, 0]
    min_lon = min(p[0] for p in points)
    max_lon = max(p[0] for p in points)
    min_lat = min(p[1] for p in points)
    max_lat = max(p[1] for p in points)
    return [round((min_lon + max_lon) / 2, 5), round((min_lat + max_lat) / 2, 5)]

# Load coordinates
with open('public/maps/china-cities.geojson', 'r', encoding='utf-8') as f:
    china_cities = json.load(f)
china_map = {feat['properties']['id']: feat for feat in china_cities['features']}

with open('public/maps/place-index.json', 'r', encoding='utf-8') as f:
    place_index = json.load(f)
index_map = {p['id']: p for p in place_index}

for name, cfg in CITY_CONFIG.items():
    cid = cfg['cityId']
    if cid in china_map:
        feat = china_map[cid]
        cfg['center'] = get_geometry_center(feat.get('geometry'))
    elif cid in index_map:
        cfg['center'] = index_map[cid].get('center')
    print(f"City [{name}] center: {cfg.get('center')}")

os.makedirs(PUBLIC_OUTPUT, exist_ok=True)

all_questions = []
q_counter = 1

folders = sorted(os.listdir(BASE_INPUT))
for folder_name in folders:
    folder_path = os.path.join(BASE_INPUT, folder_name)
    if not os.path.isdir(folder_path):
        continue
    if folder_name not in CITY_CONFIG:
        print(f"Warning: Folder {folder_name} not in config!")
        continue
    
    cfg = CITY_CONFIG[folder_name]
    city_out_dir = os.path.join(PUBLIC_OUTPUT, cfg['cityId'])
    os.makedirs(city_out_dir, exist_ok=True)
    
    files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
    print(f"Processing {folder_name}: {len(files)} images...")
    
    for idx, fname in enumerate(files, 1):
        in_path = os.path.join(folder_path, fname)
        out_name = f"{idx:03d}.webp"
        out_path = os.path.join(city_out_dir, out_name)
        web_url = f"/TravelMap/game-photos/{cfg['cityId']}/{out_name}"
        
        # Optimize image if not already generated
        if not os.path.exists(out_path):
            try:
                with Image.open(in_path) as img:
                    img = ImageOps.exif_transpose(img)
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                    # resize max dimension to 1440
                    max_dim = 1440
                    w, h = img.size
                    if max(w, h) > max_dim:
                        if w > h:
                            new_w = max_dim
                            new_h = int(h * (max_dim / w))
                        else:
                            new_h = max_dim
                            new_w = int(w * (max_dim / h))
                        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    img.save(out_path, 'WEBP', quality=82, method=4)
            except Exception as e:
                print(f"Error processing {in_path}: {e}")
                continue
        
        all_questions.append({
            "id": f"q-{q_counter:04d}",
            "photoUrl": web_url,
            "cityId": cfg['cityId'],
            "cityName": cfg['cityName'],
            "fullCityName": cfg['fullCityName'],
            "countryName": cfg['countryName'],
            "countryCode": cfg['countryCode'],
            "province": cfg.get('province', ''),
            "region": cfg['region'],
            "center": cfg['center']
        })
        q_counter += 1

# Output JSON
output_data = {
    "version": "1.0",
    "totalPhotos": len(all_questions),
    "cities": list(CITY_CONFIG.values()),
    "questions": all_questions
}

with open(DATA_OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print(f"\nAll done! Successfully generated {len(all_questions)} questions saved to {DATA_OUTPUT}")
