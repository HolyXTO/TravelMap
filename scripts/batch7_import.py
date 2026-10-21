import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第七批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

DISCARDED = {
    ("\u6155\u5c3c\u9ed1", "IMG_20241207_145433.jpg"),
    ("\u6b66\u6c49", "IMG_20250104_211007.jpg"),
    ("\u7f57\u5f17\u6566\u7fa4\u5c9b", "IMG_20241117_130537_BURST002.jpg"),
    ("\u5e03\u62c9\u683c", "IMG_20241028_173613.jpg"),
    ("\u6ce2\u8328\u5766", "IMG_20241210_153346.jpg")
}

CITY_CONFIGS = {
    "\u535a\u5fb7": {  # 博德
        "cityId": "W-25390",
        "cityName": "\u535a\u5fb7",
        "fullCityName": "\u535a\u5fb7",
        "countryName": "\u632a\u5a01",
        "countryCode": "NOR",
        "region": "foreign",
        "province": "Nordland",
        "center": [14.4050, 67.2804]
    },
    "\u5965\u65af\u9646": {  # 奥斯陆
        "cityId": "W-3143244",
        "cityName": "\u5965\u65af\u9646",
        "fullCityName": "\u5965\u65af\u9646",
        "countryName": "\u632a\u5a01",
        "countryCode": "NOR",
        "region": "foreign",
        "province": "Oslo",
        "center": [10.74803, 59.91864]
    },
    "\u5c3c\u65af": {  # 尼斯
        "cityId": "W-33959",
        "cityName": "\u5c3c\u65af",
        "fullCityName": "\u5c3c\u65af",
        "countryName": "\u6cd5\u56fd",
        "countryCode": "FRA",
        "region": "foreign",
        "province": "Provence-Alpes-C\u00f4te d'Azur",
        "center": [7.2620, 43.7102]
    },
    "\u5e03\u62c9\u683c": {  # 布拉格
        "cityId": "W-4548393",
        "cityName": "\u5e03\u62c9\u683c",
        "fullCityName": "\u5e03\u62c9\u683c",
        "countryName": "\u6377\u514b",
        "countryCode": "CZE",
        "region": "foreign",
        "province": "Hlavn\u00ed m\u011bsto Praha",
        "center": [14.46403, 50.08528]
    },
    "\u5fb7\u7d2f\u65af\u987f": {  # 德累斯顿
        "cityId": "W-2935022",
        "cityName": "\u5fb7\u7d2f\u65af\u987f",
        "fullCityName": "\u5fb7\u7d2f\u65af\u987f",
        "countryName": "\u5fb7\u56fd",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Sachsen",
        "center": [13.75, 51.04997]
    },
    "\u6155\u5c3c\u9ed1": {  # 慕尼黑
        "cityId": "W-2867714",
        "cityName": "\u6155\u5c3c\u9ed1",
        "fullCityName": "\u6155\u5c3c\u9ed1",
        "countryName": "\u5fb7\u56fd",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Bayern",
        "center": [11.5755, 48.1374]
    },
    "\u5929\u9e45\u5821": {  # 天鹅堡
        "cityId": "W-4152",
        "cityName": "\u5929\u9e45\u5821",
        "fullCityName": "\u5929\u9e45\u5821",
        "countryName": "\u5fb7\u56fd",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Bayern",
        "center": [10.7498, 47.5576]
    },
    "\u621b\u7eb3": {  # 戛纳
        "cityId": "W-39984",
        "cityName": "\u621b\u7eb3",
        "fullCityName": "\u621b\u7eb3",
        "countryName": "\u6cd5\u56fd",
        "countryCode": "FRA",
        "region": "foreign",
        "province": "Provence-Alpes-C\u00f4te d'Azur",
        "center": [7.0174, 43.5528]
    },
    "\u6469\u7eb3\u54e5": {  # 摩纳哥
        "cityId": "W-235",
        "cityName": "\u6469\u7eb3\u54e5",
        "fullCityName": "\u6469\u7eb3\u54e5",
        "countryName": "\u6469\u7eb3\u54e5",
        "countryCode": "MCO",
        "region": "foreign",
        "province": "Monaco",
        "center": [7.4246, 43.7384]
    },
    "\u67cf\u6797": {  # 柏林
        "cityId": "W-2950159",
        "cityName": "\u67cf\u6797",
        "fullCityName": "\u67cf\u6797",
        "countryName": "\u5fb7\u56fd",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Berlin",
        "center": [13.405, 52.52]
    },
    "\u6b66\u6c49": {  # 武汉
        "cityId": "CN042120",
        "cityName": "\u6b66\u6c49",
        "fullCityName": "\u6b66\u6c49\u5e02",
        "countryName": "\u4e2d\u56fd",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "\u6e56\u5317",
        "center": [114.34458, 30.68834]
    },
    "\u6ce2\u8328\u5766": {  # 波茨坦
        "cityId": "W-1711",
        "cityName": "\u6ce2\u8328\u5766",
        "fullCityName": "\u6ce2\u8328\u5766",
        "countryName": "\u5fb7\u56fd",
        "countryCode": "DEU",
        "region": "foreign",
        "province": "Brandenburg",
        "center": [13.0645, 52.3906]
    },
    "\u7f57\u5f17\u6566\u7fa4\u5c9b": {  # 罗弗敦群岛
        "cityId": "W-186378",
        "cityName": "\u7f57\u5f17\u6566\u7fa4\u5c9b",
        "fullCityName": "\u7f57\u5f17\u6566\u7fa4\u5c9b",
        "countryName": "\u632a\u5a01",
        "countryCode": "NOR",
        "region": "foreign",
        "province": "Nordland",
        "center": [13.6000, 68.1000]
    },
    "\u8292\u901a": {  # 芒通
        "cityId": "W-179375",
        "cityName": "\u8292\u901a",
        "fullCityName": "\u8292\u901a",
        "countryName": "\u6cd5\u56fd",
        "countryCode": "FRA",
        "region": "foreign",
        "province": "Provence-Alpes-C\u00f4te d'Azur",
        "center": [7.4975, 43.7745]
    },
    "\u94c1\u5cad": {  # 铁岭
        "cityId": "CN021120",
        "cityName": "\u94c1\u5cad",
        "fullCityName": "\u94c1\u5cad\u5e02",
        "countryName": "\u4e2d\u56fd",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "\u8fbd\u5b81",
        "center": [123.8447, 42.2905]
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
    current_q_count = len(existing_questions)
    print(f"Current questions: {current_q_count}, current cities: {len(existing_cities_map)}")
    
    # Scan batch 7 photos
    folders = sorted(os.listdir(BASE_INPUT))
    
    # Collect photos per city target
    city_photos = {}
    for cname in CITY_CONFIGS:
        city_photos[cname] = []
        
    for fld in folders:
        fld_path = os.path.join(BASE_INPUT, fld)
        if not os.path.isdir(fld_path): continue
        files = sorted([f for f in os.listdir(fld_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        
        for f in files:
            if (fld, f) in DISCARDED:
                print(f"Discarding: [{repr(fld)}] {f}")
                continue
                
            fp = os.path.join(fld_path, f)
            meta = extract_meta(fp)
            if not meta:
                print(f"ERROR: Cannot extract GPS from {fp}!")
                continue
                
            # Determine target city
            if fld == "\u6155\u5c3c\u9ed1":  # 慕尼黑
                if f.startswith("IMG_20241208_"):
                    target_city = "\u5929\u9e45\u5821"  # 天鹅堡
                else:
                    target_city = "\u6155\u5c3c\u9ed1"
            else:
                target_city = fld
                
            if target_city not in city_photos:
                print(f"ERROR: Unknown target city {repr(target_city)} for file {f} in folder {repr(fld)}")
                continue
                
            city_photos[target_city].append({
                "in_path": fp,
                "file_name": f,
                "meta": meta
            })

    total_valid = sum(len(v) for v in city_photos.values())
    print(f"\nTotal valid photos collected across all targets: {total_valid} (Expected: 296)")
    assert total_valid == 296, f"Expected 296 photos, got {total_valid}"
    
    for cname, plist in city_photos.items():
        print(f"  - {CITY_CONFIGS[cname]['cityName']} ({CITY_CONFIGS[cname]['cityId']}): {len(plist)} photos")

    # Determine existing max file index for each city
    tasks = []
    new_questions = []
    next_qid = current_q_count + 1

    for cname, plist in city_photos.items():
        if not plist: continue
        cfg = CITY_CONFIGS[cname]
        cid = cfg["cityId"]
        
        # Ensure target directories exist
        c_std_dir = os.path.join(PUBLIC_PHOTOS, cid)
        c_hd_dir = os.path.join(PUBLIC_PHOTOS_HD, cid)
        os.makedirs(c_std_dir, exist_ok=True)
        os.makedirs(c_hd_dir, exist_ok=True)
        
        # Check existing webp files in target dir
        existing_files = [f for f in os.listdir(c_std_dir) if f.endswith('.webp')]
        existing_nums = []
        for ef in existing_files:
            try:
                num = int(os.path.splitext(ef)[0])
                existing_nums.append(num)
            except:
                pass
        start_idx = max(existing_nums) + 1 if existing_nums else 1
        print(f"City {cfg['cityName']} ({cid}): existing {len(existing_nums)} photos, starting from index {start_idx:03d}")
        
        for item in plist:
            seq_str = f"{start_idx:03d}"
            std_out = os.path.join(c_std_dir, f"{seq_str}.webp")
            hd_out = os.path.join(c_hd_dir, f"{seq_str}.webp")
            
            tasks.append((item["in_path"], std_out, hd_out))
            
            # Form question object
            meta = item["meta"]
            q_obj = {
                "id": f"q-{next_qid}",
                "photoUrl": f"/TravelMap/game-photos/{cid}/{seq_str}.webp",
                "cityId": cid,
                "cityName": cfg["cityName"],
                "fullCityName": cfg["fullCityName"],
                "countryName": cfg["countryName"],
                "countryCode": cfg["countryCode"],
                "province": cfg["province"],
                "region": cfg["region"],
                "center": cfg["center"],
                "photoUrlHd": f"/TravelMap/game-photos-hd/{cid}/{seq_str}.webp",
                "originalFileName": item["file_name"],
                "exactLat": meta["lat"],
                "exactLng": meta["lng"],
                "altitude": meta["altitude"],
                "shootTime": meta["shoot_time"]
            }
            new_questions.append(q_obj)
            next_qid += 1
            start_idx += 1

    print(f"\nTotal image processing tasks: {len(tasks)}")
    print(f"Total new questions prepared: {len(new_questions)}")
    assert len(tasks) == 296
    assert len(new_questions) == 296
    
    # Process images in parallel (skip existing)
    print("Processing WebP images (skipping already generated)...")
    t0 = time.time()
    success_count = 0
    with ProcessPoolExecutor(max_workers=min(os.cpu_count() or 4, 8)) as executor:
        futures = {executor.submit(process_image_task, t): t for t in tasks}
        for f in as_completed(futures):
            ok, res = f.result()
            if ok:
                success_count += 1
                if success_count % 50 == 0 or success_count == len(tasks):
                    print(f"Processed {success_count}/{len(tasks)} photos ({time.time()-t0:.1f}s)...")
            else:
                print(f"Failed task: {res}")
                
    print(f"Image processing completed in {time.time()-t0:.1f}s. Success: {success_count}/{len(tasks)}")
    assert success_count == len(tasks)
    
    # Update game_data cities
    for cname, plist in city_photos.items():
        if not plist: continue
        cfg = CITY_CONFIGS[cname]
        cid = cfg["cityId"]
        if cid not in existing_cities_map:
            new_city_obj = {
                "cityId": cid,
                "cityName": cfg["cityName"],
                "fullCityName": cfg["fullCityName"],
                "countryName": cfg["countryName"],
                "countryCode": cfg["countryCode"],
                "region": cfg["region"],
                "province": cfg["province"],
                "center": cfg["center"]
            }
            game_data["cities"].append(new_city_obj)
            existing_cities_map[cid] = new_city_obj
            print(f"Added new city to guessGameData.json: {cfg['cityName']} ({cid})")

    # Append new questions
    game_data["questions"].extend(new_questions)
    game_data["totalPhotos"] = len(game_data["questions"])
    
    print(f"\nFinal questions count: {len(game_data['questions'])}")
    print(f"Final cities count: {len(game_data['cities'])}")
    print(f"Total photos field: {game_data['totalPhotos']}")
    assert len(game_data["questions"]) == 3834
    assert game_data["totalPhotos"] == 3834
    
    # Save guessGameData.json
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)
    print("Successfully updated src/data/guessGameData.json!")

if __name__ == '__main__':
    main()
