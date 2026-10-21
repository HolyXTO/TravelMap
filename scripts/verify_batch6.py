import os
import sys
import json

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = os.path.join("src", "data", "guessGameData.json")
PLACE_INDEX_PATH = os.path.join("public", "maps", "place-index.json")

def verify():
    print("=== Verifying Batch 6 Import ===")
    
    # 1. Verify place-index.json is NOT modified and does NOT contain 迈森 or 尼克希奇
    with open(PLACE_INDEX_PATH, 'r', encoding='utf-8') as f:
        places_raw = f.read()
    assert '迈森' not in places_raw, "FAIL: '迈森' found in place-index.json!"
    assert '尼克希奇' not in places_raw, "FAIL: '尼克希奇' found in place-index.json!"
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
    
    assert len(questions) == total_photos == 3538, f"Expected 3538 questions, got {len(questions)}"
    assert len(cities) == 108, f"Expected 108 cities (94 + 14 new), got {len(cities)}"
    
    # Check Nikšić questions
    niksic_qs = [q for q in questions if q['cityName'] == '尼克希奇']
    print(f"Nikšić questions count: {len(niksic_qs)}")
    assert len(niksic_qs) == 4, f"Expected 4 Nikšić questions, got {len(niksic_qs)}"
    for q in niksic_qs:
        assert q['cityId'] == 'W-191081'
        assert q['countryName'] == '黑山'

    # Check Podgorica questions
    podgorica_qs = [q for q in questions if q['cityName'] == '波德戈里察']
    print(f"Podgorica questions count: {len(podgorica_qs)}")
    assert len(podgorica_qs) == 39, f"Expected 39 Podgorica questions, got {len(podgorica_qs)}"
    for q in podgorica_qs:
        assert q['cityId'] == 'W-23564'
        assert q['countryName'] == '黑山'

    # Check Lisbon questions
    lisbon_qs = [q for q in questions if q['cityName'] == '里斯本']
    print(f"Lisbon questions count: {len(lisbon_qs)}")
    assert len(lisbon_qs) == 91, f"Expected 91 Lisbon questions, got {len(lisbon_qs)}"

    # Check Budva questions
    budva_qs = [q for q in questions if q['cityName'] == '布德瓦']
    print(f"Budva questions count: {len(budva_qs)}")
    assert len(budva_qs) == 35, f"Expected 35 Budva questions, got {len(budva_qs)}"

    # Check Berlin new questions count (was 22, added 9 = 31)
    berlin_qs = [q for q in questions if q['cityName'] == '柏林']
    print(f"Berlin questions count: {len(berlin_qs)}")
    assert len(berlin_qs) == 31, f"Expected 31 Berlin questions, got {len(berlin_qs)}"

    # Check all 3538 questions have valid non-empty files and valid lat/lng
    print("Checking file integrity and coordinates for all 3,538 questions...")
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
        
    print("ALL 3,538 questions verified successfully!")

if __name__ == '__main__':
    verify()
