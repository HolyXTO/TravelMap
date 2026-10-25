import os
import sys
import json
import time
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ExifTags

sys.stdout.reconfigure(encoding='utf-8')

BASE_INPUT = r"C:\Users\HolyX\Desktop\图寻照片candidate\第八批"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

DISCARDED = {
    ("多哈", "IMG_20250608_084317.jpg"),
    ("多哈", "IMG_20250608_135139.jpg")
}

CITY_CONFIGS = {
    "佳木斯": {
        "cityId": "CN023060",
        "cityName": "佳木斯",
        "fullCityName": "佳木斯市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "黑龙江",
        "center": [130.3568, 46.8030]
    },
    "四平": {
        "cityId": "CN022060",
        "cityName": "四平",
        "fullCityName": "四平市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "吉林",
        "center": [124.3707, 43.1703]
    },
    "多哈": {
        "cityId": "W-290030",
        "cityName": "多哈",
        "fullCityName": "多哈",
        "countryName": "卡塔尔",
        "countryCode": "QAT",
        "region": "foreign",
        "province": "Ad Dawhah",
        "center": [51.53297, 25.28656]
    },
    "天津": {
        "cityId": "CN012010",
        "cityName": "天津",
        "fullCityName": "天津市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "天津",
        "center": [117.2008, 39.1189]
    },
    "徐州": {
        "cityId": "CN032100",
        "cityName": "徐州",
        "fullCityName": "徐州市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "江苏",
        "center": [117.48197, 34.30846]
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
    "沈阳": {
        "cityId": "CN021120",
        "cityName": "沈阳",
        "fullCityName": "沈阳市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "辽宁",
        "center": [123.4315, 41.8057]
    },
    "衢州": {
        "cityId": "CN033070",
        "cityName": "衢州",
        "fullCityName": "衢州市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "浙江",
        "center": [118.66652, 28.86803]
    },
    "重庆": {
        "cityId": "CN050010",
        "cityName": "重庆",
        "fullCityName": "重庆市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "重庆",
        "center": [107.73132, 30.18623]
    },
    "铁岭": {
        "cityId": "CN021130",
        "cityName": "铁岭",
        "fullCityName": "铁岭市",
        "countryName": "中国",
        "countryCode": "CHN",
        "region": "domestic",
        "province": "辽宁",
        "center": [123.8447, 42.2905]
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
    "阿布扎比": {
        "cityId": "W-292968",
        "cityName": "阿布扎比",
        "fullCityName": "阿布扎比",
        "countryName": "阿联酋",
        "countryCode": "ARE",
        "region": "foreign",
        "province": "Abu Dhabi",
        "center": [54.36659, 24.46668]
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
    assert current_q_count == 3834, f"Expected 3834 existing questions, found {current_q_count}"

    # Step 0: Migrate Tieling's 1 existing photo from CN021120 to CN021130
    # and update q-3834 so CN021120 can be cleanly used for Shenyang (as in china-cities.geojson)
    tieling_old_std = os.path.join(PUBLIC_PHOTOS, "CN021120")
    tieling_old_hd = os.path.join(PUBLIC_PHOTOS_HD, "CN021120")
    tieling_new_std = os.path.join(PUBLIC_PHOTOS, "CN021130")
    tieling_new_hd = os.path.join(PUBLIC_PHOTOS_HD, "CN021130")

    os.makedirs(tieling_new_std, exist_ok=True)
    os.makedirs(tieling_new_hd, exist_ok=True)

    old_f_std = os.path.join(tieling_old_std, "001.webp")
    old_f_hd = os.path.join(tieling_old_hd, "001.webp")
    new_f_std = os.path.join(tieling_new_std, "001.webp")
    new_f_hd = os.path.join(tieling_new_hd, "001.webp")

    if os.path.exists(old_f_std) and not os.path.exists(new_f_std):
        shutil.copy2(old_f_std, new_f_std)
        os.remove(old_f_std)
        print("Migrated standard Tieling 001.webp from CN021120 to CN021130")
    if os.path.exists(old_f_hd) and not os.path.exists(new_f_hd):
        shutil.copy2(old_f_hd, new_f_hd)
        os.remove(old_f_hd)
        print("Migrated HD Tieling 001.webp from CN021120 to CN021130")

    # Update q-3834 in game_data
    for q in game_data['questions']:
        if q['id'] == 'q-3834':
            q['cityId'] = 'CN021130'
            q['photoUrl'] = '/TravelMap/game-photos/CN021130/001.webp'
            q['photoUrlHd'] = '/TravelMap/game-photos-hd/CN021130/001.webp'
            print("Updated q-3834 cityId and photoUrls to CN021130")

    # Update cities in game_data
    for c in game_data['cities']:
        if c.get('cityName') == '铁岭' or c.get('cityId') == 'CN021120':
            c['cityId'] = 'CN021130'
            print("Updated Tieling cityId to CN021130 in cities list")

    # Re-index existing cities map
    existing_cities_map = {c['cityId']: c for c in game_data.get('cities', [])}
    
    # Scan batch 8 photos
    folders = sorted(os.listdir(BASE_INPUT))
    city_photos = {cname: [] for cname in CITY_CONFIGS}
    
    for fld in folders:
        fld_path = os.path.join(BASE_INPUT, fld)
        if not os.path.isdir(fld_path): continue
        files = sorted([f for f in os.listdir(fld_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        
        for f in files:
            if (fld, f) in DISCARDED:
                print(f"Discarding duplicate photo: [{fld}] {f}")
                continue
                
            fp = os.path.join(fld_path, f)
            meta = extract_meta(fp)
            if not meta:
                print(f"ERROR: Cannot extract GPS from {fp}!")
                continue
                
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
    print(f"\nTotal valid photos collected across all targets: {total_valid} (Expected: 154)")
    assert total_valid == 154, f"Expected 154 photos, got {total_valid}"
    
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
    assert len(tasks) == 154
    assert len(new_questions) == 154
    
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
    assert len(game_data["questions"]) == 3988
    assert game_data["totalPhotos"] == 3988
    
    # Save guessGameData.json
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)
    print("Successfully updated src/data/guessGameData.json!")

if __name__ == '__main__':
    main()
