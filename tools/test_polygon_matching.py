import urllib.request, json
from shapely.geometry import shape, Point

# Load Natural Earth GeoJSON
url = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson'
req = urllib.request.Request(url, headers={'User-Agent': 'TravelMap/1.0'})
with urllib.request.urlopen(req) as r:
    ne_data = json.loads(r.read())

features = ne_data['features']
shapes = []
for f in features:
    props = f['properties']
    geom = shape(f['geometry'])
    shapes.append({
        'name': props['name'],
        'iso_a2': props['iso_a2'],
        'iso_a3': props.get('iso_a3', ''),
        'geom': geom
    })

# Load catalog
with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

matched = 0
unmatched = []

for it in catalog:
    pt = Point(it['lng'], it['lat'])
    found = False
    for s in shapes:
        if s['geom'].contains(pt):
            found = True
            matched += 1
            break
    if not found:
        # Check within a small buffer (for coastal / island points e.g. beaches, docks, islands)
        for s in shapes:
            if s['geom'].distance(pt) < 0.2: # ~20km buffer for coastal points
                found = True
                matched += 1
                break
    if not found:
        unmatched.append((it['id'], it['city'], it['lat'], it['lng']))

print(f"Total: {len(catalog)}")
print(f"Matched with Natural Earth: {matched}")
print(f"Unmatched: {len(unmatched)}")
for u in unmatched[:10]:
    print("  Unmatched:", u)
