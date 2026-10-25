import os
import sys
import json
import pillow_heif
from PIL import Image, ExifTags

sys.stdout.reconfigure(encoding='utf-8')
pillow_heif.register_heif_opener()

BATCH_DIR = r"C:\Users\HolyX\Desktop\图寻照片candidate\第十一批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    gd = json.load(f)

city_by_name = {c['cityName']: c for c in gd['cities']}
# Handle 马略卡 alias
city_by_name['马略卡'] = city_by_name.get('马略卡岛')

SKIP_FOLDERS = {'扬州', '镇江'}
SKIP_FILES = {
    ('威尼斯', 'fxn 2024-03-09 085929.733.JPEG'),
    ('巴黎', '297ba52ebb3a39f92330953937241ec8.JPEG'),
    ('布拉格', 'fxn 2024-03-08 130107.784.JPEG'),
    ('德累斯顿', 'fxn 2024-02-25 141458.816.JPEG'),
    ('德累斯顿', 'fxn 2024-05-08 130649.496.JPEG'),
    ('慕尼黑', 'IMG_0703.HEIC'),
    ('慕尼黑', 'IMG_0372 (1).HEIC'), # duplicate of IMG_0372.HEIC
    ('朗伊尔城', '7852449a8e31eb56c54ebc50f6d4ea4e.JPEG'),
    ('朗伊尔城', 'IMG_0156.HEIC'),
    ('柏林', 'IMG_0156.HEIC'),
    ('维也纳', '232712c07b914e05cd9b47e612833cd0.jpg'),
    ('维也纳', 'IMG_8588.JPEG')
}

def parse_photo(fp):
    with Image.open(fp) as img:
        exif = img.getexif()
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) if exif else None
        if not gps_ifd and hasattr(img, '_getexif'):
            raw = img._getexif()
            if raw and 34853 in raw:
                gps_ifd = raw[34853]
        if not gps_ifd:
            return None, None, "", 0.0

        lat_ref = gps_ifd.get(1); lat_dms = gps_ifd.get(2)
        lon_ref = gps_ifd.get(3); lon_dms = gps_ifd.get(4)
        if not (lat_ref and lat_dms and lon_ref and lon_dms):
            return None, None, "", 0.0

        def dms_to_deg(dms, ref):
            deg = float(dms[0]) + float(dms[1]) / 60.0 + float(dms[2]) / 3600.0
            if ref in ['S', 'W']:
                deg = -deg
            return deg

        lat = dms_to_deg(lat_dms, lat_ref)
        lon = dms_to_deg(lon_dms, lon_ref)

        alt = 0.0
        if 6 in gps_ifd:
            try:
                alt = float(gps_ifd[6])
            except Exception:
                pass

        exif_sub = exif.get_ifd(ExifTags.IFD.Exif) if exif else {}
        dt = exif_sub.get(36867) or (exif.get(306) if exif else '') or ''
        return round(lat, 6), round(lon, 6), str(dt), round(alt, 1)

planned_items = []

for folder in sorted(os.listdir(BATCH_DIR)):
    folder_path = os.path.join(BATCH_DIR, folder)
    if not os.path.isdir(folder_path):
        continue
    if folder in SKIP_FOLDERS:
        continue

    files = sorted(os.listdir(folder_path))
    for f in files:
        if (folder, f) in SKIP_FILES:
            continue
        fp = os.path.join(folder_path, f)
        lat, lon, dt, alt = parse_photo(fp)
        if lat is None or lon is None:
            print(f"ERROR: Photo {folder}/{f} has no GPS despite not in skip list!")
            sys.exit(1)

        # Destination city assignment
        target_city_name = folder
        
        # Special case 1: 海牙 IMG_6251.HEIC -> 阿姆斯特丹
        if folder == '海牙' and f == 'IMG_6251.HEIC':
            target_city_name = '阿姆斯特丹'
            
        # Special case 2: 柏林 IMG_1207.HEIC -> 波茨坦
        elif folder == '柏林' and f == 'IMG_1207.HEIC':
            target_city_name = '波茨坦'
            
        # Special case 3: 阿姆斯特丹 中的 库肯霍夫公园 (Lisse, 52.26~52.28, 4.53~4.56)
        elif folder == '阿姆斯特丹' and 52.26 <= lat <= 52.28 and 4.53 <= lon <= 4.56:
            target_city_name = '库肯霍夫'
            
        city_info = city_by_name.get(target_city_name)
        if not city_info:
            print(f"ERROR: Unknown city '{target_city_name}' for {folder}/{f}!")
            sys.exit(1)

        planned_items.append({
            'source_path': fp,
            'source_folder': folder,
            'file_name': f,
            'city_name': city_info['cityName'],
            'city_id': city_info['cityId'],
            'lat': lat,
            'lng': lon,
            'altitude': alt,
            'shoot_time': dt
        })

print(f"=== 计划导入照片总数: {len(planned_items)} 张 ===")

from collections import Counter
by_city = Counter(it['city_name'] for it in planned_items)
print("\n=== 按目标城市汇总 ===")
for cname, count in sorted(by_city.items(), key=lambda x: -x[1]):
    cid = city_by_name[cname]['cityId']
    c_country = city_by_name[cname]['countryName']
    print(f"  - {cname} ({cid}, {c_country}): {count} 张")

# Save planned items to scratch
with open(r"C:\Users\HolyX\.gemini\antigravity\brain\fd8b9b72-acde-47ce-9892-ce301f47fbc2\scratch\batch11_plan.json", 'w', encoding='utf-8') as f:
    json.dump(planned_items, f, ensure_ascii=False, indent=2)

print("\n计划已成功保存到 scratch/batch11_plan.json！")
