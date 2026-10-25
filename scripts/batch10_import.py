import os
import sys
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第十批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

CITY_CONFIGS = {
    "上海": {
        "cityId": "CN031010",
        "cityName": "上海",
        "fullCityName": "上海市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "上海",
        "center": [121.3522, 31.2629]
    },
    "北京": {
        "cityId": "CN011010",
        "cityName": "北京",
        "fullCityName": "北京市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "北京",
        "center": [116.43082, 40.23703]
    },
    "南昌": {
        "cityId": "CN036060",
        "cityName": "南昌",
        "fullCityName": "南昌市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "江西",
        "center": [115.9890, 28.6641]
    },
    "景德镇": {
        "cityId": "CN036040",
        "cityName": "景德镇",
        "fullCityName": "景德镇市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "江西",
        "center": [117.3433, 29.3342]
    },
    "洛阳": {
        "cityId": "CN041070",
        "cityName": "洛阳",
        "fullCityName": "洛阳市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "河南",
        "center": [112.0207, 34.3336]
    },
    "襄阳": {
        "cityId": "CN042130",
        "cityName": "襄阳",
        "fullCityName": "襄阳市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "湖北",
        "center": [111.9025, 31.9340]
    },
    "贵阳": {
        "cityId": "CN052030",
        "cityName": "贵阳",
        "fullCityName": "贵阳市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "贵州",
        "center": [106.6909, 26.7979]
    },
    "安顺": {
        "cityId": "CN052010",
        "cityName": "安顺",
        "fullCityName": "安顺市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "贵州",
        "center": [105.8905, 25.9886]
    },
    "黔南": {
        "cityId": "CN052060",
        "cityName": "黔南",
        "fullCityName": "黔南布依族苗族自治州",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "贵州",
        "center": [107.2644, 26.2977]
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
        
    existing_questions = game_data.get('questions', [])
    current_q_count = len(existing_questions)
    print(f"Current questions: {current_q_count}, current cities: {len(game_data.get('cities', []))}")
    assert current_q_count == 4268, f"Expected 4268 existing questions, found {current_q_count}"

    existing_cities_map = {c['cityId']: c for c in game_data.get('cities', [])}
    
    # Scan batch 10 photos
    folders = sorted(os.listdir(BASE_INPUT))
    city_photos = {cname: [] for cname in CITY_CONFIGS}
    
    for fld in folders:
        fld_path = os.path.join(BASE_INPUT, fld)
        if not os.path.isdir(fld_path): continue
        files = sorted([f for f in os.listdir(fld_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        
        for f in files:
            fp = os.path.join(fld_path, f)
            meta = extract_meta(fp)
            if not meta:
                print(f"ERROR: Cannot extract GPS from {fp}!")
                continue
                
            # Routing logic
            if fld == "贵州":
                if f.startswith("IMG_20231003_") or f.startswith("IMG_20231006_"):
                    target_city = "贵阳"
                elif f.startswith("IMG_20231004_"):
                    target_city = "安顺"
                elif f.startswith("IMG_20231005_"):
                    target_city = "黔南"
                else:
                    target_city = "贵阳"
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
    print(f"\nTotal valid photos collected across all targets: {total_valid} (Expected: 97)")
    assert total_valid == 97, f"Expected 97 photos, got {total_valid}"
    
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
                "id": f"q-{next_qid:04d}",
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
    assert len(tasks) == 97
    assert len(new_questions) == 97
    
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
                if success_count % 30 == 0 or success_count == len(tasks):
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
    assert len(game_data["questions"]) == 4365
    assert game_data["totalPhotos"] == 4365
    
    # Save guessGameData.json
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)
    print("Successfully updated src/data/guessGameData.json!")

if __name__ == '__main__':
    main()
