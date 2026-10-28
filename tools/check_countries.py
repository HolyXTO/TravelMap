import json

with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

countries = {}
for it in data:
    c = it['country']
    countries[c] = countries.get(c, 0) + 1

with open('tools/countries_report.txt', 'w', encoding='utf-8') as out:
    for c, cnt in sorted(countries.items(), key=lambda x: -x[1]):
        out.write(f"{cnt:4d}: {c}\n")

print("Report written to tools/countries_report.txt")
