import urllib.request, urllib.parse, json, time
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {'User-Agent': 'TravelMapEducational/1.0 (contact@travelmap.app)'}

def search_geo_panos(keyword, limit=50):
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&generator=search&gsrsearch={urllib.parse.quote(keyword)}'
        f'&gsrnamespace=6&gsrlimit={limit}'
        '&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json'
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        items = []
        for p in pages.values():
            coords = p.get('coordinates', [{}])[0]
            lat = coords.get('lat')
            lon = coords.get('lon')
            ii = p.get('imageinfo', [{}])[0]
            url_img = ii.get('thumburl') or ii.get('url')
            if lat and lon and url_img:
                items.append({
                    'title': p['title'],
                    'lat': lat,
                    'lon': lon,
                    'url': url_img
                })
        return keyword, items
    except Exception as e:
        return keyword, []

keywords = [
    'China 360 panorama', 'Beijing 360 panorama', 'Shanghai 360 panorama', 'Hong Kong 360 panorama',
    'Taiwan 360 panorama', 'Japan 360 panorama', 'Germany 360 panorama', 'France 360 panorama',
    'Italy 360 panorama', 'Spain 360 panorama', 'USA 360 panorama', 'UK 360 panorama'
]

print("Testing parallel search...")
t0 = time.time()
with ThreadPoolExecutor(max_workers=6) as ex:
    futs = [ex.submit(search_geo_panos, kw) for kw in keywords]
    total = 0
    for f in as_completed(futs):
        kw, items = f.result()
        total += len(items)
        print(f"  {kw}: {len(items)} items")
print(f"Total from 12 keywords: {total} in {time.time()-t0:.2f}s")
