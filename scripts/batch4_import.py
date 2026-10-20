import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第四批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

EXCLUDE_FILES = {
    os.path.normpath(r"开姆尼茨\IMG_20240420_125806.jpg"),
    os.path.normpath(r"德累斯顿\IMG_20240528_205704.jpg"),
}

CITY_CONFIGS = {
    "卢森堡": {
        "cityId": "W-2960316",
        "cityName": "卢森堡",
        "fullCityName": "卢森堡",
        "countryName": "卢森堡",
        "countryCode": "LUX",
        "region": "foreign",
        "province": "Luxembourg",
        "center": [6.1296, 49.6116]
    },
    "圣托里尼": {
        "cityId": "EXTRA-SANTORINI",
        "cityName": "圣托里尼",
        "fullCityName": "圣托里尼",
        "countryName": "希腊",
        "countryCode": "GRC",
        "region": "foreign",
        "province": "南爱琴",
        "center": [25.4615, 36.3932]
    },
    "拉纳卡": {
        "cityId": "W-146400",
        "cityName": "拉纳卡",
        "fullCityName": "拉纳卡",
        "countryName": "塞浦路斯",
        "countryCode": "CYP",
        "region": "foreign",
        "province": "拉纳卡区",
        "center": [33.6232, 34.9229]
    },
    "阿依纳帕": {
        "cityId": "EXTRA-AYIA-NAPA",
        "cityName": "阿依纳帕",
        "fullCityName": "阿依纳帕",
        "countryName": "塞浦路斯",
        "countryCode": "CYP",
        "region": "foreign",
        "province": "法马古斯塔区",
        "center": [34.0018, 34.9823]
    },
    "巴黎": {
        "cityId": "W-2988507",
        "cityName": "巴黎",
        "fullCityName": "巴黎",
        "countryName": "法国",
        "countryCode": "FRA",
        "region": "foreign",
        "province": "Île-de-France",
        "center": [2.35222, 48.85661]
    },
    "布鲁塞尔": {
        "cityId": "W-2800866",
        "cityName": "布鲁塞尔",
        "fullCityName": "布鲁塞尔",
        "countryName": "比利时",
        "countryCode": "BEL",
        "region": "foreign",
        "province": "Brussels Capital Region",
        "center": [4.3517, 50.8503]
    },
    "库肯霍夫": {
        "cityId": "W-2751790",
        "cityName": "库肯霍夫",
        "fullCityName": "库肯霍夫",
        "countryName": "荷兰",
        "countryCode": "NLD",
        "region": "foreign",
        "province": "Zuid-Holland",
        "center": [4.5469, 52.2700]
    },
    "开姆尼茨": {
        "cityId": "W-2940132",
        "cityName": "开姆尼茨",
        "fullCityName": "开姆尼茨",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Sachsen",
        "center": [12.9253, 50.8357]
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
    "慕尼黑": {
        "cityId": "W-2867714",
        "cityName": "慕尼黑",
        "fullCityName": "慕尼黑",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Bayern",
        "center": [11.5755, 48.1374]
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
    "梵蒂冈": {
        "cityId": "W-6691831",
        "cityName": "梵蒂冈",
        "fullCityName": "梵蒂冈城国",
        "countryName": "梵蒂冈",
        "countryCode": "VAT",
        "region": "foreign",
        "province": "Vatican City",
        "center": [12.4534, 41.9029]
    },
    "海牙": {
        "cityId": "W-2747373",
        "cityName": "海牙",
        "fullCityName": "海牙",
        "countryName": "荷兰",
        "countryCode": "NLD",
        "region": "foreign",
        "province": "Zuid-Holland",
        "center": [4.3007, 52.0705]
    },
    "罗马": {
        "cityId": "W-3169070",
        "cityName": "罗马",
        "fullCityName": "罗马",
        "countryName": "意大利",
        "countryCode": "ITA",
        "region": "foreign",
        "province": "Lazio",
        "center": [12.4964, 41.9028]
    },
    "莱比锡": {
        "cityId": "W-2879139",
        "cityName": "莱比锡",
        "fullCityName": "莱比锡",
        "countryName": "德国",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Sachsen",
        "center": [12.3731, 51.3397]
    },
    "赞丹": {
        "cityId": "W-2744114",
        "cityName": "赞丹",
        "fullCityName": "赞丹",
        "countryName": "荷兰",
        "countryCode": "NLD",
        "region": "foreign",
        "province": "Noord-Holland",
        "center": [4.8256, 52.4420]
    },
    "阿姆斯特丹": {
        "cityId": "W-2759794",
        "cityName": "阿姆斯特丹",
        "fullCityName": "阿姆斯特丹",
        "countryName": "荷兰",
        "countryCode": "NLD",
        "region": "foreign",
        "province": "Noord-Holland",
        "center": [4.9041, 52.3676]
    },
    "雅典": {
        "cityId": "W-264371",
        "cityName": "雅典",
        "fullCityName": "雅典",
        "countryName": "希腊",
        "countryCode": "GRC",
        "region": "foreign",
        "province": "Attica",
        "center": [23.7275, 37.9838]
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
    
    # Iterate through folders in batch 4
    for folder_name in sorted(os.listdir(BASE_INPUT)):
        folder_path = os.path.join(BASE_INPUT, folder_name)
        if not os.path.isdir(folder_path):
            continue
            
        # Top-level images only in this folder
        files = sorted([f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f)) and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        print(f"\nProcessing folder [{folder_name}] ({len(files)} candidate photos)...")
        
        for fname in files:
            rel_path = os.path.normpath(os.path.join(folder_name, fname))
            if rel_path in EXCLUDE_FILES:
                print(f"  --> Skipping excluded file: {rel_path}")
                continue
                
            in_file = os.path.join(folder_path, fname)
            meta = extract_meta(in_file)
            if not meta:
                print(f"  --> CRITICAL: No GPS found for {rel_path}, skipping!")
                continue
                
            # Classify city target
            if folder_name == "塞浦路斯":
                target_city_name = "阿依纳帕" if meta['lng'] > 33.8 else "拉纳卡"
            else:
                target_city_name = folder_name
                
            cfg = CITY_CONFIGS.get(target_city_name)
            if not cfg:
                print(f"  --> ERROR: Unknown city target '{target_city_name}' for {rel_path}")
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
    print(f"==========================================")
    
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
