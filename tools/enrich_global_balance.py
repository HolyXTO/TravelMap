# -*- coding: utf-8 -*-
"""
enrich_global_balance.py
定向抓取全球非欧、非德意瑞的大洲与国家 360° 全景街景：
重点扩充：
- 非洲 (埃及、南非、摩洛哥、肯尼亚、坦桑尼亚、阿尔及利亚等)
- 大洋洲 (澳大利亚、新西兰等)
- 南美洲 (巴西、阿根廷、智利、秘鲁、哥伦比亚、乌拉圭等)
- 北美洲 (美国各州、加拿大、墨西哥等)
- 亚洲 (中国、日本、韩国、泰国、新加坡、马来西亚、印尼、印度、越南、土耳其、阿联酋等)
- 欧洲其他国家 (法国、英国、西班牙、葡萄牙、荷兰、希腊、挪威、瑞典、冰岛、波兰、捷克等)
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import shape, Point

HEADERS = {'User-Agent': 'TravelMapEducational/3.0 (contact@travelmap.app; https://github.com/travelmap)'}

# 1. 下载/加载 Natural Earth 权威多边形
print("Loading Natural Earth country boundaries...")
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
    'AZ': ('阿塞拜疆', 'AZ', '亚洲'), 'GE': ('格鲁吉亚', 'GE', '亚洲'), 'TR': ('土耳其', 'TR', '亚洲'),
    
    'US': ('美国', 'US', '北美洲'), 'CA': ('加拿大', 'CA', '北美洲'), 'MX': ('墨西哥', 'MX', '北美洲'), 'CU': ('古巴', 'CU', '北美洲'),
    'PA': ('巴拿马', 'PA', '北美洲'), 'CR': ('哥斯达黎加', 'CR', '北美洲'),
    
    'BR': ('巴西', 'BR', '南美洲'), 'AR': ('阿根廷', 'AR', '南美洲'), 'CL': ('智利', 'CL', '南美洲'), 'PE': ('秘鲁', 'PE', '南美洲'),
    'CO': ('哥伦比亚', 'CO', '南美洲'), 'UY': ('乌拉圭', 'UY', '南美洲'), 'EC': ('厄瓜多尔', 'EC', '南美洲'), 'BO': ('玻利维亚', 'BO', '南美洲'),
    
    'AU': ('澳大利亚', 'AU', '大洋洲'), 'NZ': ('新西兰', 'NZ', '大洋洲'), 'FJ': ('斐济', 'FJ', '大洋洲'),
    
    'EG': ('埃及', 'EG', '非洲'), 'ZA': ('南非', 'ZA', '非洲'), 'MA': ('摩洛哥', 'MA', '非洲'), 'KE': ('肯尼亚', 'KE', '非洲'),
    'TZ': ('坦桑尼亚', 'TZ', '非洲'), 'NG': ('尼日利亚', 'NG', '非洲'), 'DZ': ('阿尔及利亚', 'DZ', '非洲'), 'LY': ('利比亚', 'LY', '非洲'),
    'TN': ('突尼斯', 'TN', '非洲'), 'NA': ('纳米比亚', 'NA', '非洲'), 'MG': ('马达加斯加', 'MG', '非洲'), 'ET': ('埃塞俄比亚', 'ET', '非洲'),
    
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

def clean_title(title):
    name = re.sub(r'^(File:|Image:)', '', title, flags=re.I)
    name = re.sub(r'\.(jpg|jpeg|png)$', '', name, flags=re.I)
    name = re.sub(r'[\(\[\{].*?[\)\]\}]', '', name)
    name = re.sub(r'360\s*(degree|deg|x180|Kugelpanorama)?|panorama|panosphere|photosphere|equirectangular|groupshot|全景图?|球面', '', name, flags=re.I)
    name = re.sub(r'_\d{3,}_\d{3,}.*', '', name)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    name = re.sub(r'^[^\w\u4e00-\u9fa5]+', '', name)
    name = re.sub(r'[^\w\u4e00-\u9fa5]+$', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name[:38] if name else "特色全景地标"

def fetch_search_batch(query_str, limit=50):
    url = (
        'https://commons.wikimedia.org/w/api.php?action=query'
        f'&generator=search&gsrsearch={urllib.parse.quote(query_str)}'
        f'&gsrnamespace=6&gsrlimit={limit}'
        '&prop=coordinates|imageinfo&iiprop=url&iiurlwidth=3840&format=json'
    )
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=16) as resp:
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

def main():
    print("=====================================================")
    print("   Targeted Global Balance 360 Harvester Starting    ")
    print("=====================================================")

    # 加载现有题库
    with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f"Loaded {len(catalog)} existing questions.")
    seen_urls = set(it['panoUrl'] for it in catalog)

    # 重点定向采集目标大洲与国家的检索词
    targeted_queries = [
        # 1. 非洲 (Africa) 重点补充
        'Egypt 360 panorama', 'Cairo 360 panorama', 'Giza pyramids 360 panorama', 'Luxor 360 panorama',
        'Alexandria 360 panorama', 'South Africa 360 panorama', 'Cape Town 360 panorama', 'Table Mountain 360 panorama',
        'Johannesburg 360 panorama', 'Kruger 360 panorama', 'Morocco 360 panorama', 'Marrakech 360 panorama',
        'Casablanca 360 panorama', 'Fes 360 panorama', 'Chefchaouen 360 panorama', 'Rabat 360 panorama',
        'Kenya 360 panorama', 'Nairobi 360 panorama', 'Tanzania 360 panorama', 'Kilimanjaro 360 panorama',
        'Zanzibar 360 panorama', 'Serengeti 360 panorama', 'Algeria 360 panorama', 'Algiers 360 panorama',
        'Tunisia 360 panorama', 'Tunis 360 panorama', 'Carthage 360 panorama', 'Namibia 360 panorama',
        'Madagascar 360 panorama', 'Nigeria 360 panorama', 'Lagos 360 panorama',

        # 2. 大洋洲 (Oceania) 重点补充
        'Australia 360 panorama', 'Sydney 360 panorama', 'Sydney Opera 360 panorama', 'Melbourne 360 panorama',
        'Brisbane 360 panorama', 'Perth 360 panorama', 'Adelaide 360 panorama', 'Cairns 360 panorama',
        'Great Barrier Reef 360 panorama', 'Gold Coast 360 panorama', 'Uluru 360 panorama',
        'New Zealand 360 panorama', 'Auckland 360 panorama', 'Wellington 360 panorama', 'Queenstown 360 panorama',
        'Christchurch 360 panorama', 'Rotorua 360 panorama', 'Fiji 360 panorama', 'Tahiti 360 panorama',

        # 3. 南美洲 (South America) 重点补充
        'Brazil 360 panorama', 'Rio de Janeiro 360 panorama', 'Sao Paulo 360 panorama', 'Brasilia 360 panorama',
        'Salvador Bahia 360 panorama', 'Iguazu Falls 360 panorama', 'Curitiba 360 panorama',
        'Argentina 360 panorama', 'Buenos Aires 360 panorama', 'Patagonia 360 panorama', 'Bariloche 360 panorama',
        'Mendoza 360 panorama', 'Cordoba Argentina 360 panorama', 'Ushuaia 360 panorama',
        'Chile 360 panorama', 'Santiago Chile 360 panorama', 'Valparaiso 360 panorama', 'Atacama 360 panorama',
        'Torres del Paine 360 panorama', 'Easter Island 360 panorama',
        'Peru 360 panorama', 'Lima 360 panorama', 'Cusco 360 panorama', 'Machu Picchu 360 panorama',
        'Colombia 360 panorama', 'Bogota 360 panorama', 'Medellin 360 panorama', 'Cartagena 360 panorama',
        'Uruguay 360 panorama', 'Montevideo 360 panorama', 'Bolivia 360 panorama', 'Uyuni 360 panorama',
        'Ecuador 360 panorama', 'Quito 360 panorama', 'Galapagos 360 panorama',

        # 4. 北美洲 (North America) 重点补充
        'USA 360 panorama', 'New York 360 panorama', 'Manhattan 360 panorama', 'Brooklyn 360 panorama',
        'Los Angeles 360 panorama', 'Hollywood 360 panorama', 'San Francisco 360 panorama', 'Golden Gate 360 panorama',
        'Chicago 360 panorama', 'Miami 360 panorama', 'Seattle 360 panorama', 'Las Vegas 360 panorama',
        'Washington DC 360 panorama', 'Boston 360 panorama', 'Grand Canyon 360 panorama', 'Yellowstone 360 panorama',
        'Yosemite 360 panorama', 'Hawaii 360 panorama', 'Honolulu 360 panorama', 'Alaska 360 panorama',
        'Texas 360 panorama', 'Houston 360 panorama', 'Austin 360 panorama', 'Florida 360 panorama',
        'Canada 360 panorama', 'Toronto 360 panorama', 'Vancouver 360 panorama', 'Montreal 360 panorama',
        'Banff 360 panorama', 'Niagara Falls 360 panorama', 'Ottawa 360 panorama', 'Quebec City 360 panorama',
        'Mexico 360 panorama', 'Mexico City 360 panorama', 'Cancun 360 panorama', 'Chichen Itza 360 panorama',
        'Guadalajara 360 panorama', 'Oaxaca 360 panorama', 'Havana 360 panorama', 'Costa Rica 360 panorama',
        'Panama 360 panorama',

        # 5. 亚洲 (Asia) 重点补充 (中国名胜 + 亚洲各国)
        'China 360 panorama', 'Beijing 360 panorama', 'Shanghai 360 panorama', 'Guangzhou 360 panorama',
        'Shenzhen 360 panorama', 'Chengdu 360 panorama', 'Hangzhou 360 panorama', 'Xi\'an 360 panorama',
        'Chongqing 360 panorama', 'Wuhan 360 panorama', 'Nanjing 360 panorama', 'Tianjin 360 panorama',
        'Suzhou 360 panorama', 'Guilin 360 panorama', 'Xiamen 360 panorama', 'Qinghai 360 panorama',
        'Tibet 360 panorama', 'Lhasa 360 panorama', 'Xinjiang 360 panorama', 'Urumqi 360 panorama',
        'Yunnan 360 panorama', 'Dali 360 panorama', 'Lijiang 360 panorama', 'Sanya 360 panorama',
        'Great Wall 360 panorama', 'Forbidden City 360 panorama', 'Summer Palace 360 panorama',
        'West Lake 360 panorama', 'Huangshan 360 panorama', 'Jiuzhaigou 360 panorama', 'Zhangjiajie 360 panorama',
        'Hong Kong 360 panorama', 'Victoria Peak 360 panorama', 'Taiwan 360 panorama', 'Taipei 360 panorama',
        'Japan 360 panorama', 'Tokyo 360 panorama', 'Kyoto 360 panorama', 'Osaka 360 panorama',
        'Fuji 360 panorama', 'Hiroshima 360 panorama', 'Nara 360 panorama', 'Hokkaido 360 panorama',
        'Okinawa 360 panorama', 'South Korea 360 panorama', 'Seoul 360 panorama', 'Busan 360 panorama',
        'Jeju 360 panorama', 'Thailand 360 panorama', 'Bangkok 360 panorama', 'Chiang Mai 360 panorama',
        'Phuket 360 panorama', 'Ayutthaya 360 panorama', 'Singapore 360 panorama', 'Malaysia 360 panorama',
        'Kuala Lumpur 360 panorama', 'Penang 360 panorama', 'Indonesia 360 panorama', 'Bali 360 panorama',
        'Jakarta 360 panorama', 'Vietnam 360 panorama', 'Hanoi 360 panorama', 'Saigon 360 panorama',
        'Ha Long Bay 360 panorama', 'Philippines 360 panorama', 'Manila 360 panorama', 'India 360 panorama',
        'Delhi 360 panorama', 'Mumbai 360 panorama', 'Taj Mahal 360 panorama', 'Varanasi 360 panorama',
        'Turkey 360 panorama', 'Istanbul 360 panorama', 'Cappadocia 360 panorama', 'Antalya 360 panorama',
        'Dubai 360 panorama', 'Abu Dhabi 360 panorama', 'Saudi Arabia 360 panorama', 'Riyadh 360 panorama',
        'Israel 360 panorama', 'Jerusalem 360 panorama', 'Tel Aviv 360 panorama', 'Kazakhstan 360 panorama',

        # 6. 欧洲其他国家 (非德意瑞) 重点补充
        'France 360 panorama', 'Paris 360 panorama', 'Eiffel 360 panorama', 'Louvre 360 panorama',
        'Nice France 360 panorama', 'Marseille 360 panorama', 'Lyon 360 panorama', 'Versailles 360 panorama',
        'Mont Saint Michel 360 panorama', 'United Kingdom 360 panorama', 'London 360 panorama',
        'Big Ben 360 panorama', 'Tower Bridge 360 panorama', 'Edinburgh 360 panorama', 'Oxford 360 panorama',
        'Spain 360 panorama', 'Madrid 360 panorama', 'Barcelona 360 panorama', 'Sagrada Familia 360 panorama',
        'Seville 360 panorama', 'Granada Alhambra 360 panorama', 'Valencia 360 panorama', 'Toledo Spain 360 panorama',
        'Portugal 360 panorama', 'Lisbon 360 panorama', 'Porto 360 panorama', 'Sintra 360 panorama',
        'Netherlands 360 panorama', 'Amsterdam 360 panorama', 'Rotterdam 360 panorama',
        'Greece 360 panorama', 'Athens 360 panorama', 'Acropolis 360 panorama', 'Santorini 360 panorama',
        'Meteora 360 panorama', 'Mykonos 360 panorama', 'Crete 360 panorama', 'Austria 360 panorama',
        'Vienna 360 panorama', 'Salzburg 360 panorama', 'Hallstatt 360 panorama', 'Innsbruck 360 panorama',
        'Belgium 360 panorama', 'Brussels 360 panorama', 'Bruges 360 panorama', 'Ghent 360 panorama',
        'Sweden 360 panorama', 'Stockholm 360 panorama', 'Norway 360 panorama', 'Oslo 360 panorama',
        'Bergen 360 panorama', 'Lofoten 360 panorama', 'Geiranger 360 panorama', 'Tromso 360 panorama',
        'Finland 360 panorama', 'Helsinki 360 panorama', 'Lapland 360 panorama', 'Denmark 360 panorama',
        'Copenhagen 360 panorama', 'Iceland 360 panorama', 'Reykjavik 360 panorama', 'Poland 360 panorama',
        'Warsaw 360 panorama', 'Krakow 360 panorama', 'Czech 360 panorama', 'Prague 360 panorama',
        'Cesky Krumlov 360 panorama', 'Hungary 360 panorama', 'Budapest 360 panorama', 'Ireland 360 panorama',
        'Dublin 360 panorama', 'Croatia 360 panorama', 'Dubrovnik 360 panorama', 'Split Croatia 360 panorama',
        'Plitvice 360 panorama', 'Romania 360 panorama', 'Bucharest 360 panorama'
    ]

    print(f"Launching {len(targeted_queries)} parallel harvest queries...")
    new_raw_items = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(fetch_search_batch, q, 50) for q in targeted_queries]
        for f in as_completed(futs):
            _, items = f.result()
            new_raw_items.extend(items)
            
    print(f"Gathered {len(new_raw_items)} candidates. Processing and deduplicating...")

    added = 0
    for it in new_raw_items:
        url = it['url']
        if url in seen_urls: continue
        seen_urls.add(url)

        lat = it['lat']
        lon = it['lon']
        country_name, country_code, continent = resolve_coords_country(lat, lon)
        if country_name == '海外名胜' and country_code == 'INTL':
            continue # 跳过无法精确定位的点

        clean_city = clean_title(it['title'])
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

    print(f"Added {added} high-quality, geographically validated new questions!")

    # 重新编排标准 ID 与排序：国内在前，国外在后
    dom = [x for x in catalog if x['isDomestic']]
    intl = [x for x in catalog if not x['isDomestic']]
    final_catalog = dom + intl

    for idx, it in enumerate(final_catalog):
        it['id'] = f"sv_stream_{idx+1:05d}"

    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)

    # 统计更新后各大洲与国家分布
    continents = {}
    countries = {}
    for it in final_catalog:
        c = it['country']
        countries[c] = countries.get(c, 0) + 1
        # 大洲
        pt = Point(it['lng'], it['lat'])
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        continents[cont] = continents.get(cont, 0) + 1

    print("\n=====================================================")
    print(f"HARVEST SUCCESS! Total catalog size: {len(final_catalog)} questions")
    print("CONTINENT BREAKDOWN:")
    for cont, count in sorted(continents.items(), key=lambda x: -x[1]):
        print(f"  - {cont}: {count} 题")
    print("\nTOP 25 COUNTRIES:")
    for c, count in sorted(countries.items(), key=lambda x: -x[1])[:25]:
        print(f"  - {c}: {count} 题")
    print(f"File size: {os.path.getsize(out_file) / 1024:.1f} KB")
    print("=====================================================")

if __name__ == '__main__':
    main()
