import urllib.request, urllib.parse, json, time

HEADERS = {'User-Agent': 'TravelMapAcademicResearch/4.0 (educational geo-guesser; contact: research@travelmap.app)'}

test_queries = [
    'Bangkok 360 panorama',
    'Phuket photosphere',
    'Bali 360 panorama',
    'Singapore 360 panorama',
    'Kuala Lumpur 360 panorama',
    'Mumbai 360 panorama',
    'Delhi photosphere',
    'Dubai 360 panorama',
    'Istanbul 360 panorama',
    'Cape Town 360 panorama',
    'Cairo 360 panorama',
    'Nairobi 360 panorama',
    'Sydney 360 panorama',
    'Melbourne photosphere',
    'Auckland 360 panorama',
    'Buenos Aires 360 panorama',
    'Rio de Janeiro 360 panorama',
    'Santiago Chile 360 panorama',
    'Lima Peru 360 panorama',
    'Mexico City 360 panorama',
    'Toronto 360 panorama',
    'Vancouver photosphere',
    'Chicago 360 panorama',
    'Miami 360 panorama',
    'Seattle 360 panorama',
    'Paris photosphere',
    'Madrid 360 panorama',
    'London 360 panorama',
    'Amsterdam 360 panorama',
    'Athens 360 panorama',
    'Beijing 360 panorama',
    'Shanghai 360 panorama',
    'Guangzhou 360 panorama',
    'Shenzhen 360 panorama',
    'Chengdu 360 panorama',
    'Hangzhou 360 panorama'
]

results = []
for q in test_queries:
    url = f'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=50&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json'
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.loads(r.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        count = sum(1 for p in pages.values() if p.get('coordinates'))
        print(f'{q}: found {len(pages)} images, {count} with coordinates')
        results.append((q, count))
    except Exception as e:
        print(f'{q}: error {e}')
    time.sleep(0.3)

print("Total coord items found:", sum(c for _, c in results))
