# -*- coding: utf-8 -*-
"""
final_enrich_targets.py
精准冲刺：
1. 非洲冲刺至 >= 505 题
2. 大洋洲冲刺至 >= 205 题
3. 欧洲冷门/中小国家（立陶宛、保加利亚、塞尔维亚、斯洛文尼亚、斯洛伐克、乌克兰、罗马尼亚、爱尔兰、克罗地亚、挪威、丹麦、芬兰、爱沙尼亚、拉脱维亚、匈牙利、波黑、黑山等）针对性大补充
4. 严格杜绝德意瑞（DE/IT/CH 不增一题）
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import shape, Point

HEADERS = {'User-Agent': 'TravelMapAcademicGeography/6.0 (educational geoguessr game; contact: research@travelmap.app)'}

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
    'PY': ('巴拉圭', 'PY', '南美洲'), 'VE': ('委内瑞拉', 'VE', '南美洲'), 'GY': ('圭亚那', 'GY', '南美洲'), 'SR': ('苏里南', 'SR', '南美洲'),
    
    'AU': ('澳大利亚', 'AU', '大洋洲'), 'NZ': ('新西兰', 'NZ', '大洋洲'), 'FJ': ('斐济', 'FJ', '大洋洲'), 'PF': ('法属波利尼西亚', 'PF', '大洋洲'),
    'NC': ('新喀里多尼亚', 'NC', '大洋洲'), 'PG': ('巴布亚新几内亚', 'PG', '大洋洲'), 'WS': ('萨摩亚', 'WS', '大洋洲'), 'VU': ('瓦努阿图', 'VU', '大洋洲'),
    'TO': ('汤加', 'TO', '大洋洲'), 'CK': ('库克群岛', 'CK', '大洋洲'), 'GU': ('关岛', 'GU', '大洋洲'),
    
    'EG': ('埃及', 'EG', '非洲'), 'ZA': ('南非', 'ZA', '非洲'), 'MA': ('摩洛哥', 'MA', '非洲'), 'KE': ('肯尼亚', 'KE', '非洲'),
    'TZ': ('坦桑尼亚', 'TZ', '非洲'), 'NG': ('尼日利亚', 'NG', '非洲'), 'DZ': ('阿尔及利亚', 'DZ', '非洲'), 'LY': ('利比亚', 'LY', '非洲'),
    'TN': ('突尼斯', 'TN', '非洲'), 'NA': ('纳米比亚', 'NA', '非洲'), 'MG': ('马达加斯加', 'MG', '非洲'), 'ET': ('埃塞俄比亚', 'ET', '非洲'),
    'GH': ('加纳', 'GH', '非洲'), 'SN': ('塞内加尔', 'SN', '非洲'), 'UG': ('乌干达', 'UG', '非洲'), 'ZW': ('津巴布韦', 'ZW', '非洲'),
    'BW': ('博茨瓦纳', 'BW', '非洲'), 'MU': ('毛里求斯', 'MU', '非洲'), 'SC': ('塞舌尔', 'SC', '非洲'), 'ZM': ('赞比亚', 'ZM', '非洲'),
    'RW': ('卢旺达', 'RW', '非洲'), 'CV': ('佛得角', 'CV', '非洲'), 'MZ': ('莫桑比克', 'MZ', '非洲'),
    
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
    'ME': ('黑山', 'ME', '欧洲'), 'AL': ('阿尔巴尼亚', 'AL', '欧洲'), 'MK': ('马其顿', 'MK', '欧洲'), 'MD': ('摩尔多瓦', 'MD', '欧洲'),
    'AD': ('安道尔', 'AD', '欧洲'), 'LI': ('列支敦士登', 'LI', '欧洲')
}

NAME_TO_CN = {
    'China': ('中国', 'CHN', '亚洲'), 'Taiwan': ('中国', 'CHN', '亚洲'), 'Hong Kong': ('中国', 'CHN', '亚洲'),
    'Japan': ('日本', 'JP', '亚洲'), 'South Korea': ('韩国', 'KR', '亚洲'), 'Thailand': ('泰国', 'TH', '亚洲'),
    'Singapore': ('新加坡', 'SG', '亚洲'), 'Malaysia': ('马来西亚', 'MY', '亚洲'), 'Indonesia': ('印度尼西亚', 'ID', '亚洲'),
    'India': ('印度', 'IN', '亚洲'), 'Philippines': ('菲律宾', 'PH', '亚洲'), 'Vietnam': ('越南', 'VN', '亚洲'),
    'United States': ('美国', 'US', '北美洲'), 'Canada': ('加拿大', 'CA', '北美洲'), 'Mexico': ('墨西哥', 'MX', '北美洲'),
    'Brazil': ('巴西', 'BR', '南美洲'), 'Argentina': ('阿根廷', 'AR', '南美洲'), 'Chile': ('智利', 'CL', '南美洲'),
    'Peru': ('秘鲁', 'PE', '南美洲'), 'Colombia': ('哥伦比亚', 'CO', '南美洲'), 'Uruguay': ('乌拉圭', 'UY', '南美洲'),
    'Bolivia': ('玻利维亚', 'BO', '南美洲'), 'Ecuador': ('厄瓜多尔', 'EC', '南美洲'), 'Paraguay': ('巴拉圭', 'PY', '南美洲'),
    'Australia': ('澳大利亚', 'AU', '大洋洲'), 'New Zealand': ('新西兰', 'NZ', '大洋洲'), 'Fiji': ('斐济', 'FJ', '大洋洲'),
    'Egypt': ('埃及', 'EG', '非洲'), 'South Africa': ('南非', 'ZA', '非洲'), 'Morocco': ('摩洛哥', 'MA', '非洲'),
    'Kenya': ('肯尼亚', 'KE', '非洲'), 'Tanzania': ('坦桑尼亚', 'TZ', '非洲'), 'Algeria': ('阿尔及利亚', 'DZ', '非洲'),
    'Tunisia': ('突尼斯', 'TN', '非洲'), 'Nigeria': ('尼日利亚', 'NG', '非洲'), 'Namibia': ('纳米比亚', 'NA', '非洲'),
    'Madagascar': ('马达加斯加', 'MG', '非洲'), 'Ethiopia': ('埃塞俄比亚', 'ET', '非洲'), 'Uganda': ('乌干达', 'UG', '非洲'),
    'France': ('法国', 'FR', '欧洲'), 'United Kingdom': ('英国', 'GB', '欧洲'), 'Spain': ('西班牙', 'ES', '欧洲'),
    'Portugal': ('葡萄牙', 'PT', '欧洲'), 'Netherlands': ('荷兰', 'NL', '欧洲'), 'Greece': ('希腊', 'GR', '欧洲'),
    'Austria': ('奥地利', 'AT', '欧洲'), 'Belgium': ('比利时', 'BE', '欧洲'), 'Sweden': ('瑞典', 'SE', '欧洲'),
    'Norway': ('挪威', 'NO', '欧洲'), 'Finland': ('芬兰', 'FI', '欧洲'), 'Denmark': ('丹麦', 'DK', '欧洲'),
    'Iceland': ('冰岛', 'IS', '欧洲'), 'Poland': ('波兰', 'PL', '欧洲'), 'Czech Republic': ('捷克', 'CZ', '欧洲'),
    'Hungary': ('匈牙利', 'HU', '欧洲'), 'Ireland': ('爱尔兰', 'IE', '欧洲'), 'Croatia': ('克罗地亚', 'HR', '欧洲'),
    'Romania': ('罗马尼亚', 'RO', '欧洲'), 'Bulgaria': ('保加利亚', 'BG', '欧洲'), 'Slovakia': ('斯洛伐克', 'SK', '欧洲'),
    'Slovenia': ('斯洛文尼亚', 'SI', '欧洲'), 'Serbia': ('塞尔维亚', 'RS', '欧洲'), 'Belarus': ('白俄罗斯', 'BY', '欧洲'),
    'Ukraine': ('乌克兰', 'UA', '欧洲'), 'Estonia': ('爱沙尼亚', 'EE', '欧洲'), 'Latvia': ('拉脱维亚', 'LV', '欧洲'),
    'Lithuania': ('立陶宛', 'LT', '欧洲'), 'Bosnia and Herzegovina': ('波斯尼亚和黑塞哥维那', 'BA', '欧洲'),
    'Montenegro': ('黑山', 'ME', '欧洲'), 'Albania': ('阿尔巴尼亚', 'AL', '欧洲')
}

def resolve_coords_country(lat, lon):
    pt = Point(lon, lat)
    for s in shapes:
        if s['geom'].contains(pt):
            iso = s['iso_a2']
            if iso in ISO_TO_CN: return ISO_TO_CN[iso]
            if s['name'] in NAME_TO_CN: return NAME_TO_CN[s['name']]
            
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
        if country == '立陶宛': return '维尔纽斯 · 城市街景'
        if country == '保加利亚': return '索菲亚 · 城市街景'
        if country == '塞尔维亚': return '贝尔格莱德 · 城市街景'
        if country == '斯洛文尼亚': return '卢布尔雅那 · 城市街景'
        if country == '斯洛伐克': return '布拉迪斯拉发 · 城市街景'
        if country == '乌克兰': return '基辅 · 城市街景'
        if country == '白俄罗斯': return '明斯克 · 城市街景'
        if country == '波黑': return '萨拉热窝 · 城市街景'
        if country == '黑山': return '科托尔 · 城市街景'
        if country == '阿尔巴尼亚': return '地拉那 · 城市街景'
        if country == '爱尔兰': return '都柏林 · 城市街景'
        if country == '克罗地亚': return '杜布罗夫尼克 · 城市街景'
        if country == '罗马尼亚': return '布加勒斯特 · 城市街景'
        if country == '比利时': return '布鲁塞尔 · 城市街景'
        if country == '芬兰': return '赫尔辛基 · 城市街景'
        if country == '丹麦': return '哥本哈根 · 城市街景'
        if country == '挪威': return '奥斯陆 · 城市街景'
        if country == '匈牙利': return '布达佩斯 · 城市街景'
        if country == '爱沙尼亚': return '塔林 · 城市街景'
        if country == '拉脱维亚': return '里加 · 城市街景'
        if country == '澳大利亚': return '澳大利亚 · 城市街景'
        if country == '新西兰': return '新西兰 · 城市街景'
        if country == '南非': return '开普敦 · 城市街景'
        if country == '埃及': return '开罗 · 城市街景'
        if country == '摩洛哥': return '马拉喀什 · 城市街景'
        if country == '肯尼亚': return '内罗毕 · 城市街景'
        return f"{country} · 城市街景"

    if len(name) > 28:
        name = name[:28].rstrip()
    return name if len(name) >= 2 else f"{country} · 特色全景地标"

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
    post_payload = urllib.parse.urlencode({
        'action': 'query',
        'titles': '|'.join(titles_chunk),
        'prop': 'coordinates|imageinfo',
        'iiprop': 'url|extmetadata',
        'iiurlwidth': '3840',
        'format': 'json'
    }).encode('utf-8')
    url = 'https://commons.wikimedia.org/w/api.php'
    res = []
    try:
        req = urllib.request.Request(url, data=post_payload, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=18) as resp:
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
                        'title': p.get('title', ''),
                        'lat': float(lat),
                        'lon': float(lon),
                        'url': thumb
                    })
            except Exception:
                continue
        return res
    except Exception as e:
        print(f"Batch resolve error: {e}", flush=True)
        return []

def main():
    print("=====================================================", flush=True)
    print("   Final Precision Enrichment Harvester Starting     ", flush=True)
    print("=====================================================", flush=True)

    with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f"Loaded {len(catalog)} existing questions from catalog.", flush=True)
    seen_urls = set(it['panoUrl'] for it in catalog)

    queries = [
        # --- 1. 非洲冲刺 (目标 >= 505) ---
        'Egypt panorama', 'Cairo panorama', 'Alexandria panorama', 'Luxor panorama', 'Aswan panorama',
        'Giza panorama', 'Pyramids panorama', 'Karnak panorama', 'Red Sea panorama', 'Sharm panorama',
        'South Africa panorama', 'Cape Town panorama', 'Johannesburg panorama', 'Durban panorama',
        'Pretoria panorama', 'Table Mountain panorama', 'Garden Route panorama', 'Kruger panorama',
        'Morocco panorama', 'Marrakech panorama', 'Casablanca panorama', 'Fes panorama', 'Rabat panorama',
        'Tangier panorama', 'Chefchaouen panorama', 'Essaouira panorama', 'Sahara panorama',
        'Kenya panorama', 'Nairobi panorama', 'Mombasa panorama', 'Masai Mara panorama',
        'Tanzania panorama', 'Zanzibar panorama', 'Kilimanjaro panorama', 'Serengeti panorama', 'Ngorongoro panorama',
        'Algeria panorama', 'Algiers panorama', 'Oran panorama', 'Tunisia panorama', 'Tunis panorama', 'Carthage panorama',
        'Nigeria panorama', 'Lagos panorama', 'Abuja panorama', 'Ghana panorama', 'Accra panorama',
        'Senegal panorama', 'Dakar panorama', 'Namibia panorama', 'Windhoek panorama', 'Etosha panorama',
        'Madagascar panorama', 'Antananarivo panorama', 'Ethiopia panorama', 'Addis Ababa panorama',
        'Uganda panorama', 'Rwanda panorama', 'Kigali panorama', 'Victoria Falls panorama',

        # --- 2. 大洋洲冲刺 (目标 >= 205) ---
        'Australia panorama', 'Sydney panorama', 'Melbourne panorama', 'Brisbane panorama', 'Perth panorama',
        'Adelaide panorama', 'Gold Coast panorama', 'Cairns panorama', 'Canberra panorama', 'Hobart panorama',
        'Uluru panorama', 'Darwin panorama', 'Great Barrier Reef panorama', 'Twelve Apostles panorama',
        'Bondi panorama', 'Tasmania panorama', 'Queensland panorama', 'Byron Bay panorama',
        'New Zealand panorama', 'Auckland panorama', 'Wellington panorama', 'Queenstown panorama',
        'Christchurch panorama', 'Rotorua panorama', 'Milford Sound panorama', 'Mount Cook panorama',
        'Hobbiton panorama', 'Wanaka panorama', 'Fiordland panorama', 'Taupo panorama',
        'Fiji panorama', 'Tahiti panorama', 'Bora Bora panorama', 'Samoa panorama', 'New Caledonia panorama',
        'Vanuatu panorama', 'Guam panorama', 'Cook Islands panorama',

        # --- 3. 欧洲冷门/中小国家定向冲刺 ---
        # 立陶宛、保加利亚、塞尔维亚、斯洛文尼亚、斯洛伐克、乌克兰、白俄罗斯、波黑、黑山、阿尔巴尼亚
        'Vilnius 360', 'Vilnius panorama', 'Lithuania panorama', 'Lithuania 360', 'Kaunas panorama', 'Trakai panorama',
        'Sofia 360', 'Sofia panorama', 'Bulgaria panorama', 'Bulgaria 360', 'Plovdiv panorama', 'Varna panorama',
        'Belgrade 360', 'Belgrade panorama', 'Serbia panorama', 'Serbia 360', 'Novi Sad panorama',
        'Ljubljana 360', 'Ljubljana panorama', 'Slovenia panorama', 'Slovenia 360', 'Bled panorama', 'Postojna panorama',
        'Bratislava 360', 'Bratislava panorama', 'Slovakia panorama', 'Slovakia 360', 'High Tatras panorama', 'Kosice panorama',
        'Kyiv 360', 'Kyiv panorama', 'Ukraine panorama', 'Ukraine 360', 'Lviv panorama', 'Odesa panorama',
        'Minsk 360', 'Minsk panorama', 'Belarus panorama', 'Belarus 360', 'Brest Belarus panorama',
        'Sarajevo 360', 'Sarajevo panorama', 'Bosnia panorama', 'Mostar panorama',
        'Kotor 360', 'Kotor panorama', 'Montenegro panorama', 'Budva panorama',
        'Tirana 360', 'Tirana panorama', 'Albania panorama', 'Berat panorama',
        
        # 罗马尼亚、爱尔兰、克罗地亚、匈牙利、波罗的海
        'Bucharest 360', 'Bucharest panorama', 'Romania panorama', 'Romania 360', 'Brasov panorama', 'Transylvania panorama',
        'Dublin 360', 'Dublin panorama', 'Ireland panorama', 'Ireland 360', 'Cliffs of Moher panorama', 'Galway panorama',
        'Dubrovnik 360', 'Dubrovnik panorama', 'Croatia panorama', 'Croatia 360', 'Split panorama', 'Plitvice panorama',
        'Zagreb 360', 'Zagreb panorama', 'Zadar panorama', 'Hvar panorama',
        'Budapest 360', 'Budapest panorama', 'Hungary panorama', 'Hungary 360', 'Balaton panorama',
        'Tallinn 360', 'Tallinn panorama', 'Estonia panorama', 'Estonia 360', 'Tartu panorama',
        'Riga 360', 'Riga panorama', 'Latvia panorama', 'Latvia 360', 'Jurmala panorama',
        
        # 挪威、丹麦、芬兰、比利时、冰岛
        'Oslo 360', 'Oslo panorama', 'Norway panorama', 'Norway 360', 'Bergen panorama', 'Lofoten panorama', 'Tromso panorama',
        'Copenhagen 360', 'Copenhagen panorama', 'Denmark panorama', 'Denmark 360', 'Aarhus panorama',
        'Helsinki 360', 'Helsinki panorama', 'Finland panorama', 'Finland 360', 'Lapland panorama', 'Rovaniemi panorama',
        'Brussels 360', 'Brussels panorama', 'Belgium panorama', 'Belgium 360', 'Bruges panorama', 'Ghent panorama', 'Antwerp panorama',
        'Reykjavik 360', 'Reykjavik panorama', 'Iceland panorama', 'Iceland 360', 'Gullfoss panorama'
    ]

    print(f"Phase 1: Querying {len(queries)} precision search queries...", flush=True)
    all_titles = set()
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(fetch_search_titles, q, 50) for q in queries]
        for f in as_completed(futs):
            all_titles.update(f.result())

    print(f"Phase 1 Complete! Collected {len(all_titles)} unique candidate titles.", flush=True)

    title_list = list(all_titles)
    chunks = [title_list[i:i+50] for i in range(0, len(title_list), 50)]
    print(f"Phase 2: Resolving GPS & 4K thumbs in {len(chunks)} parallel batches...", flush=True)

    resolved_candidates = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(resolve_batch_coords_and_thumbs, c) for c in chunks]
        for idx, f in enumerate(as_completed(futs), 1):
            batch_res = f.result()
            resolved_candidates.extend(batch_res)
            if idx % 15 == 0 or idx == len(chunks):
                print(f"[{idx}/{len(chunks)}] Resolved {len(resolved_candidates)} items with valid GPS...", flush=True)

    print(f"\nPhase 2 Complete! Total valid items with GPS: {len(resolved_candidates)}", flush=True)
    print("Phase 3: Precision Target Injections...", flush=True)

    cont_counts = {'欧洲': 0, '亚洲': 0, '北美洲': 0, '南美洲': 0, '非洲': 0, '大洋洲': 0, '其他': 0}
    for it in catalog:
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        cont_counts[cont] = cont_counts.get(cont, 0) + 1

    AFRICA_TARGET = 525
    OCEANIA_TARGET = 225

    COLD_EU_ALLOWED = {
        '立陶宛', '保加利亚', '塞尔维亚', '斯洛文尼亚', '斯洛伐克', '乌克兰', '白俄罗斯',
        '波斯尼亚和黑塞哥维那', '黑山', '阿尔巴尼亚', '爱尔兰', '克罗地亚', '罗马尼亚',
        '匈牙利', '爱沙尼亚', '拉脱维亚', '挪威', '丹麦', '芬兰', '比利时', '冰岛',
        '摩尔多瓦', '北马其顿', '塞浦路斯', '卢森堡', '马耳他'
    }

    added = 0
    added_by_country = {}

    for it in resolved_candidates:
        url = it['url']
        if url in seen_urls:
            continue

        lat = it['lat']
        lon = it['lon']
        country_name, country_code, continent = resolve_coords_country(lat, lon)

        # 坚决不加德意瑞
        if country_name in ['德国', '意大利', '瑞士']:
            continue

        if country_name == '海外名胜' and country_code == 'INTL':
            continue

        curr_cont = cont_counts.get(continent, 0)

        # 配额控制
        if continent == '非洲':
            if curr_cont >= AFRICA_TARGET:
                continue
        elif continent == '大洋洲':
            if curr_cont >= OCEANIA_TARGET:
                continue
        elif continent == '欧洲':
            # 只注入冷门中小国家
            if country_name not in COLD_EU_ALLOWED:
                continue
        elif continent in ['亚洲', '北美洲', '南美洲']:
            # 南美洲已满 515，亚北美也已有较多，此处不扩充
            continue

        seen_urls.add(url)
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

        cont_counts[continent] = cont_counts.get(continent, 0) + 1
        added += 1
        added_by_country[country_name] = added_by_country.get(country_name, 0) + 1

    print(f"\nAdded {added} precision targeted questions across regions!", flush=True)

    # 排序重排
    dom = [x for x in catalog if x.get('isDomestic')]
    intl = [x for x in catalog if not x.get('isDomestic')]
    final_catalog = dom + intl

    for idx, it in enumerate(final_catalog):
        it['id'] = f"sv_stream_{idx+1:05d}"

    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)

    # 统计更新后各大洲与国家
    continents = {}
    countries = {}
    for it in final_catalog:
        c = it['country']
        countries[c] = countries.get(c, 0) + 1
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        continents[cont] = continents.get(cont, 0) + 1

    print("\n=====================================================", flush=True)
    print(f"FINAL PRECISION SUCCESS! Total questions: {len(final_catalog)}")
    print("CONTINENT BREAKDOWN (大洲分布):")
    for cont, count in sorted(continents.items(), key=lambda x: -x[1]):
        pct = (count / len(final_catalog)) * 100
        print(f"  - {cont}: {count} 题 ({pct:.1f}%)")
    print("\nUNDERREPRESENTED TARGETED COUNTRIES BREAKDOWN:")
    target_check = ['比利时', '芬兰', '丹麦', '挪威', '匈牙利', '爱沙尼亚', '拉脱维亚', '立陶宛',
                    '克罗地亚', '爱尔兰', '罗马尼亚', '乌克兰', '斯洛伐克', '斯洛文尼亚', '塞尔维亚',
                    '白俄罗斯', '保加利亚', '波斯尼亚和黑塞哥维那', '黑山', '阿尔巴尼亚', '冰岛',
                    '巴西', '阿根廷', '智利', '秘鲁', '哥伦比亚', '厄瓜多尔', '玻利维亚', '乌拉圭',
                    '南非', '埃及', '摩洛哥', '肯尼亚', '坦桑尼亚', '阿尔及利亚', '突尼斯', '尼日利亚',
                    '澳大利亚', '新西兰', '斐济']
    for c in target_check:
        print(f"  - {c}: {countries.get(c, 0)} 题")
    print("=====================================================", flush=True)

if __name__ == '__main__':
    main()
