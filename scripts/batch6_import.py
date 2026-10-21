import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第六批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

CITY_CONFIGS = {
    "卢布尔雅那": {
        "cityId": "W-437",
        "cityName": "卢布尔雅那",
        "fullCityName": "卢布尔雅那",
        "countryName": "斯洛文尼亚",
        "countryCode": "SVN",
        "region": "foreign",
        "province": "Osrednjeslovenska",
        "center": [14.5058, 46.0569]
    },
    "布莱德": {
        "cityId": "W-204124",
        "cityName": "布莱德",
        "fullCityName": "布莱德",
        "countryName": "斯洛文尼亚",
        "countryCode": "SVN",
        "region": "foreign",
        "province": "Gorenjska",
        "center": [14.1006, 46.3649]
    },
    "布达佩斯": {
        "cityId": "W-1781",
        "cityName": "布达佩斯",
        "fullCityName": "布达佩斯",
        "countryName": "匈牙利",
        "countryCode": "HUN",
        "region": "foreign",
        "province": "Budapest",
        "center": [19.0402, 47.4979]
    },
    "萨拉热窝": {
        "cityId": "W-11194",
        "cityName": "萨拉热窝",
        "fullCityName": "萨拉热窝",
        "countryName": "波黑",
        "countryCode": "BIH",
        "region": "foreign",
        "province": "Sarajevo",
        "center": [18.4131, 43.8563]
    },
    "贝尔格莱德": {
        "cityId": "W-3711",
        "cityName": "贝尔格莱德",
        "fullCityName": "贝尔格莱德",
        "countryName": "塞尔维亚",
        "countryCode": "SRB",
        "region": "foreign",
        "province": "Belgrade",
        "center": [20.4489, 44.7866]
    },
    "波德戈里察": {
        "cityId": "W-23564",
        "cityName": "波德戈里察",
        "fullCityName": "波德戈里察",
        "countryName": "黑山",
        "countryCode": "MNE",
        "region": "foreign",
        "province": "Podgorica",
        "center": [19.2595, 42.4411]
    },
    "尼克希奇": {
        "cityId": "W-191081",
        "cityName": "尼克希奇",
        "fullCityName": "尼克希奇",
        "countryName": "黑山",
        "countryCode": "MNE",
        "region": "foreign",
        "province": "Nikšić",
        "center": [18.9468, 42.7699]
    },
    "布德瓦": {
        "cityId": "W-181180",
        "cityName": "布德瓦",
        "fullCityName": "布德瓦",
        "countryName": "黑山",
        "countryCode": "MNE",
        "region": "foreign",
        "province": "Budva",
        "center": [18.8400, 42.2889]
    },
    "杜布罗夫尼克": {
        "cityId": "W-1722",
        "cityName": "杜布罗夫尼克",
        "fullCityName": "杜布罗夫尼克",
        "countryName": "克罗地亚",
        "countryCode": "HRV",
        "region": "foreign",
        "province": "Dubrovnik-Neretva",
        "center": [18.0944, 42.6507]
    },
    "里加": {
        "cityId": "W-1773",
        "cityName": "里加",
        "fullCityName": "里加",
        "countryName": "拉脱维亚",
        "countryCode": "LVA",
        "region": "foreign",
        "province": "Riga",
        "center": [24.1052, 56.9496]
    },
    "尤尔马拉": {
        "cityId": "W-178385",
        "cityName": "尤尔马拉",
        "fullCityName": "尤尔马拉",
        "countryName": "拉脱维亚",
        "countryCode": "LVA",
        "region": "foreign",
        "province": "Jūrmala",
        "center": [23.7941, 56.9742]
    },
    "维尔纽斯": {
        "cityId": "W-216",
        "cityName": "维尔纽斯",
        "fullCityName": "维尔纽斯",
        "countryName": "立陶宛",
        "countryCode": "LTU",
        "region": "foreign",
        "province": "Vilnius",
        "center": [25.2797, 54.6872]
    },
    "里斯本": {
        "cityId": "W-597",
        "cityName": "里斯本",
        "fullCityName": "里斯本",
        "countryName": "葡萄牙",
        "countryCode": "PRT",
        "region": "foreign",
        "province": "Lisboa",
        "center": [-9.1393, 38.7223]
    },
    "罗卡角": {
        "cityId": "W-215886",
        "cityName": "罗卡角",
        "fullCityName": "罗卡角",
        "countryName": "葡萄牙",
        "countryCode": "PRT",
        "region": "foreign",
        "province": "Lisboa",
        "center": [-9.4981, 38.7802]
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
    
    # Iterate through folders in batch 6
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
            # 1. 4 Nikšić photos in Podgorica folder
            if folder_name == "波德戈里察" and (fname.startswith("IMG_20241019_1246") or meta['lat'] > 42.7):
                target_city_name = "尼克希奇"
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
    print(f"Expected new questions: 787")
    print(f"==========================================")
    
    assert len(new_questions) == 787, f"Expected 787 questions, got {len(new_questions)}!"
    
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
