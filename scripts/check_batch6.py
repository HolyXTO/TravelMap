import os
import sys
import math
from PIL import Image, ExifTags

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

base_dir = r"C:\Users\HolyX\Desktop\图寻照片candidate\第六批"

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
        total_photos += 1
        fp = os.path.join(fld_path, f)
        meta, err = extract_meta(fp)
        if meta and meta['lat'] is not None and meta['lng'] is not None:
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
                'time': meta['shoot_time']
            })
        else:
            missing_gps_photos.append((fld, f, err))
            
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

print(f"Total photos scanned: {total_photos}")
print(f"Valid GPS photos: {total_valid_gps}")
print(f"Missing GPS photos: {len(missing_gps_photos)}")
if missing_gps_photos:
    print("\n--- Missing GPS Photos List ---")
    for fld, f, err in missing_gps_photos:
        print(f"  - [{fld}] {f} ({err})")
else:
    print("ALL photos have valid GPS coordinates!")

print("\n--- Folder Breakdown & Geographic Coordinates ---")
for fld, st in folder_stats.items():
    print(f"Folder: [{fld}]")
    print(f"  Photos: {st['valid_gps']}/{st['total']}")
    if st['avg_lat'] is not None:
        print(f"  Lat range: {st['min_lat']:.4f} ~ {st['max_lat']:.4f} (Center: {st['avg_lat']:.4f})")
        print(f"  Lng range: {st['min_lng']:.4f} ~ {st['max_lng']:.4f} (Center: {st['avg_lng']:.4f})")
        print(f"  Shoot time: {st['earliest_time']} ~ {st['latest_time']}")

# Check outliers in each folder (distance > 50km from mean)
print("\n--- Outlier / Anomaly Check (>50km from city mean) ---")
outliers = []
for r in all_photo_records:
    fld = r['folder']
    st = folder_stats[fld]
    # Haversine distance in km
    lat1, lng1 = math.radians(r['lat']), math.radians(r['lng'])
    lat2, lng2 = math.radians(st['avg_lat']), math.radians(st['avg_lng'])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    dist_km = 6371 * c
    if dist_km > 50:
        outliers.append((r['folder'], r['file'], dist_km, r['lat'], r['lng']))

if outliers:
    print(f"Found {len(outliers)} outliers (>50km from folder center):")
    for fld, f, dist, lat, lng in outliers:
        print(f"  - [{fld}] {f}: distance {dist:.1f}km at ({lat}, {lng})")
else:
    print("No spatial outliers detected! All photos are tightly clustered within their respective urban / scenic areas.")
