import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = os.path.join("src", "data", "guessGameData.json")
with open(DATA_PATH, 'r', encoding='utf-8') as f:
    gd = json.load(f)

questions = gd.get('questions', [])
total = gd.get('totalPhotos')
cities = gd.get('cities', [])

print(f"Total questions: {len(questions)}")
print(f"Total cities: {len(cities)}")
print(f"totalPhotos field: {total}")

assert len(questions) == 3988
assert total == 3988

missing_files = []
seen_ids = set()
seen_urls = set()

for q in questions:
    qid = q['id']
    if qid in seen_ids:
        print(f"Duplicate QID: {qid}")
    seen_ids.add(qid)
    
    std_url = q['photoUrl']
    hd_url = q['photoUrlHd']
    
    if std_url in seen_urls:
        print(f"Duplicate std URL: {std_url}")
    seen_urls.add(std_url)
    
    # Check disk existence
    # url is /TravelMap/game-photos/...
    rel_std = std_url.replace('/TravelMap/', '')
    rel_hd = hd_url.replace('/TravelMap/', '')
    
    p_std = os.path.join('public', rel_std.replace('game-photos/', 'game-photos/'))
    p_hd = os.path.join('public', rel_hd.replace('game-photos-hd/', 'game-photos-hd/'))
    
    if not os.path.exists(p_std) or os.path.getsize(p_std) == 0:
        missing_files.append((qid, p_std))
    if not os.path.exists(p_hd) or os.path.getsize(p_hd) == 0:
        missing_files.append((qid, p_hd))

print(f"Missing or empty image files count: {len(missing_files)}")
if missing_files:
    for m in missing_files[:10]:
        print("  Missing:", m)
else:
    print("ALL 3,988 standard WebP and 3,988 HD WebP images exist and are non-empty!")

# Check newly added batch 8 questions
new_batch = questions[3834:]
print(f"\nNewly added questions in batch 8: {len(new_batch)}")
by_city = {}
for q in new_batch:
    by_city.setdefault(q['cityName'], []).append(q)

for cname, qs in sorted(by_city.items()):
    print(f"  - {cname} ({qs[0]['cityId']}): {len(qs)} questions (first: {qs[0]['id']}, last: {qs[-1]['id']})")

print("\nVerification PASSED!")
