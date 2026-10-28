import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapAcademicGeography/5.2'}

def test_q(q):
    url = f'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(q)}&srnamespace=6&srlimit=50&format=json'
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode('utf-8'))
        items = d.get('query', {}).get('search', [])
        print(f'{q}: {len(items)} files')
    except Exception as e:
        print(f'{q}: error {e}')

test_q('photosphere Australia')
test_q('photosphere South Africa')
test_q('photosphere Brazil')
test_q('photosphere Argentina')
test_q('panorama 360 Brasil')
test_q('panorama 360 Maroc')
test_q('Bruxelles 360')
test_q('Suomi 360')
test_q('Norge 360')
test_q('Hrvatska 360')
test_q('Lietuva 360')
test_q('Latvija 360')
test_q('Eesti 360')
test_q('Praha 360')
test_q('Warszawa 360')
test_q('Danmark 360')
test_q('Budapest 360')
