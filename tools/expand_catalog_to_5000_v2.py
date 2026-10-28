# -*- coding: utf-8 -*-
"""
expand_catalog_to_5000_v2.py
精准高速两阶段扩充至 5000 道题：
Phase 1: list=search 并发搜索全球各洲各大名城与地标的 360 文件列表
Phase 2: prop=coordinates|imageinfo 50 个一组批量萃取真实 GPS 与 4K 缩略图
Phase 3: Natural Earth 110m 点在面内权威拓扑校验，坚决排除德意瑞（DE/IT/CH），清洗地名，扩充至 5000~5050 题
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import shape, Point

HEADERS = {'User-Agent': 'TravelMapAcademicGeography/4.6 (educational geoguessr game; contact: research@travelmap.app)'}

# 1. 加载 Natural Earth 权威多边形
print("Loading Natural Earth country boundaries...", flush=True)
url = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson'
req = urllib.request.Request(url, headers={'User-Agent': 'TravelMap/1.0'})
with urllib.request.urlopen(req, timeout=15) as r:
    ne_data = json.loads(r.read().decode('utf-8'))

shapes = []
for f in ne_data['features']:
    props = f['properties']
    geom = shape(f['geometry'])
    shapes.append({
        'name': props['name'],
        'iso_a2': props['iso_a2'],
        'iso_a3': props.get('iso_a3', ''),
        'geom': geom
    })

ISO_TO_CN = {
    'CN': ('中国', 'CHN', '亚洲'), 'HK': ('中国', 'CHN', '亚洲'), 'MO': ('中国', 'CHN', '亚洲'), 'TW': ('中国', 'CHN', '亚洲'),
    'JP': ('日本', 'JP', '亚洲'), 'KR': ('韩国', 'KR', '亚洲'), 'TH': ('泰国', 'TH', '亚洲'), 'SG': ('新加坡', 'SG', '亚洲'),
    'MY': ('马来西亚', 'MY', '亚洲'), 'ID': ('印度尼西亚', 'ID', '亚洲'), 'IN': ('印度', 'IN', '亚洲'), 'PH': ('菲律宾', 'PH', '亚洲'),
    'VN': ('越南', 'VN', '亚洲'), 'KH': ('柬埔寨', 'KH', '亚洲'), 'IL': ('以色列', 'IL', '亚洲'), 'AE': ('阿联酋', 'AE', '亚洲'),
    'SA': ('沙特阿拉伯', 'SA', '亚洲'), 'KZ': ('哈萨克斯坦', 'KZ', '亚洲'), 'UZ': ('乌兹别克斯坦', 'UZ', '亚洲'), 'AM': ('亚美尼亚', 'AM', '亚洲'),
    'AZ': ('阿塞拜疆', 'AZ', '亚洲'), 'GE': ('格鲁吉亚', 'GE', '亚洲'), 'TR': ('土耳其', 'TR', '亚洲'), 'LK': ('斯里兰卡', 'LK', '亚洲'),
    'NP': ('尼泊尔', 'NP', '亚洲'), 'QA': ('卡塔尔', 'QA', '亚洲'), 'OM': ('阿曼', 'OM', '亚洲'), 'JO': ('约旦', 'JO', '亚洲'),
    'BD': ('孟加拉国', 'BD', '亚洲'), 'MM': ('缅甸', 'MM', '亚洲'), 'LA': ('老挝', 'LA', '亚洲'), 'MN': ('蒙古', 'MN', '亚洲'),
    
    'US': ('美国', 'US', '北美洲'), 'CA': ('加拿大', 'CA', '北美洲'), 'MX': ('墨西哥', 'MX', '北美洲'), 'CU': ('古巴', 'CU', '北美洲'),
    'PA': ('巴拿马', 'PA', '北美洲'), 'CR': ('哥斯达黎加', 'CR', '北美洲'), 'DO': ('多米尼加', 'DO', '北美洲'), 'JM': ('牙买加', 'JM', '北美洲'),
    'PR': ('波多黎各', 'PR', '北美洲'), 'BS': ('巴哈马', 'BS', '北美洲'),
    
    'BR': ('巴西', 'BR', '南美洲'), 'AR': ('阿根廷', 'AR', '南美洲'), 'CL': ('智利', 'CL', '南美洲'), 'PE': ('秘鲁', 'PE', '南美洲'),
    'CO': ('哥伦比亚', 'CO', '南美洲'), 'UY': ('乌拉圭', 'UY', '南美洲'), 'EC': ('厄瓜多尔', 'EC', '南美洲'), 'BO': ('玻利维亚', 'BO', '南美洲'),
    'PY': ('巴拉圭', 'PY', '南美洲'), 'VE': ('委内瑞拉', 'VE', '南美洲'),
    
    'AU': ('澳大利亚', 'AU', '大洋洲'), 'NZ': ('新西兰', 'NZ', '大洋洲'), 'FJ': ('斐济', 'FJ', '大洋洲'), 'PF': ('法属波利尼西亚', 'PF', '大洋洲'),
    'NC': ('新喀里多尼亚', 'NC', '大洋洲'), 'PG': ('巴布亚新几内亚', 'PG', '大洋洲'), 'WS': ('萨摩亚', 'WS', '大洋洲'), 'VU': ('瓦努阿图', 'VU', '大洋洲'),
    
    'EG': ('埃及', 'EG', '非洲'), 'ZA': ('南非', 'ZA', '非洲'), 'MA': ('摩洛哥', 'MA', '非洲'), 'KE': ('肯尼亚', 'KE', '非洲'),
    'TZ': ('坦桑尼亚', 'TZ', '非洲'), 'NG': ('尼日利亚', 'NG', '非洲'), 'DZ': ('阿尔及利亚', 'DZ', '非洲'), 'LY': ('利比亚', 'LY', '非洲'),
    'TN': ('突尼斯', 'TN', '非洲'), 'NA': ('纳米比亚', 'NA', '非洲'), 'MG': ('马达加斯加', 'MG', '非洲'), 'ET': ('埃塞俄比亚', 'ET', '非洲'),
    'GH': ('加纳', 'GH', '非洲'), 'SN': ('塞内加尔', 'SN', '非洲'), 'UG': ('乌干达', 'UG', '非洲'), 'ZW': ('津巴布韦', 'ZW', '非洲'),
    'BW': ('博茨瓦纳', 'BW', '非洲'), 'MU': ('毛里求斯', 'MU', '非洲'), 'SC': ('塞舌尔', 'SC', '非洲'),
    
    'FR': ('法国', 'FR', '欧洲'), 'GB': ('英国', 'GB', '欧洲'), 'ES': ('西班牙', 'ES', '欧洲'), 'PT': ('葡萄牙', 'PT', '欧洲'),
    'NL': ('荷兰', 'NL', '欧洲'), 'GR': ('希腊', 'GR', '欧洲'), 'AT': ('奥地利', 'AT', '欧洲'), 'BE': ('比利时', 'BE', '欧洲'),
    'SE': ('瑞典', 'SE', '欧洲'), 'NO': ('挪威', 'NO', '欧洲'), 'FI': ('芬兰', 'FI', '欧洲'), 'DK': ('丹麦', 'DK', '欧洲'),
    'IS': ('冰岛', 'IS', '欧洲'), 'PL': ('波兰', 'PL', '欧洲'), 'CZ': ('捷克', 'CZ', '欧洲'), 'HU': ('匈牙利', 'HU', '欧洲'),
    'IE': ('爱尔兰', 'IE', '欧洲'), 'SK': ('斯洛伐克', 'SK', '欧洲'), 'SI': ('斯洛文尼亚', 'SI', '欧洲'), 'HR': ('克罗地亚', 'HR', '欧洲'),
    'RS': ('塞尔维亚', 'RS', '欧洲'), 'BG': ('保加利亚', 'BG', '欧洲'), 'RO': ('罗马尼亚', 'RO', '欧洲'), 'UA': ('乌克兰', 'UA', '欧洲'),
    'BY': ('白俄罗斯', 'BY', '欧洲'), 'EE': ('爱沙尼亚', 'EE', '欧洲'), 'LV': ('拉脱维亚', 'LV', '欧洲'), 'LT': ('立陶宛', 'LT', '欧洲'),
    'RU': ('俄罗斯', 'RU', '欧洲'), 'IT': ('意大利', 'IT', '欧洲'), 'DE': ('德国', 'DE', '欧洲'), 'CH': ('瑞士', 'CH', '欧洲'),
    'VA': ('梵蒂冈', 'VA', '欧洲'), 'MC': ('摩纳哥', 'MC', '欧洲'), 'SM': ('圣马力诺', 'SM', '欧洲'), 'LU': ('卢森堡', 'LU', '欧洲'),
    'CY': ('塞浦路斯', 'CY', '欧洲'), 'MT': ('马耳他', 'MT', '欧洲'), 'BA': ('波斯尼亚和黑塞哥维那', 'BA', '欧洲'),
    'ME': ('黑山', 'ME', '欧洲'), 'AL': ('阿尔巴尼亚', 'AL', '欧洲'), 'MK': ('马其顿', 'MK', '欧洲'),
}

NAME_TO_CN = {
    'China': ('中国', 'CHN', '亚洲'), 'Taiwan': ('中国', 'CHN', '亚洲'), 'Hong Kong': ('中国', 'CHN', '亚洲'),
    'Japan': ('日本', 'JP', '亚洲'), 'South Korea': ('韩国', 'KR', '亚洲'), 'Thailand': ('泰国', 'TH', '亚洲'),
    'Singapore': ('新加坡', 'SG', '亚洲'), 'Malaysia': ('马来西亚', 'MY', '亚洲'), 'Indonesia': ('印度尼西亚', 'ID', '亚洲'),
    'India': ('印度', 'IN', '亚洲'), 'Philippines': ('菲律宾', 'PH', '亚洲'), 'Vietnam': ('越南', 'VN', '亚洲'),
    'United States': ('美国', 'US', '北美洲'), 'Canada': ('加拿大', 'CA', '北美洲'), 'Mexico': ('墨西哥', 'MX', '北美洲'),
    'Brazil': ('巴西', 'BR', '南美洲'), 'Argentina': ('阿根廷', 'AR', '南美洲'), 'Chile': ('智利', 'CL', '南美洲'),
    'Peru': ('秘鲁', 'PE', '南美洲'), 'Colombia': ('哥伦比亚', 'CO', '南美洲'), 'Uruguay': ('乌拉圭', 'UY', '南美洲'),
    'Australia': ('澳大利亚', 'AU', '大洋洲'), 'New Zealand': ('新西兰', 'NZ', '大洋洲'),
    'Egypt': ('埃及', 'EG', '非洲'), 'South Africa': ('南非', 'ZA', '非洲'), 'Morocco': ('摩洛哥', 'MA', '非洲'),
    'Kenya': ('肯尼亚', 'KE', '非洲'), 'Tanzania': ('坦桑尼亚', 'TZ', '非洲'), 'Algeria': ('阿尔及利亚', 'DZ', '非洲'),
    'France': ('法国', 'FR', '欧洲'), 'United Kingdom': ('英国', 'GB', '欧洲'), 'Spain': ('西班牙', 'ES', '欧洲'),
    'Portugal': ('葡萄牙', 'PT', '欧洲'), 'Netherlands': ('荷兰', 'NL', '欧洲'), 'Greece': ('希腊', 'GR', '欧洲'),
    'Austria': ('奥地利', 'AT', '欧洲'), 'Belgium': ('比利时', 'BE', '欧洲'), 'Sweden': ('瑞典', 'SE', '欧洲'),
    'Norway': ('挪威', 'NO', '欧洲'), 'Finland': ('芬兰', 'FI', '欧洲'), 'Denmark': ('丹麦', 'DK', '欧洲'),
    'Iceland': ('冰岛', 'IS', '欧洲'), 'Poland': ('波兰', 'PL', '欧洲'), 'Czech Republic': ('捷克', 'CZ', '欧洲'),
    'Hungary': ('匈牙利', 'HU', '欧洲'), 'Ireland': ('爱尔兰', 'IE', '欧洲'), 'Croatia': ('克罗地亚', 'HR', '欧洲'),
    'Russia': ('俄罗斯', 'RU', '欧洲'), 'Turkey': ('土耳其', 'TR', '亚洲'), 'Israel': ('以色列', 'IL', '亚洲'),
    'United Arab Emirates': ('阿联酋', 'AE', '亚洲'), 'Saudi Arabia': ('沙特阿拉伯', 'SA', '亚洲')
}

def resolve_coords_country(lat, lon):
    pt = Point(lon, lat)
    for s in shapes:
        if s['geom'].contains(pt):
            iso = s['iso_a2']
            if iso in ISO_TO_CN: return ISO_TO_CN[iso]
            if s['name'] in NAME_TO_CN: return NAME_TO_CN[s['name']]
            
    # buffer
    nearest = min(shapes, key=lambda s: s['geom'].distance(pt))
    if nearest['geom'].distance(pt) < 1.2:
        iso = nearest['iso_a2']
        if iso in ISO_TO_CN: return ISO_TO_CN[iso]
        if nearest['name'] in NAME_TO_CN: return NAME_TO_CN[nearest['name']]
        
    return '海外名胜', 'INTL', '其他'

def clean_title(title, country, lat, lon):
    name = re.sub(r'^(File:|Image:)', '', title, flags=re.I)
    name = re.sub(r'\.(jpg|jpeg|png)$', '', name, flags=re.I)
    name = re.sub(r'[\(\[\{].*?[\)\]\}]', '', name)
    name = re.sub(r'360\s*(degree|deg|x180|Kugelpanorama)?|panorama|panosphere|photosphere|equirectangular|groupshot|全景图?|球面', '', name, flags=re.I)
    name = re.sub(r'_\d{3,}_\d{3,}.*', '', name)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    name = re.sub(r'^[^\w\u4e00-\u9fa5]+', '', name)
    name = re.sub(r'[^\w\u4e00-\u9fa5]+$', '', name)
    name = re.sub(r'\s+', ' ', name)

    if 'mapillary' in name.lower() or re.match(r'^\d{4}[\s_-]\d{2}[\s_-]\d{2}', name):
        if country == '中国':
            if 39.5 < lat < 41.0 and 115.5 < lon < 117.5: return '北京 · 城市街景'
            if 30.8 < lat < 31.8 and 121.0 < lon < 122.0: return '上海 · 城市街景'
            if 22.4 < lat < 22.9 and 113.8 < lon < 114.5: return '深圳 · 城市街景'
            if 24.5 < lat < 25.5 and 121.0 < lon < 122.0: return '台北 · 城市街景'
            return '中国 · 城市街景'
        elif country == '韩国': return '首尔 · 城市街景'
        elif country == '日本': return '东京 · 城市街景'
        elif country == '美国': return '美国 · 城市街景'
        elif country == '澳大利亚': return '澳大利亚 · 城市街景'
        elif country == '法国': return '法国 · 城市街景'
        elif country == '英国': return '英国 · 城市街景'
        elif country == '西班牙': return '西班牙 · 城市街景'
        elif country == '巴西': return '巴西 · 城市街景'
        elif country == '加拿大': return '加拿大 · 城市街景'
        return f"{country} · 城市街景"

    if len(name) > 28:
        name = name[:28].rstrip()
    return name if len(name) >= 2 else "特色全景地标"

def fetch_search_titles(query_str, limit=50):
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&list=search&srsearch={urllib.parse.quote(query_str)}'
        f'&srnamespace=6&srlimit={limit}&format=json'
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        items = data.get('query', {}).get('search', [])
        return [it['title'] for it in items if it['title'].lower().endswith(('.jpg', '.jpeg'))]
    except Exception:
        return []

def resolve_batch_coords_and_thumbs(titles_chunk):
    pipe = '|'.join(titles_chunk)
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&titles={urllib.parse.quote(pipe)}'
        '&prop=coordinates|imageinfo&iiprop=url|extmetadata&iiurlwidth=3840&format=json'
    )
    res = []
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=16) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        for p in pages.values():
            try:
                lat, lon = None, None
                coords = p.get('coordinates')
                if coords and isinstance(coords, list) and len(coords) > 0:
                    lat = coords[0].get('lat')
                    lon = coords[0].get('lon')

                ii_list = p.get('imageinfo') or [{}]
                ii = ii_list[0] if len(ii_list) > 0 else {}
                thumb = ii.get('thumburl') or ii.get('url')

                if lat is None or lon is None:
                    extmeta = ii.get('extmetadata') or {}
                    lat_val = extmeta.get('GPSLatitude', {}).get('value')
                    lon_val = extmeta.get('GPSLongitude', {}).get('value')
                    if lat_val and lon_val:
                        lat = float(lat_val)
                        lon = float(lon_val)

                if lat is not None and lon is not None and thumb:
                    res.append({
                        'title': p['title'],
                        'lat': float(lat),
                        'lon': float(lon),
                        'url': thumb
                    })
            except Exception:
                continue
        return res
    except Exception:
        return []

def main():
    print("=====================================================", flush=True)
    print("   5000-Question Two-Phase Harvester Starting        ", flush=True)
    print("=====================================================", flush=True)

    with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f"Loaded {len(catalog)} existing questions from catalog.", flush=True)
    seen_urls = set(it['panoUrl'] for it in catalog)

    search_queries = [
        # 亚洲 (重点扩充中国各省市、日本、韩国、东南亚、南亚、中东)
        'Beijing 360', 'Shanghai 360', 'Guangzhou 360', 'Shenzhen 360', 'Chengdu 360', 'Hangzhou 360',
        'Chongqing 360', 'Wuhan 360', 'Nanjing 360', 'Tianjin 360', 'Suzhou 360', 'Xiamen 360',
        'Guilin 360', 'Qingdao 360', 'Dalian 360', 'Harbin 360', 'Changsha 360', 'Zhengzhou 360',
        'Kunming 360', 'Lanzhou 360', 'Urumqi 360', 'Lhasa 360', 'Hohhot 360', 'Sanya 360',
        'Dali 360', 'Lijiang 360', 'Hong Kong 360', 'Macau 360', 'Taipei 360', 'Kaohsiung 360',
        'Taichung 360', 'Tainan 360', '全景 360', '中国 360', '长城 360', '西湖 360', '故宫 360',
        '黄山 360', '九寨沟 360', '张家界 360', '青海 360', '云南 360', '西藏 360', '新疆 360',
        
        'Tokyo 360', 'Kyoto 360', 'Osaka 360', 'Yokohama 360', 'Nagoya 360', 'Sapporo 360',
        'Kobe 360', 'Fukuoka 360', 'Hiroshima 360', 'Sendai 360', 'Nara 360', 'Kanazawa 360',
        'Okinawa 360', 'Nagasaki 360', 'Japan 360', 'Fuji 360',
        
        'Seoul 360', 'Busan 360', 'Incheon 360', 'Daegu 360', 'Daejeon 360', 'Gwangju 360',
        'Ulsan 360', 'Suwon 360', 'Jeju 360', 'Gyeongju 360', 'Korea 360',
        
        'Bangkok 360', 'Chiang Mai 360', 'Phuket 360', 'Pattaya 360', 'Ayutthaya 360', 'Krabi 360',
        'Singapore 360', 'Marina Bay 360', 'Sentosa 360', 'Kuala Lumpur 360', 'Penang 360', 'Malacca 360',
        'Jakarta 360', 'Bali 360', 'Yogyakarta 360', 'Surabaya 360', 'Bandung 360', 'Manila 360',
        'Cebu 360', 'Hanoi 360', 'Ho Chi Minh 360', 'Da Nang 360', 'Ha Long 360', 'Hoi An 360', 'Angkor 360',
        
        'Delhi 360', 'Mumbai 360', 'Bangalore 360', 'Kolkata 360', 'Chennai 360', 'Jaipur 360',
        'Agra 360', 'Varanasi 360', 'Goa 360', 'India 360', 'Colombo 360', 'Kathmandu 360',
        
        'Dubai 360', 'Abu Dhabi 360', 'Riyadh 360', 'Jeddah 360', 'Doha 360', 'Muscat 360',
        'Istanbul 360', 'Ankara 360', 'Izmir 360', 'Antalya 360', 'Cappadocia 360', 'Ephesus 360',
        'Jerusalem 360', 'Tel Aviv 360', 'Haifa 360', 'Amman 360', 'Petra 360', 'Almaty 360',
        'Astana 360', 'Tashkent 360', 'Samarkand 360', 'Bukhara 360', 'Tbilisi 360', 'Baku 360', 'Yerevan 360',

        # 北美洲 (美国各大城市、国家公园、加拿大各省、墨西哥)
        'New York 360', 'Manhattan 360', 'Brooklyn 360', 'Los Angeles 360', 'Hollywood 360',
        'San Francisco 360', 'Chicago 360', 'Seattle 360', 'Washington 360', 'Boston 360',
        'Miami 360', 'Las Vegas 360', 'Denver 360', 'Philadelphia 360', 'San Diego 360',
        'Austin 360', 'Houston 360', 'Dallas 360', 'San Antonio 360', 'Phoenix 360',
        'Atlanta 360', 'New Orleans 360', 'Portland 360', 'Honolulu 360', 'Hawaii 360',
        'Alaska 360', 'Grand Canyon 360', 'Yellowstone 360', 'Yosemite 360', 'Zion 360',
        'Bryce 360', 'Arches 360', 'Glacier 360', 'Monument Valley 360', 'USA 360',
        
        'Toronto 360', 'Vancouver 360', 'Montreal 360', 'Quebec 360', 'Ottawa 360',
        'Calgary 360', 'Edmonton 360', 'Victoria 360', 'Banff 360', 'Jasper 360',
        'Niagara 360', 'Canada 360',
        
        'Mexico 360', 'Mexico City 360', 'Cancun 360', 'Guadalajara 360', 'Monterrey 360',
        'Oaxaca 360', 'Puebla 360', 'Chichen Itza 360', 'Teotihuacan 360', 'Tulum 360',
        'Costa Rica 360', 'Panama 360', 'Havana 360', 'Puerto Rico 360', 'San Juan 360',

        # 南美洲 (巴西、阿根廷、智利、秘鲁、哥伦比亚等)
        'Brazil 360', 'Rio de Janeiro 360', 'Sao Paulo 360', 'Brasilia 360', 'Salvador 360',
        'Fortaleza 360', 'Manaus 360', 'Curitiba 360', 'Recife 360', 'Porto Alegre 360',
        'Iguazu 360', 'Foz do Iguacu 360', 'Florianopolis 360',
        
        'Argentina 360', 'Buenos Aires 360', 'Cordoba 360', 'Mendoza 360', 'Rosario 360',
        'Bariloche 360', 'Patagonia 360', 'Ushuaia 360', 'Salta 360', 'Perito Moreno 360',
        
        'Chile 360', 'Santiago 360', 'Valparaiso 360', 'Atacama 360', 'Torres del Paine 360',
        'Easter Island 360',
        
        'Peru 360', 'Lima 360', 'Cusco 360', 'Machu Picchu 360', 'Arequipa 360', 'Titicaca 360',
        'Colombia 360', 'Bogota 360', 'Medellin 360', 'Cartagena 360', 'Cali 360',
        'Ecuador 360', 'Quito 360', 'Galapagos 360', 'Bolivia 360', 'Uyuni 360', 'La Paz 360',
        'Uruguay 360', 'Montevideo 360', 'Punta del Este 360',

        # 非洲 (埃及、南非、摩洛哥、东非、北非)
        'Egypt 360', 'Cairo 360', 'Giza 360', 'Luxor 360', 'Aswan 360', 'Alexandria 360',
        'Red Sea 360', 'Hurghada 360', 'Sharm 360',
        
        'South Africa 360', 'Cape Town 360', 'Johannesburg 360', 'Durban 360', 'Pretoria 360',
        'Kruger 360', 'Stellenbosch 360', 'Table Mountain 360',
        
        'Morocco 360', 'Marrakech 360', 'Casablanca 360', 'Fes 360', 'Chefchaouen 360',
        'Rabat 360', 'Tangier 360', 'Sahara 360', 'Essaouira 360',
        
        'Kenya 360', 'Nairobi 360', 'Mombasa 360', 'Masai Mara 360', 'Tanzania 360',
        'Zanzibar 360', 'Kilimanjaro 360', 'Serengeti 360', 'Uganda 360', 'Rwanda 360',
        'Algeria 360', 'Algiers 360', 'Oran 360', 'Tunisia 360', 'Tunis 360', 'Carthage 360',
        'Nigeria 360', 'Lagos 360', 'Abuja 360', 'Ghana 360', 'Accra 360', 'Senegal 360',
        'Dakar 360', 'Ethiopia 360', 'Namibia 360', 'Madagascar 360', 'Victoria Falls 360',
        'Mauritius 360',

        # 大洋洲 (澳大利亚各州、新西兰、太平洋岛屿)
        'Australia 360', 'Sydney 360', 'Melbourne 360', 'Brisbane 360', 'Perth 360',
        'Adelaide 360', 'Gold Coast 360', 'Cairns 360', 'Great Barrier Reef 360',
        'Uluru 360', 'Canberra 360', 'Hobart 360', 'Tasmania 360', 'Darwin 360',
        'Bondi 360', 'Twelve Apostles 360',
        
        'New Zealand 360', 'Auckland 360', 'Wellington 360', 'Queenstown 360',
        'Christchurch 360', 'Rotorua 360', 'Milford Sound 360', 'Mount Cook 360', 'Hobbiton 360',
        'Fiji 360', 'Tahiti 360', 'Bora Bora 360', 'Samoa 360', 'New Caledonia 360',

        # 欧洲其他国家 (非德意瑞)
        'France 360', 'Paris 360', 'Eiffel 360', 'Louvre 360', 'Nice 360', 'Lyon 360',
        'Marseille 360', 'Bordeaux 360', 'Strasbourg 360', 'Versailles 360', 'Mont Saint-Michel 360',
        'Cannes 360', 'Toulouse 360', 'Chamonix 360',
        
        'United Kingdom 360', 'London 360', 'Big Ben 360', 'Tower Bridge 360', 'Edinburgh 360',
        'Manchester 360', 'Liverpool 360', 'Oxford 360', 'Cambridge 360', 'Stonehenge 360',
        'Belfast 360', 'Cardiff 360', 'Glasgow 360', 'Bath 360',
        
        'Spain 360', 'Madrid 360', 'Barcelona 360', 'Sagrada Familia 360', 'Seville 360',
        'Granada 360', 'Alhambra 360', 'Valencia 360', 'Toledo 360', 'Bilbao 360',
        'Mallorca 360', 'Ibiza 360', 'Tenerife 360', 'Cordoba Spain 360',
        
        'Portugal 360', 'Lisbon 360', 'Porto 360', 'Sintra 360', 'Algarve 360', 'Madeira 360', 'Azores 360',
        
        'Netherlands 360', 'Amsterdam 360', 'Rotterdam 360', 'Utrecht 360', 'Hague 360',
        'Belgium 360', 'Brussels 360', 'Bruges 360', 'Ghent 360', 'Antwerp 360',
        
        'Greece 360', 'Athens 360', 'Acropolis 360', 'Santorini 360', 'Mykonos 360', 'Crete 360', 'Meteora 360',
        
        'Austria 360', 'Vienna 360', 'Salzburg 360', 'Hallstatt 360', 'Innsbruck 360',
        
        'Norway 360', 'Oslo 360', 'Bergen 360', 'Lofoten 360', 'Tromso 360', 'Geiranger 360',
        'Sweden 360', 'Stockholm 360', 'Gothenburg 360', 'Malmo 360',
        'Finland 360', 'Helsinki 360', 'Rovaniemi 360',
        'Denmark 360', 'Copenhagen 360',
        'Iceland 360', 'Reykjavik 360', 'Gullfoss 360',
        
        'Poland 360', 'Warsaw 360', 'Krakow 360', 'Wroclaw 360', 'Gdansk 360',
        'Czech 360', 'Prague 360', 'Cesky Krumlov 360', 'Brno 360',
        'Hungary 360', 'Budapest 360',
        'Ireland 360', 'Dublin 360', 'Galway 360',
        'Croatia 360', 'Dubrovnik 360', 'Split 360', 'Plitvice 360', 'Zagreb 360',
        'Romania 360', 'Bucharest 360', 'Brasov 360'
    ]

    print(f"Phase 1: Searching titles for {len(search_queries)} queries in parallel...", flush=True)
    all_titles = set()
    with ThreadPoolExecutor(max_workers=14) as ex:
        futs = [ex.submit(fetch_search_titles, q, 50) for q in search_queries]
        for f in as_completed(futs):
            t_list = f.result()
            all_titles.update(t_list)

    print(f"Phase 1 Complete! Found {len(all_titles)} unique candidate titles.", flush=True)

    # Phase 2: 分批解析 GPS 与 Thumb (50 个一组)
    title_list = list(all_titles)
    chunks = [title_list[i:i+50] for i in range(0, len(title_list), 50)]
    print(f"Phase 2: Resolving GPS & 4K thumbs in {len(chunks)} parallel batches...", flush=True)

    resolved_candidates = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(resolve_batch_coords_and_thumbs, c) for c in chunks]
        for idx, f in enumerate(as_completed(futs), 1):
            batch_res = f.result()
            resolved_candidates.extend(batch_res)
            if idx % 20 == 0 or idx == len(chunks):
                print(f"[{idx}/{len(chunks)}] Resolved {len(resolved_candidates)} items with valid GPS...", flush=True)

    print(f"\nPhase 2 Complete! Total valid items with GPS: {len(resolved_candidates)}", flush=True)
    print("Phase 3: Filtering, topology mapping, balance control...", flush=True)

    TARGET_TOTAL = 5025
    added = 0
    skipped_it_de_ch = 0
    skipped_dup = 0
    skipped_unknown = 0

    for it in resolved_candidates:
        if len(catalog) >= TARGET_TOTAL:
            break

        url = it['url']
        if url in seen_urls:
            skipped_dup += 1
            continue
        seen_urls.add(url)

        lat = it['lat']
        lon = it['lon']
        country_name, country_code, continent = resolve_coords_country(lat, lon)

        # 坚决不加德意瑞
        if country_name in ['德国', '意大利', '瑞士']:
            skipped_it_de_ch += 1
            continue

        if country_name == '海外名胜' and country_code == 'INTL':
            skipped_unknown += 1
            continue

        clean_city = clean_title(it['title'], country_name, lat, lon)
        is_cn = (country_name == '中国' or country_code == 'CHN')

        catalog.append({
            "id": "",
            "panoUrl": url,
            "country": country_name,
            "countryName": country_name,
            "countryCode": country_code,
            "city": clean_city,
            "cityName": clean_city,
            "region": "domestic" if is_cn else "international",
            "isDomestic": is_cn,
            "lat": round(lat, 5),
            "lng": round(lon, 5),
            "initialHeading": 0,
            "description": f"{country_name} · {clean_city} 真实 360° 球面全景",
            "source": "Wikimedia Commons Open 360° Harvester"
        })
        added += 1

    print(f"\nAdded {added} new verified questions! Skipped {skipped_it_de_ch} DE/IT/CH items.", flush=True)
    print(f"Catalog size reached: {len(catalog)} questions.", flush=True)

    # 排序重排
    dom = [x for x in catalog if x.get('isDomestic')]
    intl = [x for x in catalog if not x.get('isDomestic')]
    final_catalog = dom + intl

    for idx, it in enumerate(final_catalog):
        it['id'] = f"sv_stream_{idx+1:05d}"

    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)

    # 统计各大洲与国家
    continents = {}
    countries = {}
    for it in final_catalog:
        c = it['country']
        countries[c] = countries.get(c, 0) + 1
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        continents[cont] = continents.get(cont, 0) + 1

    print("\n=====================================================", flush=True)
    print(f"5000 EXPANSION SUCCESS! Total questions: {len(final_catalog)}")
    print("CONTINENT BREAKDOWN (大洲分布):")
    for cont, count in sorted(continents.items(), key=lambda x: -x[1]):
        pct = (count / len(final_catalog)) * 100
        print(f"  - {cont}: {count} 题 ({pct:.1f}%)")
    print("\nTOP 30 COUNTRIES (主要国家分布):")
    for c, count in sorted(countries.items(), key=lambda x: -x[1])[:30]:
        print(f"  - {c}: {count} 题")
    print(f"File size: {os.path.getsize(out_file) / 1024:.1f} KB")
    print("=====================================================", flush=True)

if __name__ == '__main__':
    main()
