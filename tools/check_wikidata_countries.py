import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapEducational/1.0 (contact@travelmap.app)'}
sparql = """
SELECT ?item ?itemLabel ?coord ?pano ?countryLabel WHERE {
  ?item wdt:P625 ?coord .
  ?item wdt:P4640 ?pano .
  OPTIONAL { ?item wdt:P17 ?country . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
} LIMIT 3000
"""
url = 'https://query.wikidata.org/sparql?query=' + urllib.parse.quote(sparql) + '&format=json'
req = urllib.request.Request(url, headers=HEADERS)
with urllib.request.urlopen(req) as r:
    d = json.loads(r.read())
bindings = d['results']['bindings']
print('Total Wikidata results:', len(bindings))
countries = {}
for b in bindings:
    c = b.get('countryLabel', {}).get('value', 'Unknown')
    countries[c] = countries.get(c, 0) + 1

# Sort countries
for c, cnt in sorted(countries.items(), key=lambda x: -x[1])[:20]:
    print(f"  {c.encode('ascii', 'replace').decode()}: {cnt}")
