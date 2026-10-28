import urllib.request, urllib.parse, json

HEADERS = {'User-Agent': 'TravelMapEducational/1.0 (contact@travelmap.app)'}
# Check classes of panoramas
sparql = """
SELECT (COUNT(?item) AS ?cnt) WHERE {
  ?item wdt:P625 ?coord .
  ?item wdt:P31 ?type .
  VALUES ?type { wd:Q3506307 wd:Q11456 wd:Q43621 }
}
"""
url = 'https://query.wikidata.org/sparql?query=' + urllib.parse.quote(sparql) + '&format=json'
req = urllib.request.Request(url, headers=HEADERS)
try:
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
    print('Panoramas by P31:', d['results']['bindings'][0]['cnt']['value'])
except Exception as e:
    print('Error:', e)
