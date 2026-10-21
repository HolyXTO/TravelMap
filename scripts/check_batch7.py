import os
import sys
import math
from PIL import Image, ExifTags

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"C:\Users\HolyX\Desktop\图寻照片candidate\第七批"

def extract_meta(img_path):
    try:
        with Image.open(img_path) as img:
            exif = img.getexif()
            if not exif:
                return None, 'No EXIF'
            shoot_time = None
            for tag_id in [36867, 36868, 306]:
                val = exif.get(tag_id)
                if val:
                    shoot_time = str(val)
                    break
            gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) if hasattr(ExifTags, 'IFD') else exif.get_ifd(0x8825)
            if not gps_ifd:
                return None, 'No GPS IFD'
            lat = gps_ifd.get(2)
            lat_ref = gps_ifd.get(1, 'N')
            lng = gps_ifd.get(4)
            lng_ref = gps_ifd.get(3, 'E')
            if not lat or not lng:
                return None, 'No Lat/Lng in GPS IFD'
            def to_deg(val):
                return float(val[0]) + float(val[1])/60.0 + float(val[2])/3600.0
            d_lat = to_deg(lat)
            d_lng = to_deg(lng)
            if lat_ref == 'S': d_lat = -d_lat
            if lng_ref == 'W': d_lng = -d_lng
            alt = gps_ifd.get(6, 0.0)
            try:
                alt = round(float(alt), 1)
            except:
                alt = 0.0
            return {
                'lat': round(d_lat, 6),
                'lng': round(d_lng, 6),
                'altitude': alt,
                'shoot_time': shoot_time
            }, None
    except Exception as e:
        return None, str(e)

if not os.path.exists(base_dir):
    print(f"Error: Base directory '{base_dir}' does not exist.")
    sys.exit(1)

folders = sorted(os.listdir(base_dir))
total_photos = 0
total_valid_gps = 0
missing_gps_photos = []

folder_stats = {}
all_photo_records = []

for fld in folders:
    fld_path = os.path.join(base_dir, fld)
    if not os.path.isdir(fld_path): continue
    files = sorted([f for f in os.listdir(fld_path) if os.path.isfile(os.path.join(fld_path, f))])
    
    lats = []
    lngs = []
    times = []
    
    for f in files:
        if not f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            continue
        total_photos += 1
        fp = os.path.join(fld_path, f)
        meta, err = extract_meta(fp)
        if meta and meta['lat'] is not None and meta['lng'] is not None and abs(meta['lat']) > 0.001 and abs(meta['lng']) > 0.001:
            total_valid_gps += 1
            lats.append(meta['lat'])
            lngs.append(meta['lng'])
            if meta['shoot_time']:
                times.append(meta['shoot_time'])
            all_photo_records.append({
                'folder': fld,
                'file': f,
                'lat': meta['lat'],
                'lng': meta['lng'],
                'time': meta['shoot_time'],
                'alt': meta['altitude']
            })
        else:
            missing_gps_photos.append((fld, f, err if err else f"Invalid coordinates ({meta['lat'] if meta else 0}, {meta['lng'] if meta else 0})"))
            
    folder_stats[fld] = {
        'total': len(files),
        'valid_gps': len(lats),
        'min_lat': min(lats) if lats else None,
        'max_lat': max(lats) if lats else None,
        'avg_lat': sum(lats)/len(lats) if lats else None,
        'min_lng': min(lngs) if lngs else None,
        'max_lng': max(lngs) if lngs else None,
        'avg_lng': sum(lngs)/len(lngs) if lngs else None,
        'earliest_time': min(times) if times else None,
        'latest_time': max(times) if times else None
    }

print(f"=== 第七批候选照片检查报告 ===")
print(f"扫描文件夹数: {len(folder_stats)}")
print(f"总照片数量: {total_photos}")
print(f"GPS 有效数量: {total_valid_gps}")
print(f"GPS 缺失数量: {len(missing_gps_photos)}")

if missing_gps_photos:
    print("\n[!] 缺失 GPS 信息的照片清单:")
    for fld, f, err in missing_gps_photos:
        print(f"  - [{fld}] {f}: {err}")
else:
    print("\n[OK] 所有照片均具有完整有效的 GPS 经纬度信息！")

print("\n=== 各文件夹照片分布与经纬度范围 ===")
for fld, st in folder_stats.items():
    print(f"\n【{fld}】: 共 {st['total']} 张 (有效 GPS: {st['valid_gps']})")
    if st['avg_lat'] is not None:
        print(f"  - 纬度 (Lat): {st['min_lat']:.4f} ~ {st['max_lat']:.4f} (均值: {st['avg_lat']:.4f})")
        print(f"  - 经度 (Lng): {st['min_lng']:.4f} ~ {st['max_lng']:.4f} (均值: {st['avg_lng']:.4f})")
        print(f"  - 拍摄时间: {st['earliest_time']} ~ {st['latest_time']}")

# Check outliers in each folder (distance > 30km from cluster mean)
print("\n=== 异常离群点检查（距离同文件夹中心 >30km）===")
outliers = []
for r in all_photo_records:
    fld = r['folder']
    st = folder_stats[fld]
    lat1, lng1 = math.radians(r['lat']), math.radians(r['lng'])
    lat2, lng2 = math.radians(st['avg_lat']), math.radians(st['avg_lng'])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    dist_km = 6371 * c
    if dist_km > 30:
        outliers.append((r['folder'], r['file'], dist_km, r['lat'], r['lng'], r['time']))

if outliers:
    print(f"发现 {len(outliers)} 个离群点（离同文件夹均值超过 30km）:")
    for fld, f, dist, lat, lng, t in outliers:
        print(f"  - [{fld}] {f}: 距离中心 {dist:.1f}km, 坐标: ({lat:.5f}, {lng:.5f}), 时间: {t}")
else:
    print("[OK] 没有发现任何离群点！同一文件夹内的照片在空间分布上高度集中。")
