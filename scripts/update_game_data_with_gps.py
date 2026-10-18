import os
import sys
import json
from PIL import Image, ExifTags

sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r'C:\Users\HolyX\Desktop\图寻照片candidate\第一批'
DATA_OUTPUT = os.path.join('src', 'data', 'guessGameData.json')

CITY_CONFIG = {
    "北京": "CN011010",
    "南宁": "CN045110",
    "哈尔滨": "CN023030",
    "多哈": "W-290030",
    "崇左": "CN045030",
    "布拉格": "W-4548393",
    "德累斯顿": "W-2935022",
    "柳州": "CN045100",
    "法兰克福": "W-2925533",
    "衢州": "CN033070",
    "重庆": "CN050010",
    "金华": "CN033040",
    "阿布扎比": "W-292968"
}

# User supplied coordinates for the 2 missing photos:
MANUAL_GPS = {
    # 阿布扎比: 24; 31; 51.82022 -> 24.531061, 54; 24; 20.01434 -> 54.405560
    "IMG_20250615_172104.jpg": {
        "lat": 24.531061,
        "lng": 54.405560,
        "altitude": 14.8
    },
    # 布拉格: 50; 5; 23.23151 -> 50.089786, 14; 26; 21.63300 -> 14.439342
    "IMG_20250610_145332.jpg": {
        "lat": 50.089786,
        "lng": 14.439342,
        "altitude": 235.69
    }
}

def dms_to_decimal(dms, ref):
    if not dms or len(dms) < 3:
        return None
    d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
    decimal = d + (m / 60.0) + (s / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def extract_gps(img_path):
    fname = os.path.basename(img_path)
    if fname in MANUAL_GPS:
        return {
            "lat": MANUAL_GPS[fname]["lat"],
            "lng": MANUAL_GPS[fname]["lng"],
            "altitude": MANUAL_GPS[fname]["altitude"],
            "time": None,
            "is_manual": True
        }
    
    try:
        img = Image.open(img_path)
        exif = img.getexif()
        if not exif:
            return None
        
        shoot_time = exif.get(ExifTags.Base.DateTime) or exif.get(0x9003)
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) if hasattr(ExifTags, 'IFD') else exif.get_ifd(0x8825)
        if not gps_ifd:
            return None
        
        lat_ref = gps_ifd.get(1)
        lat_dms = gps_ifd.get(2)
        lng_ref = gps_ifd.get(3)
        lng_dms = gps_ifd.get(4)
        
        if lat_dms and lng_dms and lat_ref and lng_ref:
            lat = dms_to_decimal(lat_dms, lat_ref)
            lng = dms_to_decimal(lng_dms, lng_ref)
            alt = gps_ifd.get(6)
            
            return {
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "altitude": round(float(alt), 1) if alt is not None else None,
                "time": str(shoot_time) if shoot_time else None,
                "is_manual": False
            }
    except Exception as e:
        print(f"Error reading EXIF from {img_path}: {e}")
    return None

# Load current guessGameData.json
with open(DATA_OUTPUT, 'r', encoding='utf-8') as f:
    game_data = json.load(f)

# Build a lookup of existing questions by (cityId, idx)
questions_map = {}
for q in game_data["questions"]:
    # e.g. photoUrl = /TravelMap/game-photos/CN011010/001.webp
    parts = q["photoUrl"].split('/')
    c_id = parts[-2]
    f_idx = parts[-1].replace('.webp', '')
    questions_map[(c_id, f_idx)] = q

updated_count = 0
folders = sorted(os.listdir(BASE_INPUT))
for folder_name in folders:
    folder_path = os.path.join(BASE_INPUT, folder_name)
    if not os.path.isdir(folder_path) or folder_name not in CITY_CONFIG:
        continue
    
    city_id = CITY_CONFIG[folder_name]
    files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
    
    for idx, fname in enumerate(files, 1):
        f_idx = f"{idx:03d}"
        in_path = os.path.join(folder_path, fname)
        gps = extract_gps(in_path)
        
        key = (city_id, f_idx)
        if key in questions_map:
            q = questions_map[key]
            q["originalFileName"] = fname
            if gps:
                q["exactLat"] = gps["lat"]
                q["exactLng"] = gps["lng"]
                q["altitude"] = gps["altitude"]
                q["shootTime"] = gps["time"]
                updated_count += 1
            else:
                print(f"Warning: No GPS for {folder_name}/{fname}!")

print(f"Successfully injected exact GPS into {updated_count} / {len(game_data['questions'])} questions!")

# Check if any question is missing exactLat
missing = [q for q in game_data["questions"] if "exactLat" not in q]
if missing:
    print(f"ALERT: {len(missing)} questions still missing GPS!")
    for m in missing:
        print(m["photoUrl"])
else:
    print("🌟 100% of questions have verified exact GPS coordinates!")

# Save back to DATA_OUTPUT
with open(DATA_OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(game_data, f, ensure_ascii=False, indent=2)

print(f"Updated {DATA_OUTPUT} successfully.")
