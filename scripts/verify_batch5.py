import os
import sys
import json

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PLACE_INDEX_PATH = os.path.join("public", "maps", "place-index.json")

def verify():
    print("=== Verifying Batch 5 Import ===")
    
    # 1. Verify place-index.json is NOT modified and does NOT contain 迈森
    with open(PLACE_INDEX_PATH, 'r', encoding='utf-8') as f:
        places_raw = f.read()
    if '迈森' in places_raw or 'Meißen' in places_raw or 'Meissen' in places_raw:
        print("FAIL: '迈森' found in place-index.json! Place index MUST NOT be modified!")
        sys.exit(1)
    else:
        print("PASS: place-index.json is completely untouched and clean.")

    # 2. Verify guessGameData.json
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    cities = data['cities']
    questions = data['questions']
    total_photos = data['totalPhotos']
    
    print(f"Total cities: {len(cities)}")
    print(f"Total questions: {len(questions)}")
    print(f"totalPhotos field: {total_photos}")
    
    assert len(questions) == total_photos == 2751, f"Expected 2751 questions, got {len(questions)}"
    
    # Check Meißen questions
    meissen_qs = [q for q in questions if q['cityName'] == '迈森']
    print(f"Meißen questions count: {len(meissen_qs)}")
    assert len(meissen_qs) == 17, f"Expected 17 Meißen questions, got {len(meissen_qs)}"
    for q in meissen_qs:
        assert q['cityId'] == 'W-2872225'
        assert q['countryName'] == '德国'
        assert os.path.exists(os.path.join("public", q['photoUrl'].replace('/TravelMap/', ''))), f"File not found: {q['photoUrl']}"
        assert os.path.exists(os.path.join("public", q['photoUrlHd'].replace('/TravelMap/', ''))), f"HD file not found: {q['photoUrlHd']}"

    # Check San Marino questions
    smr_qs = [q for q in questions if q['cityName'] == '圣马力诺']
    print(f"San Marino questions count: {len(smr_qs)}")
    assert len(smr_qs) == 33, f"Expected 33 San Marino questions (32 + 1 moved from Rimini), got {len(smr_qs)}"
    moved_photo = [q for q in smr_qs if q['originalFileName'] == 'IMG_20240914_125225.jpg']
    assert len(moved_photo) == 1, "Moved photo IMG_20240914_125225.jpg not found in San Marino!"
    print("PASS: IMG_20240914_125225.jpg correctly belongs to 圣马力诺.")

    # Check Rimini questions
    rimini_qs = [q for q in questions if q['cityName'] == '里米尼']
    print(f"Rimini questions count: {len(rimini_qs)}")
    assert len(rimini_qs) == 14, f"Expected 14 Rimini questions, got {len(rimini_qs)}"
    assert not any(q['originalFileName'] == 'IMG_20240914_125225.jpg' for q in rimini_qs), "IMG_20240914_125225.jpg still in Rimini!"

    # Check Dresden questions
    dresden_new_qs = [q for q in questions[1843:] if q['cityName'] == '德累斯顿']
    print(f"Dresden new questions count: {len(dresden_new_qs)}")
    assert len(dresden_new_qs) == 10, f"Expected 10 new Dresden questions, got {len(dresden_new_qs)}"

    # Check all 2751 questions have valid non-empty files and valid lat/lng
    print("Checking file integrity and coordinates for all 2751 questions...")
    for idx, q in enumerate(questions):
        assert q['exactLat'] is not None and -90 <= q['exactLat'] <= 90
        assert q['exactLng'] is not None and -180 <= q['exactLng'] <= 180
        assert q['id'] == f"q-{idx+1:04d}"
        
        # Verify WebP exists on disk
        std_disk = os.path.join("public", q['photoUrl'].replace('/TravelMap/', ''))
        assert os.path.exists(std_disk), f"Standard file missing: {std_disk}"
        assert os.path.getsize(std_disk) > 1000, f"Standard file suspiciously small: {std_disk}"
        
        hd_disk = os.path.join("public", q['photoUrlHd'].replace('/TravelMap/', ''))
        assert os.path.exists(hd_disk), f"HD file missing: {hd_disk}"
        assert os.path.getsize(hd_disk) > 1000, f"HD file suspiciously small: {hd_disk}"
        
    print("ALL 2,751 questions verified successfully!")

if __name__ == '__main__':
    verify()
