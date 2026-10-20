import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第三批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")
CHINA_GEOJSON_PATH = os.path.join("public", "maps", "china-cities.geojson")

MANUAL_GPS = {
    "IMG_20181102_151518.jpg": {
        "lat": 37.8548,
        "lng": 112.5694,
        "altitude": 790.0,
        "shoot_time": "2018:11:02 15:15:19"
    },
    "IMG_20240329_174912.jpg": {
        "lat": 50.07408,
        "lng": 14.41877,
        "altitude": 200.0,
        "shoot_time": "2024:03:29 17:49:12"
    }
}

FOLDER_CONFIG = {
    # 德国
    "乌尔姆": {
        "cityId": "W-2820256",
        "cityName": "乌尔姆",
        "fullCityName": "乌尔姆",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Baden-Württemberg",
        "center": [9.9876, 48.4011]
    },
    "腓特烈港": {
        "cityId": "W-2924962",
        "cityName": "腓特烈港",
        "fullCityName": "腓特烈港",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Baden-Württemberg",
        "center": [9.4795, 47.6542]
    },
    "德累斯顿": {
        "cityId": "W-2935022",
        "cityName": "德累斯顿",
        "fullCityName": "德累斯顿",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Sachsen",
        "center": [13.75, 51.04997]
    },
    # 瑞士
    "卢塞恩": {
        "cityId": "W-2659811",
        "cityName": "卢塞恩",
        "fullCityName": "卢塞恩",
        "countryName": "瑞士",
        "countryCode": "CHE",
        "region": "foreign",
        "province": "Lucerne",
        "center": [8.3093, 47.0502]
    },
    "苏黎世": {
        "cityId": "W-2657896",
        "cityName": "苏黎世",
        "fullCityName": "苏黎世",
        "countryName": "瑞士",
        "countryCode": "CHE",
        "region": "foreign",
        "province": "Zurich",
        "center": [8.54806, 47.38193]
    },
    "沙夫豪森": {
        "cityId": "W-2658761",
        "cityName": "沙夫豪森",
        "fullCityName": "沙夫豪森",
        "countryName": "瑞士",
        "countryCode": "CHE",
        "region": "foreign",
        "province": "Schaffhausen",
        "center": [8.633, 47.706]
    },
    # 列支敦士登
    "列支敦士登": {
        "cityId": "LIE",
        "cityName": "列支敦士登",
        "fullCityName": "列支敦士登公国",
        "countryName": "列支敦士登",
        "countryCode": "LIE",
        "region": "foreign",
        "province": "Liechtenstein",
        "center": [9.55427, 47.166]
    },
    # 奥地利
    "维也纳": {
        "cityId": "W-2761369",
        "cityName": "维也纳",
        "fullCityName": "维也纳",
        "countryName": "奥地利",
        "countryCode": "AUT",
        "region": "foreign",
        "province": "Wien",
        "center": [16.36469, 48.20196]
    },
    # 捷克
    "布拉格": {
        "cityId": "W-4548393",
        "cityName": "布拉格",
        "fullCityName": "布拉格",
        "countryName": "捷克",
        "countryCode": "CZE",
        "region": "foreign",
        "province": "Hlavni Mesto Praha",
        "center": [14.46403, 50.08528]
    },
    # 波兰
    "格但斯克": {
        "cityId": "W-3099434",
        "cityName": "格但斯克",
        "fullCityName": "格但斯克",
        "countryName": "波兰",
        "countryCode": "POL",
        "region": "foreign",
        "province": "Pomorskie",
        "center": [18.64004, 54.35998]
    },
    # 意大利
    "威尼斯": {
        "cityId": "W-3164603",
        "cityName": "威尼斯",
        "fullCityName": "威尼斯",
        "countryName": "意大利",
        "countryCode": "ITA",
        "region": "foreign",
        "province": "Veneto",
        "center": [12.335, 45.43866]
    },
    # 挪威
    "奥斯陆": {
        "cityId": "W-3143244",
        "cityName": "奥斯陆",
        "fullCityName": "奥斯陆",
        "countryName": "挪威",
        "countryCode": "NOR",
        "region": "foreign",
        "province": "Oslo",
        "center": [10.74803, 59.91864]
    },
    "特罗姆瑟": {
        "cityId": "W-3133895",
        "cityName": "特罗姆瑟",
        "fullCityName": "特罗姆瑟",
        "countryName": "挪威",
        "countryCode": "NOR",
        "region": "foreign",
        "province": "Troms",
        "center": [18.99203, 69.63508]
    },
    "朗伊尔城": {
        "cityId": "W-2729907",
        "cityName": "朗伊尔城",
        "fullCityName": "朗伊尔城",
        "countryName": "挪威",
        "countryCode": "NOR",
        "region": "foreign",
        "province": "Svalbard",
        "center": [15.6348, 78.2224]
    },
    # 冰岛
    "冰岛": {
        "cityId": "ISL",
        "cityName": "冰岛",
        "fullCityName": "冰岛",
        "countryName": "冰岛",
        "countryCode": "ISL",
        "region": "foreign",
        "province": "Iceland",
        "center": [-19.01892, 64.96375]
    },
    # 南非
    "开普敦": {
        "cityId": "W-3369157",
        "cityName": "开普敦",
        "fullCityName": "开普敦",
        "countryName": "南非",
        "countryCode": "ZAF",
        "region": "foreign",
        "province": "Western Cape",
        "center": [18.43304, -33.91807]
    },
    # 新加坡
    "新加坡": {
        "cityId": "W-1880252",
        "cityName": "新加坡",
        "fullCityName": "新加坡",
        "countryName": "新加坡",
        "countryCode": "SGP",
        "region": "foreign",
        "province": "Singapore",
        "center": [103.85, 1.29]
    },
    # 中国国内城市
    "佳木斯": {
        "cityId": "CN023060",
        "cityName": "佳木斯",
        "fullCityName": "佳木斯市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "黑龙江",
        "center": [132.10057, 47.16927]
    },
    "太原": {
        "cityId": "CN014080",
        "cityName": "太原",
        "fullCityName": "太原市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "山西",
        "center": [112.29402, 37.91702]
    },
    "威海": {
        "cityId": "CN037140",
        "cityName": "威海",
        "fullCityName": "威海市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "山东",
        "center": [121.90552, 37.14204]
    },
    "孝感": {
        "cityId": "CN042160",
        "cityName": "孝感",
        "fullCityName": "孝感市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "湖北",
        "center": [113.9207, 31.11755]
    },
    "桂林": {
        "cityId": "CN045060",
        "cityName": "桂林",
        "fullCityName": "桂林市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "广西",
        "center": [110.52071, 25.35834]
    },
    "武汉": {
        "cityId": "CN042120",
        "cityName": "武汉",
        "fullCityName": "武汉市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "湖北",
        "center": [114.34458, 30.68834]
    },
    "鄂州": {
        "cityId": "CN042020",
        "cityName": "鄂州",
        "fullCityName": "鄂州市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "湖北",
        "center": [114.78749, 30.32561]
    },
    "长沙": {
        "cityId": "CN043020",
        "cityName": "长沙",
        "fullCityName": "长沙市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "湖南",
        "center": [113.06053, 28.22292]
    },
    "香港": {
        "cityId": "CN081010",
        "cityName": "香港",
        "fullCityName": "香港特别行政区",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "香港",
        "center": [114.11562, 22.37123]
    },
    "黄石": {
        "cityId": "CN042040",
        "cityName": "黄石",
        "fullCityName": "黄石市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "湖北",
        "center": [114.98723, 29.92404]
    }
}

# Worker task to generate both standard and HD WebP images
def process_image_task(task):
    in_path, std_out_path, hd_out_path = task
    try:
        # Generate standard webp if missing
        if not os.path.exists(std_out_path):
            with Image.open(in_path) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                max_dim = 1440
                w, h = img.size
                if max(w, h) > max_dim:
                    ratio = max_dim / max(w, h)
                    img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
                img.save(std_out_path, 'WEBP', quality=82, method=4)
                
        # Generate HD webp if missing
        if not os.path.exists(hd_out_path):
            with Image.open(in_path) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                max_dim = 2800
                w, h = img.size
                if max(w, h) > max_dim:
                    ratio = max_dim / max(w, h)
                    img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
                img.save(hd_out_path, 'WEBP', quality=85, method=4)
        return True, in_path
    except Exception as e:
        return False, f"{in_path}: {e}"

def extract_meta(img_path):
    fname = os.path.basename(img_path)
    if fname in MANUAL_GPS:
        return {
            "lat": MANUAL_GPS[fname]["lat"],
            "lng": MANUAL_GPS[fname]["lng"],
            "altitude": MANUAL_GPS[fname]["altitude"],
            "shoot_time": MANUAL_GPS[fname]["shoot_time"]
        }
        
    try:
        with Image.open(img_path) as img:
            exif = img.getexif()
            if not exif:
                return None
            
            shoot_time = None
            for tag_id in [36867, 36868, 306]:
                val = exif.get(tag_id)
                if val:
                    shoot_time = str(val)
                    break
                    
            gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo) if hasattr(ExifTags, 'IFD') else exif.get_ifd(0x8825)
            if not gps_ifd:
                return None
                
            lat = gps_ifd.get(2)
            lat_ref = gps_ifd.get(1, 'N')
            lng = gps_ifd.get(4)
            lng_ref = gps_ifd.get(3, 'E')
            
            if not lat or not lng:
                return None
                
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
                "lat": round(d_lat, 6),
                "lng": round(d_lng, 6),
                "altitude": alt,
                "shoot_time": shoot_time
            }
    except Exception as e:
        print(f"Error reading EXIF {img_path}: {e}")
        return None

def main():
    print("=== Loading existing guessGameData.json ===")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        game_data = json.load(f)
        
    existing_cities_map = {c['cityId']: c for c in game_data.get('cities', [])}
    existing_questions = game_data.get('questions', [])
    
    # Track existing highest photo index for each cityId
    city_photo_max_index = {}
    for q in existing_questions:
        cid = q['cityId']
        # e.g. /TravelMap/game-photos/CN011010/015.webp
        url = q.get('photoUrl', '')
        base = os.path.basename(url)
        idx_str = base.replace('.webp', '')
        try:
            val = int(idx_str)
            city_photo_max_index[cid] = max(city_photo_max_index.get(cid, 0), val)
        except:
            pass
            
    print(f"Loaded {len(existing_cities_map)} cities and {len(existing_questions)} existing questions.")
    
    # Prepare tasks and new questions metadata
    tasks = []
    new_questions = []
    
    max_q_id = 0
    for q in existing_questions:
        try:
            num = int(q['id'].replace('q-', ''))
            max_q_id = max(max_q_id, num)
        except:
            pass
            
    q_counter = max_q_id + 1
    
    for folder_name, cfg in FOLDER_CONFIG.items():
        folder_path = os.path.join(BASE_INPUT, folder_name)
        if not os.path.isdir(folder_path):
            continue
            
        cid = cfg['cityId']
        # If city is not yet in game_data['cities'], register it
        if cid not in existing_cities_map:
            new_city_entry = {
                "cityId": cid,
                "cityName": cfg["cityName"],
                "fullCityName": cfg["fullCityName"],
                "countryName": cfg["countryName"],
                "countryCode": cfg["countryCode"],
                "region": cfg["region"],
                "province": cfg["province"],
                "center": cfg["center"]
            }
            game_data['cities'].append(new_city_entry)
            existing_cities_map[cid] = new_city_entry
            print(f"Registered NEW city: [{cfg['cityName']}] ({cid})")
            
        # Target output directories
        std_city_dir = os.path.join(PUBLIC_PHOTOS, cid)
        hd_city_dir = os.path.join(PUBLIC_PHOTOS_HD, cid)
        os.makedirs(std_city_dir, exist_ok=True)
        os.makedirs(hd_city_dir, exist_ok=True)
        
        current_city_idx = city_photo_max_index.get(cid, 0)
        
        files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        print(f"Folder [{folder_name}] has {len(files)} photos to process...")
        
        for fname in files:
            current_city_idx += 1
            city_photo_max_index[cid] = current_city_idx
            
            in_file = os.path.join(folder_path, fname)
            out_webp_name = f"{current_city_idx:03d}.webp"
            std_out_path = os.path.join(std_city_dir, out_webp_name)
            hd_out_path = os.path.join(hd_city_dir, out_webp_name)
            
            tasks.append((in_file, std_out_path, hd_out_path))
            
            # Extract metadata
            meta = extract_meta(in_file)
            if not meta:
                print(f"CRITICAL ERROR: Failed to get GPS for {in_file}")
                continue
                
            q_entry = {
                "id": f"q-{q_counter:04d}",
                "photoUrl": f"/TravelMap/game-photos/{cid}/{out_webp_name}",
                "cityId": cid,
                "cityName": cfg["cityName"],
                "fullCityName": cfg["fullCityName"],
                "countryName": cfg["countryName"],
                "countryCode": cfg["countryCode"],
                "province": cfg["province"],
                "region": cfg["region"],
                "center": cfg["center"],
                "photoUrlHd": f"/TravelMap/game-photos-hd/{cid}/{out_webp_name}",
                "originalFileName": fname,
                "exactLat": meta["lat"],
                "exactLng": meta["lng"],
                "altitude": meta["altitude"],
                "shootTime": meta["shoot_time"]
            }
            new_questions.append(q_entry)
            q_counter += 1
            
    print(f"\nTotal image processing tasks to run: {len(tasks)}")
    print(f"Total new questions created: {len(new_questions)}")
    
    # Process images using ProcessPoolExecutor
    t0 = time.time()
    success_count = 0
    with ProcessPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(process_image_task, t) for t in tasks]
        for f in as_completed(futures):
            ok, msg = f.result()
            if ok:
                success_count += 1
            else:
                print("Failed:", msg)
                
    elapsed = time.time() - t0
    print(f"Finished processing {success_count}/{len(tasks)} images in {elapsed:.1f}s!")
    
    # Append new questions to game_data
    game_data['questions'].extend(new_questions)
    game_data['totalPhotos'] = len(game_data['questions'])
    
    # Write back to guessGameData.json
    print(f"Writing updated guessGameData.json with {game_data['totalPhotos']} total photos and {len(game_data['cities'])} cities...")
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)
        
    print("Successfully updated guessGameData.json!")

if __name__ == '__main__':
    main()
