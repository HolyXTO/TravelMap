import os
import json
import time
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps

BASE_INPUT = r'C:\Users\HolyX\Desktop\图寻照片candidate\第一批'
HD_OUTPUT = os.path.join('public', 'game-photos-hd')
DATA_PATH = os.path.join('src', 'data', 'guessGameData.json')

def process_one(task):
    in_path, out_path = task
    if os.path.exists(out_path):
        return True
    try:
        with Image.open(in_path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            max_dim = 2800
            w, h = img.size
            if max(w, h) > max_dim:
                ratio = max_dim / max(w, h)
                img = img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)
            img.save(out_path, 'WEBP', quality=85)
        return True
    except Exception as e:
        print(f"Error {in_path}: {e}")
        return False

def main():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        game_data = json.load(f)

    city_name_to_cfg = {c['cityName']: c for c in game_data['cities']}

    tasks = []
    for folder_name in sorted(os.listdir(BASE_INPUT)):
        folder_path = os.path.join(BASE_INPUT, folder_name)
        if not os.path.isdir(folder_path):
            continue
        if folder_name not in city_name_to_cfg:
            continue
        cfg = city_name_to_cfg[folder_name]
        city_out_dir = os.path.join(HD_OUTPUT, cfg['cityId'])
        os.makedirs(city_out_dir, exist_ok=True)
        
        files = sorted([f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])
        for idx, fname in enumerate(files, 1):
            in_path = os.path.join(folder_path, fname)
            out_name = f"{idx:03d}.webp"
            out_path = os.path.join(city_out_dir, out_name)
            tasks.append((in_path, out_path))

    print(f"Starting HD generation for {len(tasks)} images with multiprocessing...")
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(process_one, tasks))

    print(f"Finished {sum(results)} / {len(tasks)} images in {time.time()-t0:.2f}s!")

    # Update guessGameData.json to include photoUrlHd
    for q in game_data['questions']:
        base_url = q['photoUrl']
        hd_url = base_url.replace('/game-photos/', '/game-photos-hd/')
        q['photoUrlHd'] = hd_url

    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)

    print("Updated guessGameData.json with photoUrlHd!")

if __name__ == '__main__':
    main()
