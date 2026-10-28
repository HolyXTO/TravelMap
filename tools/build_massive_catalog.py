# -*- coding: utf-8 -*-
"""
build_massive_catalog.py
全自动多线程构建海量 360° 全景街景题库：
从 Wikimedia Commons 官方 150 万全景库中并发检索并萃取具有真实 GPS 坐标的 360° 球面全景，
分类归一化为【国内】与【国外】，写入 streetViewCatalog.json。
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {'User-Agent': 'TravelMapEducationalApp/1.0 (contact@travelmap.app)'}

def clean_city_name(title):
    name = re.sub(r'^File:', '', title)
    name = re.sub(r'\.(jpg|jpeg|png)$', '', name, flags=re.I)
    name = re.sub(r'[\(\[\{].*?[\)\]\}]', '', name)
    name = re.sub(r'360\s*(degree|deg|x180)?|panorama|panosphere|photosphere', '', name, flags=re.I)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    return name[:38] if name else "特色全景"

def is_china(lat, lon, title, cat_name):
    # 判断是否属于中国国内（大陆、香港、澳门、台湾）
    lower_str = (title + " " + cat_name).lower()
    if any(k in lower_str for k in ['china', 'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hong kong', 'taiwan', 'taipei', 'scut', 'qinghai', 'hailar', 'tianjin', 'nanjing', 'chengdu', 'chongqing', 'wuhan', 'hangzhou', 'xi\'an', 'xian', 'dali', 'tibet', 'xinjiang']):
        return True
    if 18.0 <= lat <= 53.6 and 73.5 <= lon <= 135.1:
        # 排除日本/韩国等周边邻国
        if not any(k in lower_str for k in ['japan', 'tokyo', 'korea', 'seoul', 'osaka', 'kyoto', 'fukuoka', 'hokkaido', 'mongolia', 'ulaanbaatar']):
            return True
    return False

def get_country_from_cat(cat_title, lat, lon):
    c_lower = cat_title.lower()
    if 'china' in c_lower or 'hong kong' in c_lower or 'taiwan' in c_lower:
        return '中国', 'CHN'
    if 'japan' in c_lower: return '日本', 'JP'
    if 'united states' in c_lower or 'usa' in c_lower: return '美国', 'US'
    if 'france' in c_lower: return '法国', 'FR'
    if 'germany' in c_lower: return '德国', 'DE'
    if 'italy' in c_lower: return '意大利', 'IT'
    if 'spain' in c_lower: return '西班牙', 'ES'
    if 'united kingdom' in c_lower or 'england' in c_lower: return '英国', 'GB'
    if 'australia' in c_lower: return '澳大利亚', 'AU'
    if 'canada' in c_lower: return '加拿大', 'CA'
    if 'switzerland' in c_lower: return '瑞士', 'CH'
    if 'austria' in c_lower: return '奥地利', 'AT'
    if 'netherlands' in c_lower: return '荷兰', 'NL'
    if 'russia' in c_lower: return '俄罗斯', 'RU'
    if 'norway' in c_lower: return '挪威', 'NO'
    if 'sweden' in c_lower: return '瑞典', 'SE'
    if 'finland' in c_lower: return '芬兰', 'FI'
    if 'poland' in c_lower: return '波兰', 'PL'
    if 'greece' in c_lower: return '希腊', 'GR'
    if 'czech' in c_lower: return '捷克', 'CZ'
    if 'belgium' in c_lower: return '比利时', 'BE'
    if 'brazil' in c_lower: return '巴西', 'BR'
    if 'mexico' in c_lower: return '墨西哥', 'MX'
    if 'south korea' in c_lower: return '韩国', 'KR'
    if 'new zealand' in c_lower: return '新西兰', 'NZ'
    if is_china(lat, lon, "", cat_title): return '中国', 'CHN'
    return '海外地标', 'INTL'

def fetch_category_files(cat_title):
    try:
        url = f"https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle={urllib.parse.quote(cat_title)}&cmnamespace=6&cmlimit=500&format=json"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        files = [m['title'] for m in data.get('query', {}).get('categorymembers', []) if m['title'].lower().endswith(('.jpg', '.jpeg'))]
        return cat_title, files
    except Exception:
        return cat_title, []

def fetch_search_files(query_str):
    try:
        url = f"https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(query_str)}&srnamespace=6&srlimit=100&format=json"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        files = [s['title'] for s in data.get('query', {}).get('search', []) if s['title'].lower().endswith(('.jpg', '.jpeg'))]
        return query_str, files
    except Exception:
        return query_str, []

def fetch_coords_and_thumbs(titles_chunk):
    pipe = '|'.join(titles_chunk)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(pipe)}&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        return data.get('query', {}).get('pages', {})
    except Exception:
        return {}

def main():
    print("=== Starting Massive 360 Panorama Harvester ===")

    # 1. 获取 51 个国家分类
    subcat_url = "https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:360%C2%B0_panoramas_by_country&cmlimit=100&format=json"
    req = urllib.request.Request(subcat_url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        subcat_data = json.loads(resp.read().decode('utf-8'))
    country_cats = [m['title'] for m in subcat_data['query']['categorymembers']]

    # 加上中国专项搜索词，确保国内题目数量充沛
    search_queries = [
        "China 360 panorama", "Shanghai 360 panorama", "Beijing 360 panorama",
        "Hong Kong 360 panorama", "Taiwan 360 panorama", "Guangzhou 360 photosphere",
        "Shenzhen 360 panorama", "Qinghai 360 panorama", "Chengdu 360 panorama",
        "Hangzhou 360 panorama", "Xi'an 360 panorama", "Great Wall 360 panorama"
    ]

    all_file_sources = {} # file_title -> source_cat

    # 2. 并发拉取分类文件列表
    print(f"Fetching file lists across {len(country_cats)} country categories...")
    with ThreadPoolExecutor(max_workers=12) as executor:
        cat_futures = [executor.submit(fetch_category_files, cat) for cat in country_cats]
        for f in as_completed(cat_futures):
            cat_name, files = f.result()
            for fl in files:
                all_file_sources[fl] = cat_name

    print(f"Fetching file lists for {len(search_queries)} China search queries...")
    with ThreadPoolExecutor(max_workers=6) as executor:
        search_futures = [executor.submit(fetch_search_files, q) for q in search_queries]
        for f in as_completed(search_futures):
            q_name, files = f.result()
            for fl in files:
                if fl not in all_file_sources:
                    all_file_sources[fl] = "China Search: " + q_name

    unique_files = list(all_file_sources.keys())
    print(f"Total unique 360 candidate files gathered: {len(unique_files)}")

    # 3. 分块（每批 40 个）并发获取 GPS 坐标与 4K CDN 缩略图
    chunks = [unique_files[i:i+40] for i in range(0, len(unique_files), 40)]
    print(f"Querying GPS coordinates and 4K thumbs in {len(chunks)} parallel batches...")

    valid_catalog = []
    seen_urls = set()

    with ThreadPoolExecutor(max_workers=10) as executor:
        chunk_futures = [executor.submit(fetch_coords_and_thumbs, chunk) for chunk in chunks]
        for f in as_completed(chunk_futures):
            pages = f.result()
            for pid, p in pages.items():
                coords = p.get('coordinates', [{}])[0]
                lat = coords.get('lat')
                lon = coords.get('lon')
                ii = p.get('imageinfo', [{}])[0]
                thumb = ii.get('thumburl') or ii.get('url')

                if lat and lon and thumb and thumb not in seen_urls:
                    seen_urls.add(thumb)
                    title = p['title']
                    src_cat = all_file_sources.get(title, "")
                    is_cn = is_china(lat, lon, title, src_cat)
                    c_name, c_code = get_country_from_cat(src_cat, lat, lon)
                    if is_cn:
                        c_name = "中国"
                        c_code = "CHN"

                    clean_city = clean_city_name(title)
                    item_id = f"sv_stream_{len(valid_catalog)+1:05d}"
                    entry = {
                        "id": item_id,
                        "panoUrl": thumb,
                        "country": c_name,
                        "countryName": c_name,
                        "countryCode": c_code,
                        "city": clean_city,
                        "cityName": clean_city,
                        "region": "domestic" if is_cn else "international",
                        "isDomestic": is_cn,
                        "lat": round(lat, 5),
                        "lng": round(lon, 5),
                        "initialHeading": 0,
                        "description": f"{c_name} · {clean_city} 真实 360° 球面街景",
                        "source": "Wikimedia Commons Open 360° Catalog"
                    }
                    valid_catalog.append(entry)

    # 4. 排序：国内排在前部，方便优先抽调，整体按 ID 索引
    domestic_items = [it for it in valid_catalog if it["isDomestic"]]
    intl_items = [it for it in valid_catalog if not it["isDomestic"]]
    final_catalog = domestic_items + intl_items

    # 重新编排标准 ID
    for idx, it in enumerate(final_catalog):
        it["id"] = f"sv_stream_{idx+1:05d}"

    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)

    print(f"\n==========================================")
    print(f"SUCCESS: Generated {len(final_catalog)} 360° street view questions!")
    print(f"  - 国内 (中国): {len(domestic_items)} 题")
    print(f"  - 国外 (国际): {len(intl_items)} 题")
    print(f"  - 全球总计:   {len(final_catalog)} 题")
    print(f"  - 索引文件大小: {os.path.getsize(out_file) / 1024:.1f} KB")
    print(f"==========================================")

if __name__ == "__main__":
    main()
