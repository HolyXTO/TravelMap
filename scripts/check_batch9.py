import os
import sys
import json
import math
import urllib.request
import time
from PIL import Image, ExifTags

sys.stdout.reconfigure(encoding='utf-8')

BATCH_DIR = r"C:\Users\HolyX\Desktop\图寻照片candidate\第九批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")

def get_geotagging(exif):
    if not exif:
        return None
    geotagging = {}
    for (idx, tag) in ExifTags.TAGS.items():
        if tag == 'GPSInfo':
            if idx not in exif:
                return None
            for (key, val) in ExifTags.GPSTAGS.items():
                if key in exif[idx]:
                    geotagging[val] = exif[idx][key]
    return geotagging

def get_decimal_from_dms(dms, ref):
    if not dms or not ref:
        return None
    try:
        degrees = float(dms[0])
        minutes = float(dms[1]) / 60.0
        seconds = float(dms[2]) / 3600.0
        decimal = degrees + minutes + seconds
        if ref in ['S', 'W']:
            decimal = -decimal
        return decimal
    except Exception as e:
        return None

def get_coordinates(geotags):
    if not geotags:
        return None, None
    lat = get_decimal_from_dms(geotags.get('GPSLatitude'), geotags.get('GPSLatitudeRef'))
    lon = get_decimal_from_dms(geotags.get('GPSLongitude'), geotags.get('GPSLongitudeRef'))
    return lat, lon

subdirs = sorted([d for d in os.listdir(BATCH_DIR) if os.path.isdir(os.path.join(BATCH_DIR, d))])

data_by_folder = {}
missing_gps = []
total_photos = 0

for d in subdirs:
    folder_path = os.path.join(BATCH_DIR, d)
    files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
    data_by_folder[d] = []
    for f in files:
        total_photos += 1
        fp = os.path.join(folder_path, f)
        try:
            with Image.open(fp) as img:
                exif = img._getexif()
                geotags = get_geotagging(exif)
                lat, lon = get_coordinates(geotags)
                dt = ""
                if exif:
                    dt = str(exif.get(36867) or exif.get(306) or "")
                
                if lat is not None and lon is not None:
                    data_by_folder[d].append({
                        'file': f,
                        'lat': round(lat, 6),
                        'lon': round(lon, 6),
                        'datetime': dt,
                        'size_mb': round(os.path.getsize(fp) / (1024 * 1024), 2)
                    })
                else:
                    missing_gps.append({'folder': d, 'file': f, 'reason': 'No GPS tag'})
        except Exception as e:
            missing_gps.append({'folder': d, 'file': f, 'reason': str(e)})

print(f"=== GPS 完整度统计 ===")
print(f"总计检测照片: {total_photos} 张")
print(f"有效 GPS 照片: {total_photos - len(missing_gps)} 张")
print(f"缺失 GPS 照片: {len(missing_gps)} 张")

if missing_gps:
    print("\n【警告】发现以下照片缺失 GPS 信息：")
    for m in missing_gps:
        print(f"  - [{m['folder']}] {m['file']}: {m['reason']}")
else:
    print("【完美】全部照片 100% 具备有效 GPS 经纬度信息！\n")

# Check duplicate files with existing guessGameData.json
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    gd = json.load(f)
existing_files = {q.get('originalFileName'): q for q in gd.get('questions', [])}

duplicates = []
for folder, items in data_by_folder.items():
    for it in items:
        if it['file'] in existing_files:
            eq = existing_files[it['file']]
            duplicates.append((folder, it['file'], eq['id'], eq['cityName']))

print(f"=== 与现有题库重复排查 ===")
print(f"发现重复照片数量: {len(duplicates)}")
for dup in duplicates:
    print(f"  - [{dup[0]}] {dup[1]} -> 已在现有题库中 (ID: {dup[2]}, 城市: {dup[3]})")
if not duplicates:
    print("没有发现与现有 3,988 题重复的照片！")
print()

# Geocoding reverse lookup for clusters
def reverse_geocode(lat, lon):
    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language=zh-Hans,zh,en"
    req = urllib.request.Request(url, headers={'User-Agent': 'TravelMapValidator9/1.0 (test@antigravity.internal)'})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res = json.loads(response.read().decode('utf-8'))
            addr = res.get('address', {})
            name = res.get('display_name', '')
            city = addr.get('city') or addr.get('town') or addr.get('county') or addr.get('state') or addr.get('country')
            return {
                'display_name': name,
                'city': city,
                'state': addr.get('state'),
                'county': addr.get('county'),
                'country': addr.get('country'),
                'road': addr.get('road'),
                'poi': addr.get('tourism') or addr.get('historic') or addr.get('amenity') or addr.get('attraction')
            }
    except Exception as e:
        return {'error': str(e)}

print("=== 各文件夹地理分布与位置解析 ===")
folder_analysis = {}

for folder, items in data_by_folder.items():
    lats = [it['lat'] for it in items]
    lons = [it['lon'] for it in items]
    print(f"\n📁 【{folder}】（共 {len(items)} 张）:")
    print(f"  经纬度范围: 纬度 {min(lats):.6f} ~ {max(lats):.6f}, 经度 {min(lons):.6f} ~ {max(lons):.6f}")
    
    # Cluster items into ~10km clusters
    clusters = []
    for it in items:
        matched = False
        for c in clusters:
            if abs(c['lat'] - it['lat']) < 0.1 and abs(c['lon'] - it['lon']) < 0.1:
                c['count'] += 1
                c['files'].append(it['file'])
                matched = True
                break
        if not matched:
            clusters.append({'lat': it['lat'], 'lon': it['lon'], 'count': 1, 'files': [it['file']]})
            
    print(f"  聚类点数: {len(clusters)} 处")
    for i, c in enumerate(clusters):
        geo = reverse_geocode(c['lat'], c['lon'])
        time.sleep(1.0)
        c['geo'] = geo
        loc_str = f"{geo.get('country', '')} {geo.get('state', '')} {geo.get('city', '') or geo.get('county', '')} | {geo.get('display_name', '')[:65]}"
        print(f"    - 聚类 {i+1} ({c['count']}张): ({c['lat']}, {c['lon']}) -> {loc_str}")
        
    folder_analysis[folder] = {
        'count': len(items),
        'min_lat': min(lats), 'max_lat': max(lats),
        'min_lon': min(lons), 'max_lon': max(lons),
        'clusters': clusters,
        'items': items
    }

# Save output JSON
with open(r"C:\Users\HolyX\.gemini\antigravity\brain\fd8b9b72-acde-47ce-9892-ce301f47fbc2\scratch\batch9_data.json", 'w', encoding='utf-8') as f:
    json.dump(folder_analysis, f, ensure_ascii=False, indent=2)

print("\n=== 全部地理校验完成 ===")
