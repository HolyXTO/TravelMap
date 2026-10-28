import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapEducational/1.0 (contact@travelmap.app)'}
sparql = """
SELECT (COUNT(?file) AS ?cnt) WHERE {
  ?file wdt:P625 ?coord .
}
"""
url = 'https://commons-query.wikimedia.org/sparql?query=' + urllib.parse.quote(sparql) + '&format=json'
req = urllib.request.Request(url, headers=HEADERS)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    print('WCQS count:', d['results']['bindings'][0]['cnt']['value'])
except Exception as e:
    print('WCQS error:', e)
