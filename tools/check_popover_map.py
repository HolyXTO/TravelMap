import json, re

with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

with open('src/QuestionBankStatsPopover.jsx', 'r', encoding='utf-8') as f:
    popover_code = f.read()

m = re.search(r'const COUNTRY_TO_CONTINENT = \{(.*?)\};', popover_code, re.DOTALL)
block = m.group(1)
keys = set(re.findall(r'"([^"]+)":', block))

missing = set(it['country'] for it in catalog if it.get('country') not in keys)
with open('tools/missing_countries.txt', 'w', encoding='utf-8') as f:
    for c in missing:
        f.write(c + '\n')
print("Wrote missing countries to file.")
