import os
import sys
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import pillow_heif
from PIL import Image, ImageOps

sys.stdout.reconfigure(encoding='utf-8')
pillow_heif.register_heif_opener()

PLAN_PATH = r"C:\Users\HolyX\.gemini\antigravity\brain\fd8b9b72-acde-47ce-9892-ce301f47fbc2\scratch\batch11_plan.json"
DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PUBLIC_PHOTOS = os.path.join("public", "game-photos")
PUBLIC_PHOTOS_HD = os.path.join("public", "game-photos-hd")

def process_image_task(task):
    in_path, std_out_path, hd_out_path = task
    try:
        # Standard webp (1440px max)
        if not os.path.exists(std_out_path) or os.path.getsize(std_out_path) == 0:
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
        if not os.path.exists(hd_out_path) or os.path.getsize(hd_out_path) == 0:
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

def main():
    print("=== Loading plan from scratch/batch11_plan.json ===")
    with open(PLAN_PATH, 'r', encoding='utf-8') as f:
        planned_items = json.load(f)
    print(f"Total planned photos: {len(planned_items)}")
    assert len(planned_items) == 502, f"Expected 502 photos, got {len(planned_items)}"

    print("=== Loading existing guessGameData.json ===")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        game_data = json.load(f)

    existing_questions = game_data.get('questions', [])
    current_q_count = len(existing_questions)
    print(f"Current questions: {current_q_count}, current cities: {len(game_data.get('cities', []))}")
    assert current_q_count == 4365, f"Expected 4365 questions, got {current_q_count}"

    city_dict = {c['cityId']: c for c in game_data.get('cities', [])}

    # Group planned items by cityId
    from collections import defaultdict
    items_by_city = defaultdict(list)
    for it in planned_items:
        items_by_city[it['city_id']].append(it)

    tasks = []
    new_questions = []
    next_qid = current_q_count + 1

    for cid, items in sorted(items_by_city.items()):
        cfg = city_dict[cid]
        c_std_dir = os.path.join(PUBLIC_PHOTOS, cid)
        c_hd_dir = os.path.join(PUBLIC_PHOTOS_HD, cid)
        os.makedirs(c_std_dir, exist_ok=True)
        os.makedirs(c_hd_dir, exist_ok=True)

        existing_files = [f for f in os.listdir(c_std_dir) if f.endswith('.webp')]
        existing_nums = []
        for ef in existing_files:
            try:
                num = int(os.path.splitext(ef)[0])
                existing_nums.append(num)
            except Exception:
                pass
        start_idx = max(existing_nums) + 1 if existing_nums else 1
        print(f"City {cfg['cityName']} ({cid}): existing {len(existing_nums)} photos, starting from index {start_idx:03d}")

        for it in items:
            seq_str = f"{start_idx:03d}"
            std_out = os.path.join(c_std_dir, f"{seq_str}.webp")
            hd_out = os.path.join(c_hd_dir, f"{seq_str}.webp")

            tasks.append((it['source_path'], std_out, hd_out))

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
                "originalFileName": it["file_name"],
                "exactLat": it["lat"],
                "exactLng": it["lng"],
                "altitude": it["altitude"],
                "shootTime": it["shoot_time"]
            }
            new_questions.append(q_obj)
            next_qid += 1
            start_idx += 1

    print(f"\nTotal image processing tasks: {len(tasks)}")
    print(f"Total new questions prepared: {len(new_questions)}")
    assert len(tasks) == 502
    assert len(new_questions) == 502

    # Process images in parallel using ThreadPoolExecutor
    print("\nStarting multithreaded WebP conversion (standard 1440px & HD 2800px)...")
    t0 = time.time()
    success_count = 0
    with ThreadPoolExecutor(max_workers=min(os.cpu_count() or 4, 8)) as executor:
        futures = {executor.submit(process_image_task, t): t for t in tasks}
        for f in as_completed(futures):
            ok, res = f.result()
            if ok:
                success_count += 1
                if success_count % 50 == 0 or success_count == len(tasks):
                    print(f"Processed {success_count}/{len(tasks)} photos ({time.time()-t0:.1f}s)...")
            else:
                print(f"Failed task: {res}")
                sys.exit(1)

    print(f"WebP conversion complete in {time.time()-t0:.1f}s. All {success_count} photos processed successfully!")

    # Append new questions to game_data
    game_data["questions"].extend(new_questions)
    game_data["totalPhotos"] = len(game_data["questions"])

    print(f"\nFinal questions count: {len(game_data['questions'])}")
    print(f"Final cities count: {len(game_data['cities'])}")
    print(f"Total photos field: {game_data['totalPhotos']}")
    assert len(game_data["questions"]) == 4867
    assert game_data["totalPhotos"] == 4867

    # Save guessGameData.json
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)
    print("Successfully updated src/data/guessGameData.json!")

if __name__ == '__main__':
    main()
