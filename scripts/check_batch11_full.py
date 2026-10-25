import os
import sys
import json
import time
import urllib.request
import pillow_heif
from PIL import Image, ExifTags

sys.stdout.reconfigure(encoding='utf-8')
pillow_heif.register_heif_opener()

BATCH_DIR = r"C:\Users\HolyX\Desktop\图寻照片candidate\第十一批"
CACHE_FILE = r"C:\Users\HolyX\.gemini\antigravity\brain\fd8b9b72-acde-47ce-9892-ce301f47fbc2\scratch\batch11_geo_cache.json"

os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
geo_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            geo_cache = json.load(f)
    except Exception:
        geo_cache = {}

def reverse_geocode(lat, lon):
    key = f"{round(lat, 3)},{round(lon, 3)}"
    if key in geo_cache:
        return geo_cache[key]
    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language=zh-Hans,zh,en"
    req = urllib.request.Request(url, headers={'User-Agent': 'TravelMapBatch11Check/1.0 (antigravity-checker)'})
    try:
        time.sleep(1.0)
        with urllib.request.urlopen(req, timeout=6) as response:
            res = json.loads(response.read().decode('utf-8'))
            addr = res.get('address', {})
            city = addr.get('city') or addr.get('town') or addr.get('county') or addr.get('state') or addr.get('country')
            data = {
                'display_name': res.get('display_name', ''),
                'city': city,
                'state': addr.get('state'),
                'county': addr.get('county'),
                'country': addr.get('country'),
                'country_code': addr.get('country_code', '').upper(),
                'road': addr.get('road'),
                'poi': addr.get('tourism') or addr.get('historic') or addr.get('amenity') or addr.get('attraction')
            }
            geo_cache[key] = data
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(geo_cache, f, ensure_ascii=False, indent=2)
            return data
    except Exception as e:
        return {'error': str(e)}

def parse_photo(fp):
    with Image.open(fp) as img:
        exif = img.getexif()
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) if exif else None
        if not gps_ifd and hasattr(img, '_getexif'):
            raw = img._getexif()
            if raw and 34853 in raw:
                gps_ifd = raw[34853]
        if not gps_ifd:
            return None, None, "", img.size, img.format

        lat_ref = gps_ifd.get(1)
        lat_dms = gps_ifd.get(2)
        lon_ref = gps_ifd.get(3)
        lon_dms = gps_ifd.get(4)
        if not (lat_ref and lat_dms and lon_ref and lon_dms):
            return None, None, "", img.size, img.format

        def dms_to_deg(dms, ref):
            deg = float(dms[0]) + float(dms[1]) / 60.0 + float(dms[2]) / 3600.0
            if ref in ['S', 'W']:
                deg = -deg
            return deg

        lat = dms_to_deg(lat_dms, lat_ref)
        lon = dms_to_deg(lon_dms, lon_ref)
        exif_sub = exif.get_ifd(ExifTags.IFD.Exif) if exif else {}
        dt = exif_sub.get(36867) or (exif.get(306) if exif else '') or ''
        return lat, lon, str(dt), img.size, img.format

subdirs = sorted([d for d in os.listdir(BATCH_DIR) if os.path.isdir(os.path.join(BATCH_DIR, d))])

all_data = {}
all_missing = []

for folder in subdirs:
    folder_path = os.path.join(BATCH_DIR, folder)
    files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))])
    photos = []
    missing = []
    for f in files:
        fp = os.path.join(folder_path, f)
        lat, lon, dt, size, fmt = parse_photo(fp)
        if lat is not None and lon is not None:
            photos.append({
                'file': f,
                'lat': round(lat, 6),
                'lon': round(lon, 6),
                'datetime': dt,
                'size': size,
                'format': fmt
            })
        else:
            missing.append(f)
            all_missing.append((folder, f))
    all_data[folder] = {
        'total': len(files),
        'valid': photos,
        'missing': missing
    }

print("==================================================")
print("第十一批照片数据概览与 GPS 完整度分析")
print("==================================================")
total_files = sum(d['total'] for d in all_data.values())
total_valid = sum(len(d['valid']) for d in all_data.values())
print(f"总计检测文件: {total_files} 个 (跨 {len(all_data)} 个文件夹)")
print(f"具有有效 GPS: {total_valid} 张")
print(f"缺失有效 GPS: {len(all_missing)} 张\n")

if all_missing:
    print("【缺失 GPS 坐标的照片详情】:")
    for folder, f in all_missing:
        print(f"  - [{folder}] {f}")
    print()

# Cluster analysis and reverse geocoding
print("==================================================")
print("各文件夹地理位置与坐标准确度校验")
print("==================================================")

folder_summaries = {}

for folder, info in all_data.items():
    photos = info['valid']
    if not photos:
        print(f"\n📁 【{folder}】: 全部 {info['total']} 张照片均缺失 GPS！")
        continue

    lats = [p['lat'] for p in photos]
    lons = [p['lon'] for p in photos]
    
    # Cluster photos (within 0.15 deg ~ 15km)
    clusters = []
    for p in photos:
        matched = False
        for c in clusters:
            if abs(c['lat'] - p['lat']) < 0.15 and abs(c['lon'] - p['lon']) < 0.15:
                c['photos'].append(p)
                matched = True
                break
        if not matched:
            clusters.append({'lat': p['lat'], 'lon': p['lon'], 'photos': [p]})
            
    print(f"\n📁 【{folder}】(共 {info['total']} 张, 有效 GPS {len(photos)} 张):")
    print(f"  坐标范围: 纬度 {min(lats):.4f} ~ {max(lats):.4f}, 经度 {min(lons):.4f} ~ {max(lons):.4f}")
    print(f"  聚类点: {len(clusters)} 处")
    
    for i, c in enumerate(clusters):
        c_lat = sum(p['lat'] for p in c['photos']) / len(c['photos'])
        c_lon = sum(p['lon'] for p in c['photos']) / len(c['photos'])
        geo = reverse_geocode(c_lat, c_lon)
        c['geo'] = geo
        country = geo.get('country', '')
        state = geo.get('state', '')
        city = geo.get('city', '')
        poi = geo.get('poi', '') or geo.get('road', '')
        display = geo.get('display_name', '')[:60]
        print(f"    - 区域 {i+1} ({len(c['photos'])} 张): [{country}] {state} {city} ({poi}) -> ({c_lat:.4f}, {c_lon:.4f})")

    folder_summaries[folder] = {
        'total': info['total'],
        'valid_count': len(photos),
        'missing_count': len(info['missing']),
        'min_lat': min(lats), 'max_lat': max(lats),
        'min_lon': min(lons), 'max_lon': max(lons),
        'clusters': [{
            'count': len(c['photos']),
            'lat': c['lat'],
            'lon': c['lon'],
            'geo': c['geo']
        } for c in clusters]
    }

# Save full results to scratch
with open(r"C:\Users\HolyX\.gemini\antigravity\brain\fd8b9b72-acde-47ce-9892-ce301f47fbc2\scratch\batch11_analysis.json", 'w', encoding='utf-8') as f:
    json.dump({
        'all_data': all_data,
        'summaries': folder_summaries,
        'all_missing': all_missing
    }, f, ensure_ascii=False, indent=2)

print("\n=== 地理与坐标分析完成，结果已保存 ===")
