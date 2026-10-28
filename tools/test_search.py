import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapEducational/3.0 (contact@travelmap.app)'}

queries = [
    'photosphere China',
    'equirectangular Japan',
    '360 panorama Australia',
    'spherical panorama Brazil',
    'photosphere United States',
    'equirectangular Africa',
    'photosphere India',
    'equirectangular Mexico',
    '360 panorama Canada',
    'photosphere Indonesia',
    '360 panorama Thailand'
]

for q in queries:
    url = f'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=20&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=1920&format=json'
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as r:
        d = json.loads(r.read().decode('utf-8'))
    pages = d.get('query', {}).get('pages', {})
    valid = sum(1 for p in pages.values() if p.get('coordinates'))
    print(f'{q}: total {len(pages)}, with coords {valid}')
