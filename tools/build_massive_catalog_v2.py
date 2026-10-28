# -*- coding: utf-8 -*-
"""
build_massive_catalog_v2.py
全自动并发构建千题级/万题级 360° 全景街景题库：
1. 抓取 Wikidata P4640 (具有精确 GPS + 360° 全景的全球地标)
2. 深度抓取 Wikimedia Commons 51 个国家全景分类中的文件
3. 并发检索中国各省市中英文关键字 (全景 360 / photosphere / equirectangular)
4. 并发检索全球主要国家与地标
5. 自动去重并解析 4K CDN 缩略图与真实 GPS 坐标
6. 归一化分类为【国内 (中国)】与【国外 (国际)】，生成 streetViewCatalog.json
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS = {'User-Agent': 'TravelMapEducationalApp/2.0 (contact@travelmap.app; https://github.com/travelmap)'}

def clean_city_name(title):
    name = re.sub(r'^(File:|Image:)', '', title, flags=re.I)
    name = re.sub(r'\.(jpg|jpeg|png)$', '', name, flags=re.I)
    name = re.sub(r'[\(\[\{].*?[\)\]\}]', '', name)
    name = re.sub(r'360\s*(degree|deg|x180)?|panorama|panosphere|photosphere|equirectangular|全景图?|球面', '', name, flags=re.I)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    name = re.sub(r'\s+', ' ', name)
    return name[:38] if name else "特色全景地标"

def is_china(lat, lon, title="", country=""):
    combined = (title + " " + country).lower()
    china_keywords = [
        'china', 'chinese', 'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hong kong',
        'hongkong', 'taiwan', 'taipei', 'scut', 'qinghai', 'hailar', 'tianjin', 'nanjing',
        'chengdu', 'chongqing', 'wuhan', 'hangzhou', 'xi\'an', 'xian', 'dali', 'tibet',
        'xinjiang', 'suzhou', 'guilin', 'hainan', 'yunnan', 'sichuan', 'guangdong', 'fujian',
        'zhejiang', 'jiangsu', 'shandong', 'hunan', 'hubei', 'anhui', 'henan', 'hebei',
        'shanxi', 'shaanxi', 'heilongjiang', 'jilin', 'liaoning', 'gansu', 'ningxia',
        'inner mongolia', 'neimenggu', 'macau', 'macao', 'kaohsiung', 'taichung', 'tainan',
        '中国', '北京', '上海', '广州', '深圳', '香港', '澳门', '台湾', '台北', '成都', '重庆',
        '杭州', '武汉', '西安', '南京', '天津', '苏州', '厦门', '青海', '西藏', '新疆', '云南',
        '桂林', '长城', '故宫', '颐和园', '西湖', '九寨沟', '黄山', '张家界', '华南理工'
    ]
    if any(k in combined for k in china_keywords):
        return True
    
    # 地理经纬度范围判定 (中国陆地与近海)
    if 18.0 <= lat <= 53.6 and 73.5 <= lon <= 135.1:
        neighbor_kws = ['japan', 'tokyo', 'korea', 'seoul', 'osaka', 'kyoto', 'fukuoka', 
                        'mongolia', 'ulaanbaatar', 'vietnam', 'hanoi', 'laos', 'myanmar', 
                        'india', 'nepal', 'bhutan', 'russia', 'vladivostok', 'kazakhstan',
                        'kyrgyzstan', 'tajikistan', 'pakistan', 'afghanistan', 'philippines', 'manila']
        if not any(k in combined for k in neighbor_kws):
            if lat < 21.0 and lon > 121.5: return False
            if lat > 45.0 and lon < 85.0: return False
            if lat > 50.0: return False
            if lon < 75.0: return False
            return True
    return False

def get_country_info(title, country_str, lat, lon):
    c_lower = (country_str + " " + title).lower()
    
    if is_china(lat, lon, title, country_str):
        return "中国", "CHN"
    
    country_mappings = [
        (['japan', 'tokyo', 'osaka', 'kyoto', '日本', '东京'], '日本', 'JP'),
        (['united states', 'usa', 'america', 'california', 'new york', 'florida', 'texas', '美国', '纽约'], '美国', 'US'),
        (['france', 'paris', 'lyon', 'marseille', '法国', '巴黎'], '法国', 'FR'),
        (['germany', 'deutschland', 'berlin', 'munich', 'hamburg', 'frankfurt', '德国', '柏林'], '德国', 'DE'),
        (['italy', 'italia', 'rome', 'roma', 'milan', 'venice', 'florence', '意大利', '罗马'], '意大利', 'IT'),
        (['spain', 'españa', 'madrid', 'barcelona', 'seville', 'valencia', '西班牙', '马德里'], '西班牙', 'ES'),
        (['united kingdom', 'uk', 'england', 'london', 'scotland', 'edinburgh', '英国', '伦敦'], '英国', 'GB'),
        (['australia', 'sydney', 'melbourne', 'queensland', '澳大利亚', '悉尼'], '澳大利亚', 'AU'),
        (['canada', 'toronto', 'vancouver', 'montreal', 'quebec', '加拿大', '多伦多'], '加拿大', 'CA'),
        (['switzerland', 'schweiz', 'suisse', 'zurich', 'geneva', '瑞士', '苏黎世'], '瑞士', 'CH'),
        (['austria', 'österreich', 'vienna', 'wien', 'salzburg', '奥地利', '维也纳'], '奥地利', 'AT'),
        (['netherlands', 'nederland', 'amsterdam', 'rotterdam', '荷兰', '阿姆斯特丹'], '荷兰', 'NL'),
        (['russia', 'moscow', 'saint petersburg', '俄罗斯', '莫斯科'], '俄罗斯', 'RU'),
        (['norway', 'norge', 'oslo', 'bergen', '挪威'], '挪威', 'NO'),
        (['sweden', 'sverige', 'stockholm', '瑞典'], '瑞典', 'SE'),
        (['finland', 'suomi', 'helsinki', '芬兰'], '芬兰', 'FI'),
        (['poland', 'polska', 'warsaw', 'krakow', '波兰'], '波兰', 'PL'),
        (['greece', 'athens', '希腊', '雅典'], '希腊', 'GR'),
        (['czech', 'prague', 'praha', '捷克', '布拉格'], '捷克', 'CZ'),
        (['belgium', 'brussels', '比利时', '布鲁塞尔'], '比利时', 'BE'),
        (['brazil', 'brasil', 'rio', 'sao paulo', '巴西'], '巴西', 'BR'),
        (['mexico', 'mexico city', '墨西哥'], '墨西哥', 'MX'),
        (['south korea', 'korea', 'seoul', 'busan', '韩国', '首尔'], '韩国', 'KR'),
        (['new zealand', 'auckland', 'wellington', '新西兰'], '新西兰', 'NZ'),
        (['turkey', 'türkiye', 'istanbul', 'ankara', '土耳其', '伊斯坦布尔'], '土耳其', 'TR'),
        (['singapore', '新加坡'], '新加坡', 'SG'),
        (['thailand', 'bangkok', '泰国', '曼谷'], '泰国', 'TH'),
        (['malaysia', 'kuala lumpur', '马来西亚'], '马来西亚', 'MY'),
        (['indonesia', 'bali', 'jakarta', '印度尼西亚', '巴厘岛'], '印度尼西亚', 'ID'),
        (['vietnam', 'hanoi', 'ho chi minh', '越南'], '越南', 'VN'),
        (['ireland', 'dublin', '爱尔兰'], '爱尔兰', 'IE'),
        (['portugal', 'lisbon', 'porto', '葡萄牙', '里斯本'], '葡萄牙', 'PT'),
        (['denmark', 'copenhagen', '丹麦', '哥本哈根'], '丹麦', 'DK'),
        (['argentina', 'buenos aires', '阿根廷'], '阿根廷', 'AR'),
        (['chile', 'santiago', '智利'], '智利', 'CL'),
        (['egypt', 'cairo', '埃及', '开罗'], '埃及', 'EG'),
        (['south africa', 'cape town', '南非'], '南非', 'ZA'),
        (['india', 'delhi', 'mumbai', '印度'], '印度', 'IN'),
    ]
    
    for keywords, cname, ccode in country_mappings:
        if any(k in c_lower for k in keywords):
            return cname, ccode
            
    return country_str if country_str and country_str != "Unknown" else "海外名胜", "INTL"

def fetch_wikidata_panoramas():
    print("-> Querying Wikidata P4640 (panoramic photospheres with coordinates)...", flush=True)
    sparql = """
    SELECT ?item ?itemLabel ?coord ?pano ?countryLabel WHERE {
      ?item wdt:P625 ?coord .
      ?item wdt:P4640 ?pano .
      OPTIONAL { ?item wdt:P17 ?country . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
    } LIMIT 3000
    """
    url = 'https://query.wikidata.org/sparql?query=' + urllib.parse.quote(sparql) + '&format=json'
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode('utf-8'))
        bindings = d.get('results', {}).get('bindings', [])
        print(f"   Wikidata returned {len(bindings)} panoramic items!", flush=True)
        
        items = []
        for b in bindings:
            coord_str = b.get('coord', {}).get('value', '')
            m = re.search(r'Point\(([\d\.\-]+)\s+([\d\.\-]+)\)', coord_str)
            if not m: continue
            lon = float(m.group(1))
            lat = float(m.group(2))
            
            pano_url = b.get('pano', {}).get('value', '')
            if not pano_url: continue
            
            filename = pano_url.split('/')[-1]
            filename = urllib.parse.unquote(filename)
            
            item_label = b.get('itemLabel', {}).get('value', '')
            country_label = b.get('countryLabel', {}).get('value', '')
            
            items.append({
                'title': f"File:{filename}",
                'lat': lat,
                'lon': lon,
                'label': item_label,
                'country': country_label,
                'raw_url': pano_url
            })
        return items
    except Exception as e:
        print(f"   Wikidata query error: {e}", flush=True)
        return []

def resolve_thumbs_batch(items_chunk):
    titles = '|'.join([it['title'] for it in items_chunk])
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&titles={urllib.parse.quote(titles)}'
        '&prop=imageinfo&iiprop=url&iiurlwidth=3840&format=json'
    )
    res = []
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        title_to_thumb = {}
        for p in pages.values():
            t = p.get('title', '')
            ii = p.get('imageinfo', [{}])[0]
            thumb = ii.get('thumburl') or ii.get('url')
            if thumb:
                title_to_thumb[t.lower()] = thumb
                
        for it in items_chunk:
            thumb = title_to_thumb.get(it['title'].lower())
            if thumb:
                it['url'] = thumb
                res.append(it)
    except Exception:
        pass
    return res

def fetch_commons_search(query_str, limit=50):
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&generator=search&gsrsearch={urllib.parse.quote(query_str)}'
        f'&gsrnamespace=6&gsrlimit={limit}'
        '&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json'
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        results = []
        for p in pages.values():
            coords = p.get('coordinates', [{}])[0]
            lat = coords.get('lat')
            lon = coords.get('lon')
            ii = p.get('imageinfo', [{}])[0]
            thumb = ii.get('thumburl') or ii.get('url')
            if lat and lon and thumb:
                results.append({
                    'title': p['title'],
                    'lat': lat,
                    'lon': lon,
                    'url': thumb,
                    'query': query_str
                })
        return query_str, results
    except Exception:
        return query_str, []

def fetch_category_files_generator(cat_title, limit=100):
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&generator=categorymembers&gcmtitle={urllib.parse.quote(cat_title)}'
        f'&gcmnamespace=6&gcmlimit={limit}'
        '&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json'
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        results = []
        for p in pages.values():
            coords = p.get('coordinates', [{}])[0]
            lat = coords.get('lat')
            lon = coords.get('lon')
            ii = p.get('imageinfo', [{}])[0]
            thumb = ii.get('thumburl') or ii.get('url')
            if lat and lon and thumb:
                results.append({
                    'title': p['title'],
                    'lat': lat,
                    'lon': lon,
                    'url': thumb,
                    'query': cat_title
                })
        return cat_title, results
    except Exception:
        return cat_title, []

def main():
    print("=============================================================", flush=True)
    print("   Starting Massive 360 Panorama Streaming Catalog Builder   ", flush=True)
    print("=============================================================", flush=True)
    
    # 0. 先加载现有 catalog，保留所有有效题目
    existing_items = []
    seen_urls = set()
    catalog_path = "src/data/streetViewCatalog.json"
    if os.path.exists(catalog_path):
        try:
            with open(catalog_path, 'r', encoding='utf-8') as f:
                existing_items = json.load(f)
            for it in existing_items:
                if it.get('panoUrl'):
                    seen_urls.add(it['panoUrl'])
            print(f"-> Loaded {len(existing_items)} existing questions from catalog.", flush=True)
        except Exception:
            pass

    # 1. 抓取 Wikidata P4640 全景数据
    wikidata_raw = fetch_wikidata_panoramas()
    # 过滤出未处理的
    unresolved_wikidata = [it for it in wikidata_raw if it['title']]
    chunks = [unresolved_wikidata[i:i+40] for i in range(0, len(unresolved_wikidata), 40)]
    wikidata_resolved = []
    print(f"-> Resolving {len(unresolved_wikidata)} Wikidata thumbs in {len(chunks)} parallel batches...", flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(resolve_thumbs_batch, c) for c in chunks]
        for f in as_completed(futs):
            wikidata_resolved.extend(f.result())
    print(f"   Successfully resolved {len(wikidata_resolved)} items from Wikidata!", flush=True)
    
    # 2. 深入抓取 51 个国家分类中的文件
    print("-> Querying country categories directly with generator...", flush=True)
    try:
        subcat_url = "https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:360%C2%B0_panoramas_by_country&cmlimit=100&format=json"
        req = urllib.request.Request(subcat_url, headers=HEADERS)
        with urllib.request.urlopen(req) as resp:
            subcat_data = json.loads(resp.read().decode('utf-8'))
        country_cats = [m['title'] for m in subcat_data['query']['categorymembers']]
    except Exception:
        country_cats = []

    cat_results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(fetch_category_files_generator, cat, 100) for cat in country_cats]
        for f in as_completed(futs):
            _, items = f.result()
            cat_results.extend(items)
    print(f"   Gathered {len(cat_results)} items from country category generators!", flush=True)

    # 3. 中英文专项搜索：海量覆盖中国大陆、香港、澳门、台湾与全球名城
    search_queries = [
        # 中文高频关键词 (成千上万命中数)
        '全景 360', '中国 全景 360', '香港 360', '香港 全景', '台湾 360', '台湾 全景',
        '北京 360 全景', '上海 360 全景', '广州 360 全景', '深圳 360 全景', '成都 360 全景',
        '重庆 360 全景', '杭州 360 全景', '武汉 360 全景', '西安 360 全景', '南京 360 全景',
        '天津 360 全景', '苏州 360 全景', '厦门 360 全景', '青海 360 全景', '西藏 360 全景',
        '新疆 360 全景', '云南 360 全景', '桂林 360 全景', '长城 360 全景', '故宫 360 全景',
        '天坛 360 全景', '颐和园 360 全景', '西湖 360 全景', '九寨沟 360 全景', '黄山 360 全景',
        '张家界 360 全景', '华南理工 360', '清华 360 全景', '北大 360 全景', '大理 360 全景',
        
        # 英文中国专项
        'China 360 panorama', 'Beijing 360 panorama', 'Shanghai 360 panorama',
        'Guangzhou 360 photosphere', 'Shenzhen 360 panorama', 'Chengdu 360 panorama',
        'Hangzhou 360 panorama', 'Xi\'an 360 panorama', 'Chongqing 360 panorama',
        'Wuhan 360 panorama', 'Nanjing 360 panorama', 'Tianjin 360 panorama',
        'Hong Kong 360 panorama', 'Taiwan 360 panorama', 'Qinghai 360 panorama',
        'Tibet 360 panorama', 'Xinjiang 360 panorama', 'Yunnan 360 panorama',
        'Guilin 360 panorama', 'Xiamen 360 panorama', 'Harbin 360 panorama',
        'Suzhou 360 panorama', 'Changsha 360 panorama', 'Zhengzhou 360 panorama',
        'Great Wall 360 panorama', 'Forbidden City 360 panorama', 'Summer Palace 360 panorama',
        'West Lake 360 panorama', 'Jiuzhaigou 360 panorama', 'Zhangjiajie 360 panorama',
        'photosphere China', 'equirectangular China', 'photosphere Hong Kong', 'photosphere Taiwan',
        
        # 国际各大洲代表性国家与名城
        'Japan 360 panorama', 'Tokyo 360 panorama', 'Kyoto 360 panorama', 'Osaka 360 panorama',
        'France 360 panorama', 'Paris 360 panorama', 'Eiffel 360 panorama',
        'Germany 360 panorama', 'Berlin 360 panorama', 'Munich 360 panorama', 'Hamburg 360 panorama',
        'Italy 360 panorama', 'Rome 360 panorama', 'Venice 360 panorama', 'Florence 360 panorama',
        'Spain 360 panorama', 'Madrid 360 panorama', 'Barcelona 360 panorama',
        'United Kingdom 360 panorama', 'London 360 panorama', 'Edinburgh 360 panorama',
        'USA 360 panorama', 'New York 360 panorama', 'San Francisco 360 panorama', 'Los Angeles 360 panorama',
        'Australia 360 panorama', 'Sydney 360 panorama', 'Melbourne 360 panorama',
        'Canada 360 panorama', 'Toronto 360 panorama', 'Vancouver 360 panorama',
        'Switzerland 360 panorama', 'Zurich 360 panorama', 'Alps 360 panorama',
        'Austria 360 panorama', 'Vienna 360 panorama', 'Salzburg 360 panorama',
        'Netherlands 360 panorama', 'Amsterdam 360 panorama',
        'Russia 360 panorama', 'Moscow 360 panorama', 'Saint Petersburg 360 panorama',
        'Norway 360 panorama', 'Sweden 360 panorama', 'Finland 360 panorama',
        'Denmark 360 panorama', 'Poland 360 panorama', 'Czech 360 panorama', 'Prague 360 panorama',
        'Greece 360 panorama', 'Athens 360 panorama', 'Turkey 360 panorama', 'Istanbul 360 panorama',
        'Brazil 360 panorama', 'Rio 360 panorama', 'Mexico 360 panorama',
        'Argentina 360 panorama', 'Chile 360 panorama', 'New Zealand 360 panorama',
        'Singapore 360 panorama', 'Thailand 360 panorama', 'Bangkok 360 panorama',
        'South Korea 360 panorama', 'Seoul 360 panorama', 'Egypt 360 panorama',
        'South Africa 360 panorama', 'India 360 panorama', 'Ireland 360 panorama',
        'Portugal 360 panorama', 'Lisbon 360 panorama', 'Iceland 360 panorama',
        'Belgium 360 panorama', 'Brussels 360 panorama', 'Hungary 360 panorama', 'Budapest 360 panorama',
        'photosphere Europe', 'photosphere Asia', 'photosphere America'
    ]
    
    print(f"-> Concurrently querying Commons search across {len(search_queries)} queries...", flush=True)
    commons_results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(fetch_commons_search, q, 50) for q in search_queries]
        for f in as_completed(futs):
            _, items = f.result()
            commons_results.extend(items)
            
    print(f"   Gathered {len(commons_results)} geocoded items from Commons search!", flush=True)
    
    # 4. 合并去重与元数据组装
    combined_catalog = list(existing_items)
    
    # 加入新抓取的 Wikidata 条目
    for it in wikidata_resolved:
        url = it.get('url')
        if not url or url in seen_urls: continue
        seen_urls.add(url)
        
        lat = it['lat']
        lon = it['lon']
        label = it.get('label') or clean_city_name(it['title'])
        country_name, country_code = get_country_info(it['title'], it.get('country', ''), lat, lon)
        is_cn = (country_name == "中国" or country_code == "CHN")
        
        combined_catalog.append({
            "id": "",
            "panoUrl": url,
            "country": country_name,
            "countryName": country_name,
            "countryCode": country_code,
            "city": label[:40],
            "cityName": label[:40],
            "region": "domestic" if is_cn else "international",
            "isDomestic": is_cn,
            "lat": round(lat, 5),
            "lng": round(lon, 5),
            "initialHeading": 0,
            "description": f"{country_name} · {label} 360° 真实球面全景",
            "source": "Wikidata & Wikimedia Commons"
        })
        
    # 加入分类和搜索条目
    for it in cat_results + commons_results:
        url = it.get('url')
        if not url or url in seen_urls: continue
        seen_urls.add(url)
        
        lat = it['lat']
        lon = it['lon']
        city_name = clean_city_name(it['title'])
        country_name, country_code = get_country_info(it['title'], it.get('query', ''), lat, lon)
        is_cn = (country_name == "中国" or country_code == "CHN")
        
        combined_catalog.append({
            "id": "",
            "panoUrl": url,
            "country": country_name,
            "countryName": country_name,
            "countryCode": country_code,
            "city": city_name,
            "cityName": city_name,
            "region": "domestic" if is_cn else "international",
            "isDomestic": is_cn,
            "lat": round(lat, 5),
            "lng": round(lon, 5),
            "initialHeading": 0,
            "description": f"{country_name} · {city_name} 360° 真实球面街景",
            "source": "Wikimedia Commons Open 360° Catalog"
        })

    # 5. 重新校准国内/国外分类属性
    for it in combined_catalog:
        lat = it.get('lat', 0)
        lng = it.get('lng', 0)
        cname = it.get('country', '')
        title = it.get('city', '')
        is_cn = is_china(lat, lng, title, cname)
        if is_cn:
            it['country'] = '中国'
            it['countryName'] = '中国'
            it['countryCode'] = 'CHN'
            it['region'] = 'domestic'
            it['isDomestic'] = True
        else:
            it['region'] = 'international'
            it['isDomestic'] = False

    # 排序：国内在前，国外在后
    domestic_items = [it for it in combined_catalog if it["isDomestic"]]
    intl_items = [it for it in combined_catalog if not it["isDomestic"]]
    
    final_catalog = domestic_items + intl_items
    for idx, it in enumerate(final_catalog):
        it["id"] = f"sv_stream_{idx+1:05d}"
        
    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)
        
    print(f"\n=============================================================", flush=True)
    print(f"SUCCESS: Generated Massive Streaming Catalog!", flush=True)
    print(f"  - 国内 (中国) 题库: {len(domestic_items)} 题", flush=True)
    print(f"  - 国外 (国际) 题库: {len(intl_items)} 题", flush=True)
    print(f"  - 全球总题库数量:   {len(final_catalog)} 题", flush=True)
    print(f"  - 输出索引文件大小: {os.path.getsize(out_file) / 1024:.1f} KB", flush=True)
    print(f"=============================================================", flush=True)

if __name__ == "__main__":
    main()
