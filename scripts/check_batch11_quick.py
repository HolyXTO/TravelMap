import os
import sys
import json
import pillow_heif
from PIL import Image, ExifTags

sys.stdout.reconfigure(encoding='utf-8')
pillow_heif.register_heif_opener()

BATCH_DIR = r"C:\Users\HolyX\Desktop\图寻照片candidate\第十一批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")

def parse_gps_and_meta(fp):
    with Image.open(fp) as img:
        exif = img.getexif()
        if not exif:
            return None, None, "", img.size, img.format
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
        if not gps_ifd:
            # Fallback for standard jpeg _getexif if present
            if hasattr(img, '_getexif'):
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

        exif_sub = exif.get_ifd(ExifTags.IFD.Exif)
        dt = exif_sub.get(36867) or exif.get(306) or ''
        return lat, lon, str(dt), img.size, img.format

subdirs = sorted([d for d in os.listdir(BATCH_DIR) if os.path.isdir(os.path.join(BATCH_DIR, d))])

data_by_folder = {}
missing_gps = []
total_photos = 0

for d in subdirs:
    folder_path = os.path.join(BATCH_DIR, d)
    files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))])
    data_by_folder[d] = []
    for f in files:
        total_photos += 1
        fp = os.path.join(folder_path, f)
        try:
            lat, lon, dt, size, fmt = parse_gps_and_meta(fp)
            if lat is not None and lon is not None:
                data_by_folder[d].append({
                    'file': f,
                    'lat': round(lat, 6),
                    'lon': round(lon, 6),
                    'datetime': dt,
                    'size': size,
                    'format': fmt,
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
    print(f"\n【发现 {len(missing_gps)} 张照片缺失 GPS 信息】：")
    for m in missing_gps:
        print(f"  - [{m['folder']}] {m['file']}: {m['reason']}")
else:
    print("【全部照片 100% 具备有效 GPS 经纬度信息！】\n")

# Duplicate check with existing 4365 questions
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    gd = json.load(f)

existing_questions = gd.get('questions', [])
existing_files = {q.get('originalFileName'): q for q in existing_questions if q.get('originalFileName')}
existing_coords = {}
for q in existing_questions:
    lat = round(q['coordinates']['lat'], 5)
    lng = round(q['coordinates']['lng'], 5)
    existing_coords[(lat, lng)] = q

file_dups = []
coord_dups = []

for folder, items in data_by_folder.items():
    for it in items:
        if it['file'] in existing_files:
            eq = existing_files[it['file']]
            file_dups.append((folder, it['file'], eq['id'], eq.get('cityName')))
        
        c_key = (round(it['lat'], 5), round(it['lon'], 5))
        if c_key in existing_coords:
            eq = existing_coords[c_key]
            coord_dups.append((folder, it['file'], eq['id'], eq.get('cityName'), eq.get('originalFileName')))

print(f"=== 与现有题库重复排查 ===")
print(f"文件名重复数量: {len(file_dups)}")
for dup in file_dups:
    print(f"  - [{dup[0]}] {dup[1]} -> 现有题库 ID: {dup[2]}, 城市: {dup[3]}")

print(f"坐标完全重合数量: {len(coord_dups)}")
for dup in coord_dups:
    print(f"  - [{dup[0]}] {dup[1]} -> 与现有题目坐标重合 (ID: {dup[2]}, 城市: {dup[3]}, 原文件: {dup[4]})")

if not file_dups and not coord_dups:
    print("没有发现与现有 4,365 题重复的照片！")

# Summary of photos per folder
print("\n=== 各文件夹照片统计 ===")
for folder, items in data_by_folder.items():
    print(f"  - {folder}: {len(items)} 张")
