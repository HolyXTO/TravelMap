import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = os.path.join("src", "data", "guessGameData.json")

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

questions = data.get('questions', [])
print(f"Total questions: {len(questions)}")
assert len(questions) == 4867

xiao_count = 0
tang_count = 0

for idx, q in enumerate(questions):
    qid_num = int(q['id'].replace('q-', ''))
    if qid_num <= 4365:
        q['author'] = 'Xiao'
        xiao_count += 1
    else:
        q['author'] = 'Tang'
        tang_count += 1

print(f"Assigned 'Xiao' to: {xiao_count} questions (q-0001 to q-4365)")
print(f"Assigned 'Tang' to: {tang_count} questions (q-4366 to q-4867)")

assert xiao_count == 4365
assert tang_count == 502

with open(DATA_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Successfully updated src/data/guessGameData.json with authors!")
