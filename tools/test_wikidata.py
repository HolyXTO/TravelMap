import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapEducational/1.0 (contact@travelmap.app)'}
sparql = """
SELECT ?item ?itemLabel ?coord ?pano WHERE {
  ?item wdt:P625 ?coord .
  ?item wdt:P4640 ?pano .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
} LIMIT 3000
"""
url = 'https://query.wikidata.org/sparql?query=' + urllib.parse.quote(sparql) + '&format=json'
req = urllib.request.Request(url, headers=HEADERS)
with urllib.request.urlopen(req) as r:
    d = json.loads(r.read())
bindings = d['results']['bindings']
print('Total results with P4640 + coords:', len(bindings))
if bindings:
    b = bindings[0]
    print('Sample:', b.get('itemLabel', {}).get('value'), b.get('coord', {}).get('value'), b.get('pano', {}).get('value'))
