import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Load visits from mockData.js
with open('src/data/mockData.js', 'r', encoding='utf-8') as f:
    mock_content = f.read()

m = re.search(r'export const initialVisits = (\[.*?\]);', mock_content, re.DOTALL)
visits = json.loads(m.group(1)) if m else []
visited_place_ids = sorted(list(set(v['placeId'] for v in visits)))
print(f"Total unique visited placeIds: {len(visited_place_ids)}")

# 2. Load map datasets
with open('public/maps/china-cities.geojson', 'r', encoding='utf-8') as f:
    china_cities = json.load(f)
china_city_ids = {feat['properties']['id']: feat['properties'] for feat in china_cities['features']}

with open('public/maps/states.geojson', 'r', encoding='utf-8') as f:
    states = json.load(f)
state_ids = {feat['properties']['id']: feat['properties'] for feat in states['features']}

with open('public/maps/countries.geojson', 'r', encoding='utf-8') as f:
    countries = json.load(f)
country_ids = {feat['properties']['id']: feat['properties'] for feat in countries['features']}

with open('public/maps/place-index.json', 'r', encoding='utf-8') as f:
    place_index = json.load(f)
place_index_ids = {p['id']: p for p in place_index}

# 3. Load SUPPLEMENTAL_PLACES from App.jsx
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    app_jsx = f.read()

supp_match = re.search(r'const SUPPLEMENTAL_PLACES = (\[.*?\]);', app_jsx, re.DOTALL)
supplemental_places = []
if supp_match:
    # Use python parsing or regex
    supp_ids = re.findall(r'id:\s*["\']([^"\']+)["\']', supp_match.group(1))
    supp_id_set = set(supp_ids)
else:
    supp_id_set = set()

# Now check each visited place
results = {
    'china_city_polygon': [],
    'foreign_city_point': [],
    'country_level_visit': [],
    'state_level_visit': [],
    'supplemental': [],
    'missing': []
}

for pid in visited_place_ids:
    if pid in china_city_ids:
        cname = china_city_ids[pid].get('name') or china_city_ids[pid].get('localName')
        results['china_city_polygon'].append((pid, cname))
    elif pid in supp_id_set:
        results['supplemental'].append(pid)
    elif pid in place_index_ids:
        p = place_index_ids[pid]
        pname = p.get('localName') or p.get('name')
        lvl = p.get('level')
        cname = p.get('countryName')
        if lvl == 'country':
            results['country_level_visit'].append((pid, pname))
        elif lvl == 'region':
            results['state_level_visit'].append((pid, pname))
        else:
            results['foreign_city_point'].append((pid, pname, cname))
    elif pid in country_ids:
        cname = country_ids[pid].get('name') or country_ids[pid].get('localName')
        results['country_level_visit'].append((pid, cname))
    elif pid in state_ids:
        sname = state_ids[pid].get('name') or state_ids[pid].get('localName')
        results['state_level_visit'].append((pid, sname))
    else:
        results['missing'].append(pid)

print(f"1. In China cities (with polygon boundary): {len(results['china_city_polygon'])}")
print(f"2. In foreign cities (with point center coordinates): {len(results['foreign_city_point'])}")
print(f"3. In supplemental places: {len(results['supplemental'])}")
print(f"4. In country level: {len(results['country_level_visit'])}")
print(f"5. In state/region level: {len(results['state_level_visit'])}")
print(f"6. Missing completely: {len(results['missing'])}")

if results['missing']:
    print('Missing IDs:', results['missing'])

# Also check photo folders against visited places
print("\n--- Checking Photo Candidate Folders ---")
with open('scratch_photos.json', 'r', encoding='utf-8') as f:
    photo_folders = json.load(f)

for item in photo_folders:
    name = item['folder']
    # search name in china cities
    match_china = [pid for pid, props in china_city_ids.items() if name in props.get('name', '') or name in props.get('localName', '')]
    match_place = [p for p in place_index if name == p.get('localName') or name == p.get('name') or name in p.get('aliases', [])]
    
    status = []
    if match_china:
        status.append(f"China City Polygon ({match_china[0]})")
    elif match_place:
        p = match_place[0]
        status.append(f"Place Index ({p.get('id')}, {p.get('level')}, {p.get('countryName')})")
    else:
        status.append("NOT FOUND")
    print(f"Photo city [{name}]: {', '.join(status)}")
