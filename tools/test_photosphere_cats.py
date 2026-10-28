import urllib.request, urllib.parse, json, time

HEADERS = {'User-Agent': 'TravelMapAcademicResearch/4.0 (educational geo-guesser; contact: research@travelmap.app)'}

test_terms = [
    'Category:Photospheres in the United States',
    'Category:Photospheres in France',
    'Category:Photospheres in China',
    'Category:Photospheres in Japan',
    'Category:Photospheres in Australia',
    'Category:360° panoramas of monuments and memorials',
    'Category:360° panoramas of churches in France',
    'Category:360° panoramas of castles in the United Kingdom',
    'Category:360° panoramas of National Parks of the United States',
    'Category:360° panoramas of temples in Japan',
]

for term in test_terms:
    url = f'https://commons.wikimedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle={urllib.parse.quote(term)}&gcmnamespace=6&gcmlimit=50&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=1920&format=json'
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        with_coords = sum(1 for p in pages.values() if p.get('coordinates'))
        print(f'{term}: total {len(pages)}, coords {with_coords}')
    except Exception as e:
        print(f'{term}: error {e}')
    time.sleep(0.5)
