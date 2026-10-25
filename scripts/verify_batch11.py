import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = os.path.join("src", "data", "guessGameData.json")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

questions = data['questions']
cities = data['cities']
total_photos = data['totalPhotos']

print(f"Total questions in JSON: {len(questions)}")
print(f"Total photos field: {total_photos}")
print(f"Total cities: {len(cities)}")

assert len(questions) == 4867, f"Expected 4867 questions, got {len(questions)}"
assert total_photos == 4867, f"Expected 4867 totalPhotos, got {total_photos}"

ids = set()
photo_urls = set()
hd_urls = set()
missing_std = []
missing_hd = []
zero_coords = []
missing_fields = []

for q in questions:
    qid = q['id']
    if qid in ids:
        print(f"Duplicate question ID: {qid}")
    ids.add(qid)

    std_rel = q['photoUrl'].replace('/TravelMap/', '')
    hd_rel = q['photoUrlHd'].replace('/TravelMap/', '')

    std_path = os.path.join('public', std_rel.replace('/', os.sep))
    hd_path = os.path.join('public', hd_rel.replace('/', os.sep))

    if not os.path.exists(std_path) or os.path.getsize(std_path) == 0:
        missing_std.append((qid, std_path))
    if not os.path.exists(hd_path) or os.path.getsize(hd_path) == 0:
        missing_hd.append((qid, hd_path))

    photo_urls.add(q['photoUrl'])
    hd_urls.add(q['photoUrlHd'])

    lat = q.get('exactLat')
    lng = q.get('exactLng')
    if lat is None or lng is None or (lat == 0.0 and lng == 0.0):
        zero_coords.append((qid, lat, lng))

    required_keys = ['id', 'photoUrl', 'photoUrlHd', 'cityId', 'cityName', 'fullCityName', 'countryName', 'countryCode', 'center', 'exactLat', 'exactLng']
    for k in required_keys:
        if k not in q or q[k] is None:
            missing_fields.append((qid, k))

print(f"Unique question IDs: {len(ids)}")
print(f"Unique std URLs: {len(photo_urls)}")
print(f"Unique HD URLs: {len(hd_urls)}")
print(f"Missing std webp files: {len(missing_std)}")
print(f"Missing HD webp files: {len(missing_hd)}")
print(f"Zero / invalid coords: {len(zero_coords)}")
print(f"Missing fields: {len(missing_fields)}")

assert len(missing_std) == 0, f"Found missing std webps: {missing_std[:5]}"
assert len(missing_hd) == 0, f"Found missing HD webps: {missing_hd[:5]}"
assert len(zero_coords) == 0, f"Found invalid coords: {zero_coords[:5]}"
assert len(missing_fields) == 0, f"Found missing fields: {missing_fields[:5]}"
assert len(ids) == 4867
assert len(photo_urls) == 4867
assert len(hd_urls) == 4867

print("\n【VERIFICATION PASSED】All 4867 questions, standard WebP files, and HD WebP files are completely valid!")
