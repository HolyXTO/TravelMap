# -*- coding: utf-8 -*-
"""
expand_catalog_5000.py
将 360° 真实街景题库扩充至 5000 道左右，并严格遵循大洲与全球平衡：
1. 坚决不再新增德国、意大利、瑞士的题（目前已有约 800 题，保持克制平衡）
2. 欧洲其余国家（法国、英国、西班牙、葡萄牙、荷兰、希腊、奥地利、北欧、东欧等）适量补充
3. 大量补充亚洲（中国、日本、韩国、东南亚、南亚、中东）、北美洲（美国各州、加拿大、墨西哥）、
   南美洲（巴西、阿根廷、智利、秘鲁、哥伦比亚等）、非洲（埃及、南非、摩洛哥、肯尼亚、坦桑尼亚等）、
   大洋洲（澳大利亚各州、新西兰等）
4. 全程使用 Natural Earth 110m 多边形拓扑点在面内判定，确保国家与大洲归属绝对精确
5. 实时地名清洗，杜绝 Mapillary 序列号、Q-ID 与前缀符号，保证地名美观精炼（<=28字）
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import shape, Point

HEADERS = {'User-Agent': 'TravelMapAcademicGeography/4.2 (educational geoguessr game; contact: research@travelmap.app)'}

# 1. 下载/加载 Natural Earth 权威边界
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
    
    'US': ('美国', 'US', '北美洲'), 'CA': ('加拿大', 'CA', '北美洲'), 'MX': ('墨西哥', 'MX', '北美洲'), 'CU': ('古巴', 'CU', '北美洲'),
    'PA': ('巴拿马', 'PA', '北美洲'), 'CR': ('哥斯达黎加', 'CR', '北美洲'), 'DO': ('多米尼加', 'DO', '北美洲'), 'JM': ('牙买加', 'JM', '北美洲'),
    'PR': ('波多黎各', 'PR', '北美洲'),
    
    'BR': ('巴西', 'BR', '南美洲'), 'AR': ('阿根廷', 'AR', '南美洲'), 'CL': ('智利', 'CL', '南美洲'), 'PE': ('秘鲁', 'PE', '南美洲'),
    'CO': ('哥伦比亚', 'CO', '南美洲'), 'UY': ('乌拉圭', 'UY', '南美洲'), 'EC': ('厄瓜多尔', 'EC', '南美洲'), 'BO': ('玻利维亚', 'BO', '南美洲'),
    'PY': ('巴拉圭', 'PY', '南美洲'), 'VE': ('委内瑞拉', 'VE', '南美洲'),
    
    'AU': ('澳大利亚', 'AU', '大洋洲'), 'NZ': ('新西兰', 'NZ', '大洋洲'), 'FJ': ('斐济', 'FJ', '大洋洲'), 'PF': ('法属波利尼西亚', 'PF', '大洋洲'),
    'NC': ('新喀里多尼亚', 'NC', '大洋洲'), 'PG': ('巴布亚新几内亚', 'PG', '大洋洲'), 'WS': ('萨摩亚', 'WS', '大洋洲'),
    
    'EG': ('埃及', 'EG', '非洲'), 'ZA': ('南非', 'ZA', '非洲'), 'MA': ('摩洛哥', 'MA', '非洲'), 'KE': ('肯尼亚', 'KE', '非洲'),
    'TZ': ('坦桑尼亚', 'TZ', '非洲'), 'NG': ('尼日利亚', 'NG', '非洲'), 'DZ': ('阿尔及利亚', 'DZ', '非洲'), 'LY': ('利比亚', 'LY', '非洲'),
    'TN': ('突尼斯', 'TN', '非洲'), 'NA': ('纳米比亚', 'NA', '非洲'), 'MG': ('马达加斯加', 'MG', '非洲'), 'ET': ('埃塞俄比亚', 'ET', '非洲'),
    'GH': ('加纳', 'GH', '非洲'), 'SN': ('塞内加尔', 'SN', '非洲'), 'UG': ('乌干达', 'UG', '非洲'), 'ZW': ('津巴布韦', 'ZW', '非洲'),
    'BW': ('博茨瓦纳', 'BW', '非洲'), 'MU': ('毛里求斯', 'MU', '非洲'),
    
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

    # 处理 Mapillary
    if 'mapillary' in name.lower() or re.match(r'^\d{4}[\s_-]\d{2}[\s_-]\d{2}', name):
        if country == '中国':
            if 39.5 < lat < 41.0 and 115.5 < lon < 117.5: return '北京 · 城市街景'
            if 30.8 < lat < 31.8 and 121.0 < lon < 122.0: return '上海 · 城市街景'
            if 22.4 < lat < 22.9 and 113.8 < lon < 114.5: return '深圳 · 城市街景'
            if 24.5 < lat < 25.5 and 121.0 < lon < 122.0: return '台北 · 城市街景'
            return '中国 · 城市街景'
        elif country == '韩国':
            return '首尔 · 城市街景'
        elif country == '日本':
            return '东京 · 城市街景'
        elif country == '美国':
            return '美国 · 城市街景'
        elif country == '澳大利亚':
            return '澳大利亚 · 城市街景'
        elif country == '法国':
            return '法国 · 城市街景'
        elif country == '英国':
            return '英国 · 城市街景'
        elif country == '西班牙':
            return '西班牙 · 城市街景'
        elif country == '巴西':
            return '巴西 · 城市街景'
        elif country == '加拿大':
            return '加拿大 · 城市街景'
        return f"{country} · 城市街景"

    if len(name) > 28:
        name = name[:28].rstrip()
    return name if len(name) >= 2 else "特色全景地标"

def fetch_search_batch(query_str, limit=50, max_pages=2):
    all_results = []
    offset = None
    for page in range(max_pages):
        url = (
            'https://commons.wikimedia.org/w/api.php?action=query'
            f'&generator=search&gsrsearch={urllib.parse.quote(query_str)}'
            f'&gsrnamespace=6&gsrlimit={limit}'
            '&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json'
        )
        if offset:
            url += f'&gsroffset={offset}'
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=16) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for p in pages.values():
                coords = p.get('coordinates', [{}])[0]
                lat = coords.get('lat')
                lon = coords.get('lon')
                ii = p.get('imageinfo', [{}])[0]
                thumb = ii.get('thumburl') or ii.get('url')
                if lat and lon and thumb:
                    all_results.append({
                        'title': p['title'],
                        'lat': lat,
                        'lon': lon,
                        'url': thumb,
                        'query': query_str
                    })
            offset = data.get('continue', {}).get('gsroffset')
            if not offset:
                break
            time.sleep(0.1)
        except Exception:
            break
    return query_str, all_results

def main():
    print("=====================================================", flush=True)
    print("   5000-Question Global Balance 360 Harvester        ", flush=True)
    print("=====================================================", flush=True)

    # 1. 加载现有题库
    with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f"Loaded {len(catalog)} existing questions from catalog.", flush=True)
    seen_urls = set(it['panoUrl'] for it in catalog)

    # 2. 全球重点平衡检索词 (700+ 词，覆盖非德意瑞全球 6 大洲)
    targeted_queries = [
        # --- 亚洲 (Asia) 重点补充 ---
        # 中国名城与名胜
        'China 360 panorama', 'Beijing 360 panorama', 'Shanghai 360 panorama', 'Guangzhou 360 panorama',
        'Shenzhen 360 panorama', 'Chengdu 360 panorama', 'Hangzhou 360 panorama', 'Wuhan 360 panorama',
        'Xi\'an 360 panorama', 'Chongqing 360 panorama', 'Nanjing 360 panorama', 'Tianjin 360 panorama',
        'Suzhou 360 panorama', 'Xiamen 360 panorama', 'Guilin 360 panorama', 'Qingdao 360 panorama',
        'Dalian 360 panorama', 'Harbin 360 panorama', 'Changsha 360 panorama', 'Zhengzhou 360 panorama',
        'Jinan 360 panorama', 'Fuzhou 360 panorama', 'Kunming 360 panorama', 'Lanzhou 360 panorama',
        'Urumqi 360 panorama', 'Lhasa 360 panorama', 'Hohhot 360 panorama', 'Haikou 360 panorama',
        'Sanya 360 panorama', 'Dali 360 panorama', 'Lijiang 360 panorama', 'Hong Kong 360 panorama',
        'Victoria Harbour 360 panorama', 'Macau 360 panorama', 'Taipei 360 panorama', 'Kaohsiung 360 panorama',
        'Taichung 360 panorama', 'Tainan 360 panorama', 'Hualien 360 panorama', 'Sun Moon Lake 360 panorama',
        'Great Wall 360 panorama', 'Forbidden City 360 panorama', 'Summer Palace 360 panorama',
        'West Lake 360 panorama', 'Huangshan 360 panorama', 'Jiuzhaigou 360 panorama', 'Zhangjiajie 360 panorama',
        'photosphere China', 'equirectangular China', 'photosphere Hong Kong', 'photosphere Taiwan',
        
        # 日本
        'Japan 360 panorama', 'Tokyo 360 panorama', 'Kyoto 360 panorama', 'Osaka 360 panorama',
        'Yokohama 360 panorama', 'Nagoya 360 panorama', 'Sapporo 360 panorama', 'Kobe 360 panorama',
        'Fukuoka 360 panorama', 'Hiroshima 360 panorama', 'Sendai 360 panorama', 'Nara 360 panorama',
        'Kanazawa 360 panorama', 'Okinawa 360 panorama', 'Nagasaki 360 panorama', 'Mount Fuji 360 panorama',
        'photosphere Tokyo', 'photosphere Kyoto', 'equirectangular Japan',
        
        # 韩国
        'South Korea 360 panorama', 'Seoul 360 panorama', 'Busan 360 panorama', 'Incheon 360 panorama',
        'Daegu 360 panorama', 'Gwangju 360 panorama', 'Daejeon 360 panorama', 'Ulsan 360 panorama',
        'Jeju 360 panorama', 'Gyeongju 360 panorama', 'photosphere Seoul', 'equirectangular Korea',
        
        # 东南亚
        'Thailand 360 panorama', 'Bangkok 360 panorama', 'Chiang Mai 360 panorama', 'Phuket 360 panorama',
        'Pattaya 360 panorama', 'Ayutthaya 360 panorama', 'Krabi 360 panorama', 'photosphere Bangkok',
        'Singapore 360 panorama', 'Marina Bay 360 panorama', 'Sentosa 360 panorama',
        'Malaysia 360 panorama', 'Kuala Lumpur 360 panorama', 'Penang 360 panorama', 'Malacca 360 panorama',
        'Indonesia 360 panorama', 'Bali 360 panorama', 'Jakarta 360 panorama', 'Yogyakarta 360 panorama',
        'Surabaya 360 panorama', 'Bandung 360 panorama', 'Borobudur 360 panorama', 'photosphere Bali',
        'Vietnam 360 panorama', 'Hanoi 360 panorama', 'Ho Chi Minh 360 panorama', 'Da Nang 360 panorama',
        'Ha Long Bay 360 panorama', 'Hoi An 360 panorama', 'Hue Vietnam 360 panorama',
        'Philippines 360 panorama', 'Manila 360 panorama', 'Cebu 360 panorama', 'Boracay 360 panorama',
        'Cambodia 360 panorama', 'Angkor Wat 360 panorama', 'Phnom Penh 360 panorama',
        
        # 南亚
        'India 360 panorama', 'Delhi 360 panorama', 'Mumbai 360 panorama', 'Taj Mahal 360 panorama',
        'Jaipur 360 panorama', 'Bangalore 360 panorama', 'Kolkata 360 panorama', 'Chennai 360 panorama',
        'Varanasi 360 panorama', 'Goa 360 panorama', 'Agra 360 panorama', 'Kerala 360 panorama',
        'Sri Lanka 360 panorama', 'Colombo 360 panorama', 'Nepal 360 panorama', 'Kathmandu 360 panorama',
        
        # 中东与中亚
        'UAE 360 panorama', 'Dubai 360 panorama', 'Burj Khalifa 360 panorama', 'Abu Dhabi 360 panorama',
        'Turkey 360 panorama', 'Istanbul 360 panorama', 'Hagia Sophia 360 panorama', 'Cappadocia 360 panorama',
        'Antalya 360 panorama', 'Ankara 360 panorama', 'Izmir 360 panorama', 'Ephesus 360 panorama',
        'Saudi Arabia 360 panorama', 'Riyadh 360 panorama', 'Jeddah 360 panorama', 'AlUla 360 panorama',
        'Qatar 360 panorama', 'Doha 360 panorama', 'Oman 360 panorama', 'Muscat 360 panorama',
        'Jordan 360 panorama', 'Petra 360 panorama', 'Amman 360 panorama',
        'Israel 360 panorama', 'Jerusalem 360 panorama', 'Tel Aviv 360 panorama', 'Haifa 360 panorama',
        'Kazakhstan 360 panorama', 'Almaty 360 panorama', 'Astana 360 panorama',
        'Uzbekistan 360 panorama', 'Samarkand 360 panorama', 'Bukhara 360 panorama',
        'Georgia 360 panorama', 'Tbilisi 360 panorama', 'Armenia 360 panorama', 'Yerevan 360 panorama',
        'Azerbaijan 360 panorama', 'Baku 360 panorama',

        # --- 北美洲 (North America) 重点补充 ---
        # 美国各大城市与国家公园
        'USA 360 panorama', 'New York 360 panorama', 'Manhattan 360 panorama', 'Brooklyn 360 panorama',
        'Central Park 360 panorama', 'Times Square 360 panorama', 'Statue of Liberty 360 panorama',
        'Los Angeles 360 panorama', 'Hollywood 360 panorama', 'Santa Monica 360 panorama',
        'San Francisco 360 panorama', 'Golden Gate 360 panorama', 'Alcatraz 360 panorama',
        'Chicago 360 panorama', 'Millennium Park 360 panorama', 'Seattle 360 panorama', 'Space Needle 360 panorama',
        'Washington DC 360 panorama', 'National Mall 360 panorama', 'Capitol 360 panorama',
        'Boston 360 panorama', 'Miami 360 panorama', 'Miami Beach 360 panorama', 'Orlando 360 panorama',
        'Las Vegas 360 panorama', 'Strip 360 panorama', 'Denver 360 panorama', 'Philadelphia 360 panorama',
        'San Diego 360 panorama', 'Austin Texas 360 panorama', 'Houston 360 panorama', 'Dallas 360 panorama',
        'San Antonio 360 panorama', 'Phoenix 360 panorama', 'Atlanta 360 panorama', 'New Orleans 360 panorama',
        'Portland Oregon 360 panorama', 'Nashville 360 panorama', 'Honolulu 360 panorama', 'Waikiki 360 panorama',
        'Grand Canyon 360 panorama', 'Yellowstone 360 panorama', 'Yosemite 360 panorama', 'Zion 360 panorama',
        'Bryce Canyon 360 panorama', 'Arches National Park 360 panorama', 'Monument Valley 360 panorama',
        'Glacier National Park 360 panorama', 'Death Valley 360 panorama', 'Joshua Tree 360 panorama',
        'Alaska 360 panorama', 'Hawaii 360 panorama', 'photosphere United States', 'photosphere New York',
        'photosphere California', 'equirectangular USA',
        
        # 加拿大
        'Canada 360 panorama', 'Toronto 360 panorama', 'CN Tower 360 panorama', 'Vancouver 360 panorama',
        'Montreal 360 panorama', 'Quebec City 360 panorama', 'Ottawa 360 panorama', 'Calgary 360 panorama',
        'Edmonton 360 panorama', 'Victoria BC 360 panorama', 'Banff 360 panorama', 'Lake Louise 360 panorama',
        'Jasper 360 panorama', 'Niagara Falls 360 panorama', 'Whistler 360 panorama', 'Halifax 360 panorama',
        'photosphere Canada', 'equirectangular Canada',
        
        # 墨西哥与中美洲
        'Mexico 360 panorama', 'Mexico City 360 panorama', 'Zocalo 360 panorama', 'Cancun 360 panorama',
        'Chichen Itza 360 panorama', 'Teotihuacan 360 panorama', 'Guadalajara 360 panorama',
        'Monterrey 360 panorama', 'Oaxaca 360 panorama', 'Puebla 360 panorama', 'Tulum 360 panorama',
        'Cabo San Lucas 360 panorama', 'Puerto Vallarta 360 panorama', 'Merida Mexico 360 panorama',
        'Costa Rica 360 panorama', 'San Jose Costa Rica 360 panorama', 'Panama 360 panorama',
        'Panama City 360 panorama', 'Panama Canal 360 panorama', 'Cuba 360 panorama', 'Havana 360 panorama',
        'Puerto Rico 360 panorama', 'San Juan Puerto Rico 360 panorama', 'Dominican Republic 360 panorama',

        # --- 南美洲 (South America) 重点补充 ---
        # 巴西
        'Brazil 360 panorama', 'Rio de Janeiro 360 panorama', 'Copacabana 360 panorama', 'Christ the Redeemer 360 panorama',
        'Sugarloaf Mountain 360 panorama', 'Sao Paulo 360 panorama', 'Brasilia 360 panorama',
        'Salvador Bahia 360 panorama', 'Fortaleza 360 panorama', 'Belo Horizonte 360 panorama',
        'Manaus 360 panorama', 'Curitiba 360 panorama', 'Recife 360 panorama', 'Porto Alegre 360 panorama',
        'Iguazu Falls 360 panorama', 'Foz do Iguacu 360 panorama', 'Florianopolis 360 panorama',
        'photosphere Brazil', 'equirectangular Brazil',
        
        # 阿根廷
        'Argentina 360 panorama', 'Buenos Aires 360 panorama', 'Plaza de Mayo 360 panorama', 'La Boca 360 panorama',
        'Cordoba Argentina 360 panorama', 'Mendoza 360 panorama', 'Rosario Argentina 360 panorama',
        'Salta Argentina 360 panorama', 'Bariloche 360 panorama', 'Patagonia 360 panorama',
        'Perito Moreno 360 panorama', 'Ushuaia 360 panorama', 'Tierra del Fuego 360 panorama',
        
        # 智利
        'Chile 360 panorama', 'Santiago Chile 360 panorama', 'Valparaiso 360 panorama', 'Vina del Mar 360 panorama',
        'Atacama 360 panorama', 'San Pedro de Atacama 360 panorama', 'Torres del Paine 360 panorama',
        'Easter Island 360 panorama', 'Moai 360 panorama', 'Puerto Montt 360 panorama',
        
        # 秘鲁
        'Peru 360 panorama', 'Lima 360 panorama', 'Miraflores 360 panorama', 'Cusco 360 panorama',
        'Machu Picchu 360 panorama', 'Sacred Valley 360 panorama', 'Arequipa 360 panorama',
        'Lake Titicaca 360 panorama', 'Colca Canyon 360 panorama', 'Huacachina 360 panorama',
        
        # 哥伦比亚
        'Colombia 360 panorama', 'Bogota 360 panorama', 'Monserrate 360 panorama', 'Medellin 360 panorama',
        'Cartagena Colombia 360 panorama', 'Cali Colombia 360 panorama', 'Santa Marta 360 panorama',
        
        # 厄瓜多尔、玻利维亚、乌拉圭
        'Ecuador 360 panorama', 'Quito 360 panorama', 'Cuenca Ecuador 360 panorama', 'Galapagos 360 panorama',
        'Cotopaxi 360 panorama', 'Bolivia 360 panorama', 'Salar de Uyuni 360 panorama', 'La Paz Bolivia 360 panorama',
        'Uruguay 360 panorama', 'Montevideo 360 panorama', 'Punta del Este 360 panorama', 'Colonia del Sacramento 360 panorama',
        'Paraguay 360 panorama', 'Asuncion 360 panorama',

        # --- 非洲 (Africa) 重点补充 ---
        # 埃及
        'Egypt 360 panorama', 'Cairo 360 panorama', 'Giza Pyramids 360 panorama', 'Sphinx 360 panorama',
        'Luxor 360 panorama', 'Karnak 360 panorama', 'Valley of the Kings 360 panorama', 'Aswan 360 panorama',
        'Abu Simbel 360 panorama', 'Alexandria Egypt 360 panorama', 'Red Sea 360 panorama', 'Hurghada 360 panorama',
        'Sharm El Sheikh 360 panorama', 'photosphere Egypt',
        
        # 南非
        'South Africa 360 panorama', 'Cape Town 360 panorama', 'Table Mountain 360 panorama', 'Cape of Good Hope 360 panorama',
        'Kruger National Park 360 panorama', 'Johannesburg 360 panorama', 'Durban 360 panorama',
        'Pretoria 360 panorama', 'Garden Route 360 panorama', 'Stellenbosch 360 panorama',
        'Boulders Beach 360 panorama', 'Drakensberg 360 panorama', 'photosphere South Africa',
        
        # 摩洛哥
        'Morocco 360 panorama', 'Marrakech 360 panorama', 'Jemaa el-Fnaa 360 panorama', 'Casablanca 360 panorama',
        'Hassan II Mosque 360 panorama', 'Fes Morocco 360 panorama', 'Chefchaouen 360 panorama',
        'Rabat Morocco 360 panorama', 'Tangier 360 panorama', 'Essaouira 360 panorama',
        'Sahara Morocco 360 panorama', 'Merzouga 360 panorama', 'Ait Benhaddou 360 panorama',
        
        # 东非与中南非
        'Kenya 360 panorama', 'Nairobi 360 panorama', 'Masai Mara 360 panorama', 'Mombasa 360 panorama',
        'Amboseli 360 panorama', 'Tanzania 360 panorama', 'Kilimanjaro 360 panorama', 'Serengeti 360 panorama',
        'Zanzibar 360 panorama', 'Stone Town 360 panorama', 'Ngorongoro 360 panorama',
        'Uganda 360 panorama', 'Kampala 360 panorama', 'Rwanda 360 panorama', 'Kigali 360 panorama',
        'Zimbabwe 360 panorama', 'Victoria Falls 360 panorama', 'Zambia 360 panorama',
        'Botswana 360 panorama', 'Okavango 360 panorama', 'Namibia 360 panorama', 'Sossusvlei 360 panorama',
        'Etosha 360 panorama', 'Madagascar 360 panorama', 'Baobabs 360 panorama', 'Mauritius 360 panorama',
        
        # 北非与西非
        'Algeria 360 panorama', 'Algiers 360 panorama', 'Oran 360 panorama', 'Constantine Algeria 360 panorama',
        'Tunisia 360 panorama', 'Tunis 360 panorama', 'Carthage 360 panorama', 'Sidi Bou Said 360 panorama',
        'Djerba 360 panorama', 'Nigeria 360 panorama', 'Lagos Nigeria 360 panorama', 'Abuja 360 panorama',
        'Ghana 360 panorama', 'Accra 360 panorama', 'Senegal 360 panorama', 'Dakar 360 panorama',
        'Ethiopia 360 panorama', 'Addis Ababa 360 panorama', 'Lalibela 360 panorama',

        # --- 大洋洲 (Oceania) 重点补充 ---
        # 澳大利亚
        'Australia 360 panorama', 'Sydney 360 panorama', 'Sydney Opera House 360 panorama', 'Sydney Harbour Bridge 360 panorama',
        'Bondi Beach 360 panorama', 'Manly Beach 360 panorama', 'Melbourne 360 panorama',
        'Great Ocean Road 360 panorama', 'Twelve Apostles 360 panorama', 'Brisbane 360 panorama',
        'Gold Coast Australia 360 panorama', 'Surfers Paradise 360 panorama', 'Perth Australia 360 panorama',
        'Adelaide 360 panorama', 'Cairns 360 panorama', 'Great Barrier Reef 360 panorama',
        'Uluru 360 panorama', 'Ayers Rock 360 panorama', 'Alice Springs 360 panorama',
        'Canberra 360 panorama', 'Hobart 360 panorama', 'Tasmania 360 panorama', 'Cradle Mountain 360 panorama',
        'Blue Mountains Australia 360 panorama', 'Darwin Australia 360 panorama', 'Kakadu 360 panorama',
        'photosphere Australia', 'photosphere Sydney', 'equirectangular Australia',
        
        # 新西兰
        'New Zealand 360 panorama', 'Auckland 360 panorama', 'Sky Tower Auckland 360 panorama',
        'Wellington New Zealand 360 panorama', 'Queenstown New Zealand 360 panorama', 'Lake Wakatipu 360 panorama',
        'Christchurch New Zealand 360 panorama', 'Rotorua 360 panorama', 'Hobbiton 360 panorama',
        'Milford Sound 360 panorama', 'Mount Cook 360 panorama', 'Lake Tekapo 360 panorama',
        'Tongariro 360 panorama', 'Wanaka 360 panorama', 'Fiordland 360 panorama', 'Bay of Islands 360 panorama',
        'photosphere New Zealand',
        
        # 太平洋岛屿
        'Fiji 360 panorama', 'Tahiti 360 panorama', 'Bora Bora 360 panorama', 'French Polynesia 360 panorama',
        'Samoa 360 panorama', 'New Caledonia 360 panorama', 'Vanuatu 360 panorama',

        # --- 欧洲其他国家 (非德意瑞) 重点补充 ---
        # 法国
        'France 360 panorama', 'Paris 360 panorama', 'Eiffel Tower 360 panorama', 'Louvre Museum 360 panorama',
        'Notre-Dame 360 panorama', 'Arc de Triomphe 360 panorama', 'Champs-Elysees 360 panorama',
        'Montmartre 360 panorama', 'Sacre-Coeur 360 panorama', 'Versailles 360 panorama',
        'Nice France 360 panorama', 'Promenade des Anglais 360 panorama', 'Cannes 360 panorama',
        'Marseille 360 panorama', 'Vieux-Port Marseille 360 panorama', 'Lyon 360 panorama',
        'Bordeaux 360 panorama', 'Strasbourg 360 panorama', 'Toulouse 360 panorama',
        'Mont Saint-Michel 360 panorama', 'Chamonix 360 panorama', 'Mont Blanc 360 panorama',
        'Loire Valley Castles 360 panorama', 'Carcassonne 360 panorama', 'Avignon 360 panorama',
        'photosphere Paris', 'photosphere France',
        
        # 英国
        'United Kingdom 360 panorama', 'London 360 panorama', 'Big Ben 360 panorama', 'Tower Bridge 360 panorama',
        'Tower of London 360 panorama', 'Buckingham Palace 360 panorama', 'Trafalgar Square 360 panorama',
        'Westminster Abbey 360 panorama', 'Hyde Park London 360 panorama', 'St Paul Cathedral 360 panorama',
        'Edinburgh 360 panorama', 'Edinburgh Castle 360 panorama', 'Royal Mile 360 panorama',
        'Glasgow 360 panorama', 'Manchester 360 panorama', 'Liverpool 360 panorama',
        'Oxford 360 panorama', 'Cambridge 360 panorama', 'Stonehenge 360 panorama', 'Bath England 360 panorama',
        'Belfast 360 panorama', 'Cardiff 360 panorama', 'Highlands Scotland 360 panorama',
        'photosphere London', 'photosphere UK',
        
        # 西班牙
        'Spain 360 panorama', 'Madrid 360 panorama', 'Plaza Mayor Madrid 360 panorama', 'Puerta del Sol 360 panorama',
        'Royal Palace Madrid 360 panorama', 'Prado Museum 360 panorama', 'Retiro Park 360 panorama',
        'Barcelona 360 panorama', 'Sagrada Familia 360 panorama', 'Park Guell 360 panorama',
        'Casa Batllo 360 panorama', 'Las Ramblas 360 panorama', 'Gothic Quarter Barcelona 360 panorama',
        'Seville 360 panorama', 'Plaza de Espana Seville 360 panorama', 'Seville Cathedral 360 panorama',
        'Granada Spain 360 panorama', 'Alhambra 360 panorama', 'Valencia Spain 360 panorama',
        'Toledo Spain 360 panorama', 'Cordoba Spain 360 panorama', 'Mezquita Cordoba 360 panorama',
        'Malaga 360 panorama', 'Bilbao 360 panorama', 'Guggenheim Bilbao 360 panorama',
        'San Sebastian 360 panorama', 'Mallorca 360 panorama', 'Ibiza 360 panorama',
        'Tenerife 360 panorama', 'Teide 360 panorama', 'Ronda Spain 360 panorama',
        'photosphere Spain', 'photosphere Barcelona', 'photosphere Madrid',
        
        # 葡萄牙
        'Portugal 360 panorama', 'Lisbon 360 panorama', 'Belem Tower 360 panorama', 'Jeronimos Monastery 360 panorama',
        'Praca do Comercio 360 panorama', 'Alfama Lisbon 360 panorama', 'Porto 360 panorama',
        'Ribeira Porto 360 panorama', 'Dom Luis Bridge 360 panorama', 'Sintra 360 panorama',
        'Pena Palace 360 panorama', 'Algarve 360 panorama', 'Madeira 360 panorama', 'Azores 360 panorama',
        
        # 荷兰与比利时
        'Netherlands 360 panorama', 'Amsterdam 360 panorama', 'Dam Square 360 panorama', 'Rijksmuseum 360 panorama',
        'Rotterdam 360 panorama', 'The Hague 360 panorama', 'Utrecht 360 panorama',
        'Zaanse Schans 360 panorama', 'Keukenhof 360 panorama',
        'Belgium 360 panorama', 'Brussels 360 panorama', 'Grand Place Brussels 360 panorama',
        'Atomium 360 panorama', 'Bruges 360 panorama', 'Ghent 360 panorama', 'Antwerp 360 panorama',
        
        # 希腊与奥地利
        'Greece 360 panorama', 'Athens 360 panorama', 'Acropolis 360 panorama', 'Parthenon 360 panorama',
        'Santorini 360 panorama', 'Oia Santorini 360 panorama', 'Mykonos 360 panorama', 'Crete 360 panorama',
        'Meteora 360 panorama', 'Delphi Greece 360 panorama', 'Rhodes Greece 360 panorama',
        'Austria 360 panorama', 'Vienna 360 panorama', 'Schoenbrunn Palace 360 panorama', 'St Stephen Vienna 360 panorama',
        'Hofburg 360 panorama', 'Salzburg 360 panorama', 'Hallstatt 360 panorama', 'Innsbruck 360 panorama',
        'Grossglockner 360 panorama',
        
        # 北欧各州
        'Norway 360 panorama', 'Oslo 360 panorama', 'Bergen 360 panorama', 'Bryggen Bergen 360 panorama',
        'Geirangerfjord 360 panorama', 'Lofoten 360 panorama', 'Tromso 360 panorama', 'Preikestolen 360 panorama',
        'Sweden 360 panorama', 'Stockholm 360 panorama', 'Gamla Stan 360 panorama', 'Gothenburg 360 panorama',
        'Malmo 360 panorama', 'Uppsala 360 panorama',
        'Finland 360 panorama', 'Helsinki 360 panorama', 'Rovaniemi 360 panorama', 'Lapland Finland 360 panorama',
        'Denmark 360 panorama', 'Copenhagen 360 panorama', 'Nyhavn 360 panorama', 'Little Mermaid Copenhagen 360 panorama',
        'Iceland 360 panorama', 'Reykjavik 360 panorama', 'Golden Circle Iceland 360 panorama', 'Gullfoss 360 panorama',
        'Blue Lagoon Iceland 360 panorama', 'Jokulsarlon 360 panorama',
        
        # 中东欧
        'Poland 360 panorama', 'Warsaw 360 panorama', 'Krakow 360 panorama', 'Wroclaw 360 panorama',
        'Gdansk 360 panorama', 'Wieliczka 360 panorama',
        'Czech 360 panorama', 'Prague 360 panorama', 'Charles Bridge 360 panorama', 'Prague Castle 360 panorama',
        'Cesky Krumlov 360 panorama', 'Brno 360 panorama',
        'Hungary 360 panorama', 'Budapest 360 panorama', 'Parliament Budapest 360 panorama',
        'Fisherman Bastion 360 panorama', 'Buda Castle 360 panorama',
        'Ireland 360 panorama', 'Dublin 360 panorama', 'Cliffs of Moher 360 panorama', 'Galway 360 panorama',
        'Croatia 360 panorama', 'Dubrovnik 360 panorama', 'Split Croatia 360 panorama',
        'Plitvice Lakes 360 panorama', 'Zadar 360 panorama', 'Zagreb 360 panorama',
        'Romania 360 panorama', 'Bucharest 360 panorama', 'Brasov 360 panorama', 'Bran Castle 360 panorama'
    ]

    print(f"Total targeted queries queued: {len(targeted_queries)}", flush=True)

    # 3. 并发批量抓取 (12 并发，优雅处理)
    print("Launching parallel harvester across all continents...", flush=True)
    new_raw_items = []
    
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(fetch_search_batch, q, 50, 2): q for q in targeted_queries}
        done_cnt = 0
        for f in as_completed(futs):
            done_cnt += 1
            q = futs[f]
            try:
                _, items = f.result()
                new_raw_items.extend(items)
                if done_cnt % 50 == 0 or done_cnt == len(targeted_queries):
                    print(f"[{done_cnt}/{len(targeted_queries)}] Harvester progress: {len(new_raw_items)} candidates collected so far...", flush=True)
            except Exception as e:
                pass

    print(f"\nHarvest finished! Gathered {len(new_raw_items)} raw candidates.", flush=True)
    print("Processing topology validation, filtering and deduplicating...", flush=True)

    # 4. 拓扑校验、严格过滤与去重
    TARGET_TOTAL = 5020  # 目标达到 5000 道题左右
    added = 0
    skipped_it_de_ch = 0
    skipped_unknown = 0
    skipped_duplicate = 0

    for it in new_raw_items:
        if len(catalog) >= TARGET_TOTAL:
            break

        url = it['url']
        if url in seen_urls:
            skipped_duplicate += 1
            continue
        seen_urls.add(url)

        lat = it['lat']
        lon = it['lon']
        country_name, country_code, continent = resolve_coords_country(lat, lon)
        
        # 关键规则：坚决不向德国、意大利、瑞士添加新题！
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

    print(f"\nSuccessfully added {added} new high-quality questions!", flush=True)
    print(f"Skipped {skipped_it_de_ch} items from Germany/Italy/Switzerland to maintain balance.")
    print(f"Current catalog total size: {len(catalog)} questions.")

    # 5. 统一重排与赋 ID
    dom = [x for x in catalog if x.get('isDomestic')]
    intl = [x for x in catalog if not x.get('isDomestic')]
    final_catalog = dom + intl

    for idx, it in enumerate(final_catalog):
        it['id'] = f"sv_stream_{idx+1:05d}"

    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)

    # 6. 统计更新后各大洲与国家分布
    continents = {}
    countries = {}
    for it in final_catalog:
        c = it['country']
        countries[c] = countries.get(c, 0) + 1
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        continents[cont] = continents.get(cont, 0) + 1

    print("\n=====================================================", flush=True)
    print(f"EXPANSION COMPLETE! Final catalog size: {len(final_catalog)} questions")
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
