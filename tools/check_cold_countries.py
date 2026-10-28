import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapAcademicGeography/5.5'}

def check(q):
    url = f'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(q)}&srnamespace=6&srlimit=20&format=json'
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode('utf-8'))
        items = d.get('query', {}).get('search', [])
        print(f'{q}: {len(items)} hits')
    except Exception as e:
        print(f'{q}: {e}')

check('Vilnius 360')
check('Lithuania panorama')
check('Sofia 360')
check('Bulgaria panorama')
check('Belgrade panorama')
check('Ljubljana panorama')
check('Bratislava panorama')
check('Zagreb panorama')
check('Dubrovnik panorama')
check('Tallinn panorama')
check('Riga panorama')
check('Helsinki panorama')
check('Oslo panorama')
check('Copenhagen panorama')
check('Budapest panorama')
