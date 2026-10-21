import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第五批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

CITY_CONFIGS = {
    "佛罗伦萨": {
        "cityId": "W-3176959",
        "cityName": "佛罗伦萨",
        "fullCityName": "佛罗伦萨",
        "countryName": "意大利",
        "countryCode": "ITA",
        "region": "foreign",
        "province": "Toscana",
        "center": [11.2558, 43.7696]
    },
    "哥本哈根": {
        "cityId": "W-2618425",
        "cityName": "哥本哈根",
        "fullCityName": "哥本哈根",
        "countryName": "丹麦",
        "countryCode": "DNK",
        "region": "foreign",
        "province": "Capital Region",
        "center": [12.5683, 55.6761]
    },
    "圣马力诺": {
        "cityId": "SMR",
        "cityName": "圣马力诺",
        "fullCityName": "圣马力诺",
        "countryName": "圣马力诺",
        "countryCode": "SMR",
        "region": "foreign",
        "province": "San Marino",
        "center": [12.4477, 43.9351]
    },
    "地拉那": {
        "cityId": "W-3183875",
        "cityName": "地拉那",
        "fullCityName": "地拉那",
        "countryName": "阿尔巴尼亚",
        "countryCode": "ALB",
        "region": "foreign",
        "province": "Tirana",
        "center": [19.8187, 41.3275]
    },
    "塔林": {
        "cityId": "W-588409",
        "cityName": "塔林",
        "fullCityName": "塔林",
        "countryName": "爱沙尼亚",
        "countryCode": "EST",
        "region": "foreign",
        "province": "Harjumaa",
        "center": [24.7536, 59.4370]
    },
    "多特蒙德": {
        "cityId": "W-2935517",
        "cityName": "多特蒙德",
        "fullCityName": "多特蒙德",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Nordrhein-Westfalen",
        "center": [7.4653, 51.5136]
    },
    "安道尔": {
        "cityId": "AND",
        "cityName": "安道尔",
        "fullCityName": "安道尔城",
        "countryName": "安道尔",
        "countryCode": "AND",
        "region": "foreign",
        "province": "Andorra la Vella",
        "center": [1.5218, 42.5063]
    },
    "巴塞罗那": {
        "cityId": "W-3128760",
        "cityName": "巴塞罗那",
        "fullCityName": "巴塞罗那",
        "countryName": "西班牙",
        "countryCode": "ESP",
        "region": "foreign",
        "province": "Cataluña",
        "center": [2.1734, 41.3851]
    },
    "布加勒斯特": {
        "cityId": "W-683506",
        "cityName": "布加勒斯特",
        "fullCityName": "布加勒斯特",
        "countryName": "罗马尼亚",
        "countryCode": "ROU",
        "region": "foreign",
        "province": "București",
        "center": [26.1025, 44.4268]
    },
    "布拉迪斯拉发": {
        "cityId": "W-3060972",
        "cityName": "布拉迪斯拉发",
        "fullCityName": "布拉迪斯拉发",
        "countryName": "斯洛伐克",
        "countryCode": "SVK",
        "region": "foreign",
        "province": "Bratislava",
        "center": [17.1077, 48.1486]
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
    "迈森": {
        "cityId": "W-2872225",
        "cityName": "迈森",
        "fullCityName": "迈森",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Sachsen",
        "center": [13.4774, 51.1634]
    },
    "柏林": {
        "cityId": "W-2950159",
        "cityName": "柏林",
        "fullCityName": "柏林",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Berlin",
        "center": [13.4050, 52.5200]
    },
    "比萨": {
        "cityId": "W-3170647",
        "cityName": "比萨",
        "fullCityName": "比萨",
        "countryName": "意大利",
        "countryCode": "ITA",
        "region": "foreign",
        "province": "Toscana",
        "center": [10.4017, 43.7228]
    },
    "科隆": {
        "cityId": "W-2886242",
        "cityName": "科隆",
        "fullCityName": "科隆",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Nordrhein-Westfalen",
        "center": [6.9603, 50.9375]
    },
    "米兰": {
        "cityId": "W-3173435",
        "cityName": "米兰",
        "fullCityName": "米兰",
        "countryName": "意大利",
        "countryCode": "ITA",
        "region": "foreign",
        "province": "Lombardia",
        "center": [9.1900, 45.4642]
    },
    "索非亚": {
        "cityId": "W-727011",
        "cityName": "索非亚",
        "fullCityName": "索非亚",
        "countryName": "保加利亚",
        "countryCode": "BGR",
        "region": "foreign",
        "province": "Sofia-Capital",
        "center": [23.3219, 42.6977]
    },
    "维也纳": {
        "cityId": "W-2761369",
        "cityName": "维也纳",
        "fullCityName": "维也纳",
        "countryName": "奥地利",
        "countryCode": "AUT",
        "region": "foreign",
        "province": "Vienna",
        "center": [16.3721, 48.2085]
    },
    "赫尔辛基": {
        "cityId": "W-658225",
        "cityName": "赫尔辛基",
        "fullCityName": "赫尔辛基",
        "countryName": "芬兰",
        "countryCode": "FIN",
        "region": "foreign",
        "province": "Uusimaa",
        "center": [24.9384, 60.1699]
    },
    "都拉斯": {
        "cityId": "W-3185728",
        "cityName": "都拉斯",
        "fullCityName": "都拉斯",
        "countryName": "阿尔巴尼亚",
        "countryCode": "ALB",
        "region": "foreign",
        "province": "Durrës",
        "center": [19.4550, 41.3230]
    },
    "里米尼": {
        "cityId": "W-3169361",
        "cityName": "里米尼",
        "fullCityName": "里米尼",
        "countryName": "意大利",
        "countryCode": "ITA",
        "region": "foreign",
        "province": "Emilia-Romagna",
        "center": [12.5695, 44.0678]
    },
    "马尔默": {
        "cityId": "W-2692969",
        "cityName": "马尔默",
        "fullCityName": "马尔默",
        "countryName": "瑞典",
        "countryCode": "SWE",
        "region": "foreign",
        "province": "Skåne",
        "center": [13.0038, 55.6050]
    },
    "马略卡岛": {
        "cityId": "W-2512989",
        "cityName": "马略卡岛",
        "fullCityName": "马略卡岛",
        "countryName": "西班牙",
        "countryCode": "ESP",
        "region": "foreign",
        "province": "Illes Balears",
        "center": [2.9444, 39.5647]
    }
}

# Worker task to generate both standard and HD WebP images
def process_image_task(task):
    in_path, std_out_path, hd_out_path = task
    try:
        # Standard webp (1440px max)
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
                
        # HD webp (2800px max)
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
        url = q.get('photoUrl', '')
        base = os.path.basename(url)
        idx_str = base.replace('.webp', '')
        try:
            val = int(idx_str)
            city_photo_max_index[cid] = max(city_photo_max_index.get(cid, 0), val)
        except:
            pass
            
    print(f"Loaded {len(existing_cities_map)} cities and {len(existing_questions)} existing questions.")
    
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
    
    # Iterate through folders in batch 5
    for folder_name in sorted(os.listdir(BASE_INPUT)):
        folder_path = os.path.join(BASE_INPUT, folder_name)
        if not os.path.isdir(folder_path):
            continue
            
        files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f)) and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        if len(files) == 0:
            print(f"Skipping empty folder [{folder_name}]")
            continue
            
        print(f"\nProcessing folder [{folder_name}] ({len(files)} candidate photos)...")
        
        for fname in files:
            in_file = os.path.join(folder_path, fname)
            meta = extract_meta(in_file)
            if not meta:
                print(f"  --> CRITICAL: No GPS found for {folder_name}/{fname}, skipping!")
                continue
                
            # Classify city target based on user rules:
            # 1. IMG_20240914_125225.jpg in Rimini moves to San Marino
            if folder_name == "里米尼" and fname == "IMG_20240914_125225.jpg":
                target_city_name = "圣马力诺"
            # 2. 17 Meißen photos in Dresden folder:
            elif folder_name == "德累斯顿" and (fname.startswith("IMG_20240810_") or meta['lng'] < 13.6):
                target_city_name = "迈森"
            else:
                target_city_name = folder_name
                
            cfg = CITY_CONFIGS.get(target_city_name)
            if not cfg:
                print(f"  --> ERROR: Unknown city target '{target_city_name}' for {folder_name}/{fname}")
                continue
                
            cid = cfg['cityId']
            
            # Register city entry if new
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
                print(f"  --> Registered NEW city: [{cfg['cityName']}] ({cid})")
                
            # Prepare destination webp paths
            std_city_dir = os.path.join(PUBLIC_PHOTOS, cid)
            hd_city_dir = os.path.join(PUBLIC_PHOTOS_HD, cid)
            os.makedirs(std_city_dir, exist_ok=True)
            os.makedirs(hd_city_dir, exist_ok=True)
            
            current_city_idx = city_photo_max_index.get(cid, 0) + 1
            city_photo_max_index[cid] = current_city_idx
            
            out_webp_name = f"{current_city_idx:03d}.webp"
            std_out_path = os.path.join(std_city_dir, out_webp_name)
            hd_out_path = os.path.join(hd_city_dir, out_webp_name)
            
            tasks.append((in_file, std_out_path, hd_out_path))
            
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
            
    print(f"\n==========================================")
    print(f"Total image processing tasks: {len(tasks)}")
    print(f"Total new questions created: {len(new_questions)}")
    print(f"Expected new questions: 908")
    print(f"==========================================")
    
    assert len(new_questions) == 908, f"Expected 908 questions, got {len(new_questions)}!"
    
    # Process images with ProcessPoolExecutor
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
    
    print(f"Writing updated guessGameData.json with {game_data['totalPhotos']} total photos and {len(game_data['cities'])} cities...")
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)
        
    print("Successfully updated guessGameData.json!")

if __name__ == '__main__':
    main()
