import os, sys, json
import pillow_heif
from PIL import Image, ExifTags

sys.stdout.reconfigure(encoding='utf-8')
pillow_heif.register_heif_opener()

batch_dir = r"C:\Users\HolyX\Desktop\图寻照片candidate\第十一批"

def get_gps(fp):
    with Image.open(fp) as img:
        exif = img.getexif()
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) if exif else None
        if not gps_ifd and hasattr(img, '_getexif'):
            raw = img._getexif()
            if raw and 34853 in raw: gps_ifd = raw[34853]
        if not gps_ifd: return None, None
        lat_ref = gps_ifd.get(1); lat_dms = gps_ifd.get(2)
        lon_ref = gps_ifd.get(3); lon_dms = gps_ifd.get(4)
        if not (lat_ref and lat_dms and lon_ref and lon_dms): return None, None
        lat = float(lat_dms[0]) + float(lat_dms[1])/60.0 + float(lat_dms[2])/3600.0
        if lat_ref in ['S', 'W']: lat = -lat
        lon = float(lon_dms[0]) + float(lon_dms[1])/60.0 + float(lon_dms[2])/3600.0
        if lon_ref in ['S', 'W']: lon = -lon
        return round(lat, 6), round(lon, 6)

# Check 海牙
hague_files = os.listdir(os.path.join(batch_dir, '海牙'))
print("=== 海牙照片详情 ===")
for f in hague_files:
    lat, lon = get_gps(os.path.join(batch_dir, '海牙', f))
    print(f"  {f}: lat={lat}, lon={lon}")

# Check 卢森堡
lux_files = os.listdir(os.path.join(batch_dir, '卢森堡'))
print("\n=== 卢森堡照片详情 ===")
for f in lux_files:
    lat, lon = get_gps(os.path.join(batch_dir, '卢森堡', f))
    print(f"  {f}: lat={lat}, lon={lon}")

# Check 慕尼黑
munich_files = os.listdir(os.path.join(batch_dir, '慕尼黑'))
print("\n=== 慕尼黑照片详情 ===")
for f in munich_files:
    lat, lon = get_gps(os.path.join(batch_dir, '慕尼黑', f))
    print(f"  {f}: lat={lat}, lon={lon}")

# Check 柏林
berlin_files = os.listdir(os.path.join(batch_dir, '柏林'))
print("\n=== 柏林照片详情 ===")
for f in berlin_files:
    lat, lon = get_gps(os.path.join(batch_dir, '柏林', f))
    print(f"  {f}: lat={lat}, lon={lon}")

# Check 奥斯陆
oslo_files = os.listdir(os.path.join(batch_dir, '奥斯陆'))
print("\n=== 奥斯陆照片详情 ===")
for f in oslo_files:
    lat, lon = get_gps(os.path.join(batch_dir, '奥斯陆', f))
    print(f"  {f}: lat={lat}, lon={lon}")
