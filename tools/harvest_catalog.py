# -*- coding: utf-8 -*-
"""
harvest_catalog.py
全自动从 Wikimedia Commons 抓取海量已标记 GPS 经纬度的 360° 全景街景，
构建轻量级云端流式题库索引表 streetViewCatalog.json。
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time

HEADERS = {'User-Agent': 'TravelMapEducationalApp/1.0 (contact@travelmap.app)'}

# 抓取目标分类列表 (涵盖各大洲核心国家与全球主分类)
CATEGORY_SPECS = [
    # 亚太与中国
    {"cat": "Category:Spherical_panoramics_in_China", "country": "中国", "countryCode": "CHN", "region": "asia"},
    {"cat": "Category:360°_panoramics_in_China", "country": "中国", "countryCode": "CHN", "region": "asia"},
    {"cat": "Category:Spherical_panoramics_in_Japan", "country": "日本", "countryCode": "JP", "region": "asia"},
    {"cat": "Category:360°_panoramics_in_Japan", "country": "日本", "countryCode": "JP", "region": "asia"},
    {"cat": "Category:Spherical_panoramics_in_Australia", "country": "澳大利亚", "countryCode": "AU", "region": "asia"},
    {"cat": "Category:Spherical_panoramics_in_the_Philippines", "country": "菲律宾", "countryCode": "PH", "region": "asia"},
    {"cat": "Category:Spherical_panoramics_in_Armenia", "country": "亚美尼亚", "countryCode": "AM", "region": "asia"},
    # 欧洲特辑
    {"cat": "Category:Spherical_panoramics_in_France", "country": "法国", "countryCode": "FR", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Germany", "country": "德国", "countryCode": "DE", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Italy", "country": "意大利", "countryCode": "IT", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Spain", "country": "西班牙", "countryCode": "ES", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_the_United_Kingdom", "country": "英国", "countryCode": "GB", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Switzerland", "country": "瑞士", "countryCode": "CH", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Austria", "country": "奥地利", "countryCode": "AT", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_the_Netherlands", "country": "荷兰", "countryCode": "NL", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Norway", "country": "挪威", "countryCode": "NO", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Sweden", "country": "瑞典", "countryCode": "SE", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Finland", "country": "芬兰", "countryCode": "FI", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Poland", "country": "波兰", "countryCode": "PL", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Portugal", "country": "葡萄牙", "countryCode": "PT", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Greece", "country": "希腊", "countryCode": "GR", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_the_Czech_Republic", "country": "捷克", "countryCode": "CZ", "region": "europe"},
    {"cat": "Category:Spherical_panoramics_in_Belgium", "country": "比利时", "countryCode": "BE", "region": "europe"},
    # 美洲探索
    {"cat": "Category:Spherical_panoramics_in_the_United_States", "country": "美国", "countryCode": "US", "region": "americas"},
    {"cat": "Category:Spherical_panoramics_in_Canada", "country": "加拿大", "countryCode": "CA", "region": "americas"},
    {"cat": "Category:Spherical_panoramics_in_Mexico", "country": "墨西哥", "countryCode": "MX", "region": "americas"},
    {"cat": "Category:Spherical_panoramics_in_Brazil", "country": "巴西", "countryCode": "BR", "region": "americas"},
]

def clean_city_name(title):
    name = re.sub(r'^File:', '', title)
    name = re.sub(r'\.(jpg|jpeg|png)$', '', name, flags=re.I)
    name = re.sub(r'[\(\[\{].*?[\)\]\}]', '', name)
    name = re.sub(r'360\s*(degree|deg|x180)?|panorama|panosphere|photosphere', '', name, flags=re.I)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    return name[:38] if name else "特色全景"

def run():
    out_file = "src/data/streetViewCatalog.json"
    existing = []
    seen_urls = set()
    if os.path.exists(out_file):
        try:
            with open(out_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
                for item in existing:
                    seen_urls.add(item['panoUrl'])
        except Exception:
            existing = []

    catalog = list(existing)
    print(f"Loaded {len(catalog)} existing items from {out_file}")

    for spec in CATEGORY_SPECS:
        cat = spec["cat"]
        country = spec["country"]
        cc = spec["countryCode"]
        region = spec["region"]

        url = f"https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle={urllib.parse.quote(cat)}&cmnamespace=6&cmlimit=40&format=json"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"Skip {cat}: {e}")
            continue

        members = data.get('query', {}).get('categorymembers', [])
        titles = [m['title'] for m in members if m['title'].lower().endswith(('.jpg', '.jpeg'))]
        if not titles:
            continue

        # 50 titles per batch
        for chunk_idx in range(0, len(titles), 25):
            sub_titles = titles[chunk_idx:chunk_idx+25]
            pipe_titles = '|'.join(sub_titles)
            coord_url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(pipe_titles)}&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json"
            coord_req = urllib.request.Request(coord_url, headers=HEADERS)
            try:
                with urllib.request.urlopen(coord_req, timeout=15) as resp:
                    cdata = json.loads(resp.read().decode('utf-8'))
            except Exception as e:
                print(f"Error fetching chunk: {e}")
                continue

            pages = cdata.get('query', {}).get('pages', {})
            for pid, p in pages.items():
                coords = p.get('coordinates', [{}])[0]
                lat = coords.get('lat')
                lon = coords.get('lon')
                ii = p.get('imageinfo', [{}])[0]
                thumb = ii.get('thumburl') or ii.get('url')

                if lat and lon and thumb and thumb not in seen_urls:
                    seen_urls.add(thumb)
                    clean_city = clean_city_name(p['title'])
                    item_id = f"sv_stream_{len(catalog)+1:04d}"
                    entry = {
                        "id": item_id,
                        "panoUrl": thumb,
                        "country": country,
                        "countryName": country,
                        "countryCode": cc,
                        "city": clean_city,
                        "cityName": clean_city,
                        "region": region,
                        "lat": round(lat, 5),
                        "lng": round(lon, 5),
                        "initialHeading": 0,
                        "description": f"{country} · {clean_city} 真实 360° 球面街景",
                        "source": "Wikimedia Commons Open 360° Catalog"
                    }
                    catalog.append(entry)

        print(f"Processed {country}: total catalog size = {len(catalog)}")
        time.sleep(0.3)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print(f"\nCompleted! Total {len(catalog)} 360° panorama questions in {out_file}")

if __name__ == "__main__":
    run()
