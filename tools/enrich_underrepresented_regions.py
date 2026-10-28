# -*- coding: utf-8 -*-
"""
enrich_underrepresented_regions.py
专项大扩充：解决南美洲、非洲、大洋洲和欧洲冷门中小国家题量不足的问题：
1. 南美洲目标题量提升至 >= 500 题
2. 非洲目标题量提升至 >= 500 题
3. 大洋洲目标题量提升至 >= 200 题
4. 欧洲冷门/中小国家（比利时、芬兰、丹麦、挪威、匈牙利、波罗的海三小国、克罗地亚、爱尔兰、罗马尼亚、乌克兰、斯洛伐克、斯洛文尼亚、塞尔维亚、白俄罗斯、保加利亚等）全面补齐
5. 坚决不向德国、意大利、瑞士添加任何一道新题
6. 实时清洗地名，保障地名美观精炼（<= 28字），拓扑坐标精准映射
"""
import urllib.request
import urllib.parse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import shape, Point

HEADERS = {'User-Agent': 'TravelMapAcademicGeography/5.0 (educational geoguessr game; contact: research@travelmap.app)'}

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
        if country == '比利时': return '布鲁塞尔 · 城市街景'
        if country == '芬兰': return '赫尔辛基 · 城市街景'
        if country == '丹麦': return '哥本哈根 · 城市街景'
        if country == '挪威': return '奥斯陆 · 城市街景'
        if country == '匈牙利': return '布达佩斯 · 城市街景'
        if country == '爱沙尼亚': return '塔林 · 城市街景'
        if country == '拉脱维亚': return '里加 · 城市街景'
        if country == '立陶宛': return '维尔纽斯 · 城市街景'
        if country == '克罗地亚': return '杜布罗夫尼克 · 城市街景'
        if country == '爱尔兰': return '都柏林 · 城市街景'
        if country == '罗马尼亚': return '布加勒斯特 · 城市街景'
        if country == '乌克兰': return '基辅 · 城市街景'
        if country == '斯洛伐克': return '布拉迪斯拉发 · 城市街景'
        if country == '斯洛文尼亚': return '卢布尔雅那 · 城市街景'
        if country == '塞尔维亚': return '贝尔格莱德 · 城市街景'
        if country == '白俄罗斯': return '明斯克 · 城市街景'
        if country == '保加利亚': return '索菲亚 · 城市街景'
        if country == '巴西': return '巴西 · 城市街景'
        if country == '阿根廷': return '阿根廷 · 城市街景'
        if country == '智利': return '智利 · 城市街景'
        if country == '秘鲁': return '秘鲁 · 城市街景'
        if country == '哥伦比亚': return '哥伦比亚 · 城市街景'
        if country == '澳大利亚': return '澳大利亚 · 城市街景'
        if country == '新西兰': return '新西兰 · 城市街景'
        if country == '南非': return '开普敦 · 城市街景'
        if country == '埃及': return '开罗 · 城市街景'
        if country == '摩洛哥': return '马拉喀什 · 城市街景'
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
    print("   Enriching Underrepresented Regions Harvester      ", flush=True)
    print("=====================================================", flush=True)

    with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f"Loaded {len(catalog)} existing questions from catalog.", flush=True)
    seen_urls = set(it['panoUrl'] for it in catalog)

    # 重点大区专项搜索词 (近 500 个细分地区与著名地标检索词)
    targeted_queries = [
        # --- 1. 南美洲专项 (目标 >= 500) ---
        # 巴西各州与名城
        'Rio de Janeiro 360', 'Sao Paulo 360', 'Brasilia 360', 'Salvador Bahia 360', 'Fortaleza 360',
        'Belo Horizonte 360', 'Manaus 360', 'Curitiba 360', 'Recife 360', 'Porto Alegre 360',
        'Iguazu 360', 'Foz do Iguacu 360', 'Florianopolis 360', 'Natal Brazil 360', 'Maceio 360',
        'Goiania 360', 'Belem 360', 'Santos Brazil 360', 'Campinas 360', 'Ouro Preto 360',
        'Petropolis 360', 'Paraty 360', 'Niteroi 360', 'Gramado 360', 'Balneario Camboriu 360',
        'Vitoria Brazil 360', 'Pantanal 360', 'Fernando de Noronha 360', 'Olinda 360', 'Tiradentes 360',
        'Copacabana 360', 'Ipanema 360', 'Corcovado 360', 'Sugarloaf 360', 'Maracana 360',
        'Chapada Diamantina 360', 'Lencois Maranhenses 360', 'Amazonas 360', 'photosphere Brazil',
        
        # 阿根廷
        'Buenos Aires 360', 'Cordoba Argentina 360', 'Rosario Argentina 360', 'Mendoza Argentina 360',
        'Bariloche 360', 'Ushuaia 360', 'Salta 360', 'Jujuy 360', 'Iguazu Argentina 360',
        'Perito Moreno 360', 'El Calafate 360', 'La Plata 360', 'Mar del Plata 360', 'San Juan Argentina 360',
        'Tucuman 360', 'Neuquen 360', 'Patagonia Argentina 360', 'San Rafael Argentina 360',
        'Puerto Madryn 360', 'Villa La Angostura 360', 'El Chalten 360', 'Tigre Argentina 360',
        'Plaza de Mayo 360', 'La Boca 360', 'Recoleta 360', 'photosphere Argentina',
        
        # 智利
        'Santiago Chile 360', 'Valparaiso 360', 'Vina del Mar 360', 'Atacama 360', 'San Pedro de Atacama 360',
        'Torres del Paine 360', 'Easter Island 360', 'Rapa Nui 360', 'Puerto Montt 360', 'Punta Arenas 360',
        'Antofagasta 360', 'Iquique 360', 'La Serena 360', 'Concepcion Chile 360', 'Arica Chile 360',
        'Chiloe 360', 'Patagonia Chile 360', 'Valdivia 360', 'Temuco 360', 'Lake Llanquihue 360',
        
        # 秘鲁
        'Lima Peru 360', 'Cusco 360', 'Machu Picchu 360', 'Arequipa 360', 'Lake Titicaca Peru 360',
        'Sacred Valley Peru 360', 'Colca Canyon 360', 'Huacachina 360', 'Nazca 360', 'Puno 360',
        'Trujillo Peru 360', 'Iquitos 360', 'Paracas 360', 'Cajamarca 360', 'Ayacucho 360',
        'Chiclayo 360', 'Huaraz 360', 'Ollantaytambo 360', 'Pisac 360', 'Miraflores 360',
        
        # 哥伦比亚
        'Bogota 360', 'Medellin 360', 'Cartagena Colombia 360', 'Cali Colombia 360', 'Santa Marta 360',
        'Barranquilla 360', 'Salento Colombia 360', 'Guatape 360', 'Coffee Colombia 360',
        'San Andres Colombia 360', 'Bucaramanga 360', 'Pereira Colombia 360', 'Manizales 360',
        'Villa de Leyva 360', 'Tayrona 360', 'Popayan 360', 'Monserrate 360',
        
        # 厄瓜多尔、玻利维亚、乌拉圭、巴拉圭
        'Quito 360', 'Cuenca Ecuador 360', 'Galapagos 360', 'Cotopaxi 360', 'Guayaquil 360',
        'Banos Ecuador 360', 'Otavalo 360', 'Montanita 360', 'Uyuni 360', 'La Paz Bolivia 360',
        'Sucre Bolivia 360', 'Potosi 360', 'Cochabamba 360', 'Santa Cruz Bolivia 360',
        'Lake Titicaca Bolivia 360', 'Montevideo 360', 'Punta del Este 360', 'Colonia del Sacramento 360',
        'Asuncion 360', 'Caracas 360',

        # --- 2. 非洲专项 (目标 >= 500) ---
        # 埃及
        'Egypt 360', 'Cairo 360', 'Giza 360', 'Pyramids 360', 'Luxor 360', 'Karnak 360',
        'Aswan 360', 'Alexandria Egypt 360', 'Abu Simbel 360', 'Sinai 360', 'Red Sea 360',
        'Hurghada 360', 'Sharm 360', 'Dahab 360', 'Saqqara 360', 'Edfu 360', 'Kom Ombo 360',
        'Valley of the Kings 360', 'Sphinx 360', 'photosphere Egypt',
        
        # 南非
        'South Africa 360', 'Cape Town 360', 'Table Mountain 360', 'Cape Point 360', 'Cape of Good Hope 360',
        'Johannesburg 360', 'Durban 360', 'Pretoria 360', 'Kruger 360', 'Garden Route 360',
        'Stellenbosch 360', 'Franschhoek 360', 'Boulders Beach 360', 'Drakensberg 360',
        'Robben Island 360', 'Hermanus 360', 'Port Elizabeth 360', 'Knysna 360', 'Plettenberg 360',
        'Pilanesberg 360', 'Blyde River 360', 'Soweto 360', 'Bloemfontein 360', 'Oudtshoorn 360',
        
        # 摩洛哥
        'Morocco 360', 'Maroc 360', 'Marrakech 360', 'Casablanca 360', 'Fes 360', 'Chefchaouen 360',
        'Rabat 360', 'Tangier 360', 'Essaouira 360', 'Sahara Morocco 360', 'Merzouga 360',
        'Ait Benhaddou 360', 'Ouarzazate 360', 'Agadir 360', 'Meknes 360', 'Volubilis 360',
        'Dades 360', 'Todra 360', 'Jemaa el-Fnaa 360', 'Hassan II Mosque 360',
        
        # 东非与肯尼亚/坦桑尼亚
        'Kenya 360', 'Nairobi 360', 'Mombasa 360', 'Masai Mara 360', 'Amboseli 360', 'Nakuru 360',
        'Tsavo 360', 'Naivasha 360', 'Diani Beach 360', 'Malindi 360', 'Tanzania 360',
        'Zanzibar 360', 'Stone Town 360', 'Kilimanjaro 360', 'Serengeti 360', 'Ngorongoro 360',
        'Arusha 360', 'Dar es Salaam 360', 'Tarangire 360', 'Lake Manyara 360',
        
        # 北非、中南非各国
        'Algeria 360', 'Algiers 360', 'Oran 360', 'Constantine Algeria 360', 'Timgad 360',
        'Tunisia 360', 'Tunis 360', 'Carthage 360', 'Sidi Bou Said 360', 'Djerba 360',
        'El Djem 360', 'Sousse 360', 'Nigeria 360', 'Lagos 360', 'Abuja 360',
        'Ghana 360', 'Accra 360', 'Cape Coast 360', 'Senegal 360', 'Dakar 360', 'Goree 360',
        'Namibia 360', 'Sossusvlei 360', 'Etosha 360', 'Swakopmund 360', 'Windhoek 360',
        'Madagascar 360', 'Antananarivo 360', 'Nosy Be 360', 'Victoria Falls 360', 'Zimbabwe 360',
        'Harare 360', 'Zambia 360', 'Livingstone 360', 'Botswana 360', 'Okavango 360', 'Chobe 360',
        'Uganda 360', 'Kampala 360', 'Rwanda 360', 'Kigali 360', 'Ethiopia 360', 'Addis Ababa 360',
        'Lalibela 360', 'Mauritius 360', 'Seychelles 360',

        # --- 3. 大洋洲专项 (目标 >= 200) ---
        # 澳大利亚各州与领地
        'Sydney 360', 'Sydney Opera 360', 'Bondi 360', 'Manly 360', 'Blue Mountains 360',
        'Melbourne 360', 'Great Ocean Road 360', 'Twelve Apostles 360', 'Yarra Valley 360', 'Phillip Island 360',
        'Brisbane 360', 'Gold Coast 360', 'Surfers Paradise 360', 'Cairns 360', 'Great Barrier Reef 360',
        'Whitsundays 360', 'Sunshine Coast 360', 'Perth 360', 'Fremantle 360', 'Rottnest 360',
        'Margaret River 360', 'Adelaide 360', 'Barossa 360', 'Kangaroo Island 360', 'Uluru 360',
        'Ayers Rock 360', 'Alice Springs 360', 'Darwin 360', 'Kakadu 360', 'Hobart 360',
        'Tasmania 360', 'Cradle Mountain 360', 'Canberra 360', 'Byron Bay 360', 'Noosa 360',
        'Newcastle Australia 360', 'Wollongong 360', 'Geelong 360', 'Townsville 360', 'Ballarat 360',
        'Bendigo 360', 'Broome 360', 'Esperance 360', 'Flinders Ranges 360', 'Port Arthur 360',
        'photosphere Australia', 'photosphere Sydney', 'photosphere Melbourne',
        
        # 新西兰北岛与南岛
        'Auckland 360', 'Wellington 360', 'Queenstown 360', 'Christchurch 360', 'Rotorua 360',
        'Hobbiton 360', 'Milford Sound 360', 'Mount Cook 360', 'Lake Tekapo 360', 'Wanaka 360',
        'Fiordland 360', 'Taupo 360', 'Tongariro 360', 'Bay of Islands 360', 'Franz Josef 360',
        'Dunedin 360', 'Napier 360', 'Kaikoura 360', 'Hamilton New Zealand 360', 'Coromandel 360',
        'Waitomo 360', 'Arrowtown 360', 'Glenorchy 360', 'Te Anau 360', 'Catlins 360',
        'photosphere New Zealand',
        
        # 太平洋岛屿
        'Fiji 360', 'Suva 360', 'Nadi 360', 'Tahiti 360', 'Bora Bora 360', 'Moorea 360',
        'Samoa 360', 'New Caledonia 360', 'Noumea 360', 'Vanuatu 360', 'Cook Islands 360', 'Rarotonga 360',

        # --- 4. 欧洲冷门/中小国家专项 ---
        # 比利时
        'Belgium 360', 'Brussels 360', 'Bruges 360', 'Brugge 360', 'Ghent 360', 'Gent 360',
        'Antwerp 360', 'Antwerpen 360', 'Leuven 360', 'Liege 360', 'Namur 360', 'Dinant 360',
        'Ypres 360', 'Mons 360', 'Tournai 360', 'Grand Place Brussels 360', 'Atomium 360',
        
        # 芬兰
        'Finland 360', 'Helsinki 360', 'Rovaniemi 360', 'Lapland 360', 'Tampere 360',
        'Turku 360', 'Oulu 360', 'Suomenlinna 360', 'Porvoo 360', 'Saimaa 360', 'Levi 360',
        
        # 丹麦
        'Denmark 360', 'Copenhagen 360', 'Aarhus 360', 'Odense 360', 'Aalborg 360',
        'Roskilde 360', 'Kronborg 360', 'Tivoli 360', 'Bornholm 360', 'Nyhavn 360',
        
        # 挪威
        'Norway 360', 'Oslo 360', 'Bergen 360', 'Lofoten 360', 'Tromso 360', 'Geiranger 360',
        'Flåm 360', 'Preikestolen 360', 'Trolltunga 360', 'Stavanger 360', 'Trondheim 360',
        'Alesund 360', 'Svalbard 360', 'Sognefjord 360', 'Bryggen 360',
        
        # 匈牙利
        'Hungary 360', 'Budapest 360', 'Buda Castle 360', 'Parliament Budapest 360',
        'Fisherman Bastion 360', 'Balaton 360', 'Eger 360', 'Debrecen 360', 'Szeged 360', 'Pecs 360',
        
        # 波罗的海三国 (爱沙尼亚、拉脱维亚、立陶宛)
        'Estonia 360', 'Tallinn 360', 'Tallinn Old Town 360', 'Tartu 360', 'Parnu 360', 'Saaremaa 360',
        'Latvia 360', 'Riga 360', 'Riga Old Town 360', 'Jurmala 360', 'Sigulda 360', 'Cesis 360', 'Rundale 360',
        'Lithuania 360', 'Vilnius 360', 'Kaunas 360', 'Trakai 360', 'Klaipeda 360', 'Curonian Spit 360',
        
        # 克罗地亚
        'Croatia 360', 'Dubrovnik 360', 'Split 360', 'Plitvice 360', 'Zadar 360', 'Zagreb 360',
        'Hvar 360', 'Rovinj 360', 'Pula 360', 'Sibenik 360', 'Korcula 360', 'Trogir 360', 'Diocletian 360',
        
        # 爱尔兰
        'Ireland 360', 'Dublin 360', 'Cliffs of Moher 360', 'Galway 360', 'Killarney 360',
        'Ring of Kerry 360', 'Cork 360', 'Connemara 360', 'Blarney 360', 'Dingle 360',
        
        # 罗马尼亚
        'Romania 360', 'Bucharest 360', 'Brasov 360', 'Bran Castle 360', 'Transylvania 360',
        'Sibiu 360', 'Sighisoara 360', 'Cluj 360', 'Peles 360', 'Timisoara 360',
        
        # 乌克兰
        'Ukraine 360', 'Kyiv 360', 'Kiev 360', 'Lviv 360', 'Odesa 360', 'Kharkiv 360', 'Chernivtsi 360',
        
        # 斯洛伐克
        'Slovakia 360', 'Bratislava 360', 'High Tatras 360', 'Kosice 360', 'Spis Castle 360', 'Bojnice 360',
        
        # 斯洛文尼亚
        'Slovenia 360', 'Ljubljana 360', 'Lake Bled 360', 'Bled 360', 'Postojna 360', 'Piran 360', 'Triglav 360',
        
        # 塞尔维亚、白俄罗斯、保加利亚
        'Serbia 360', 'Belgrade 360', 'Novi Sad 360', 'Kalemegdan 360', 'Nis 360',
        'Belarus 360', 'Minsk 360', 'Mir Castle 360', 'Nesvizh 360', 'Brest Belarus 360',
        'Bulgaria 360', 'Sofia 360', 'Plovdiv 360', 'Varna 360', 'Rila 360', 'Veliko Tarnovo 360',
        
        # 波黑、黑山、阿尔巴尼亚
        'Bosnia 360', 'Sarajevo 360', 'Mostar 360', 'Old Bridge Mostar 360',
        'Montenegro 360', 'Kotor 360', 'Bay of Kotor 360', 'Budva 360', 'Durmitor 360',
        'Albania 360', 'Tirana 360', 'Berat 360', 'Gjirokaster 360', 'Sarande 360',
        
        # 冰岛
        'Iceland 360', 'Reykjavik 360', 'Golden Circle 360', 'Gullfoss 360', 'Blue Lagoon 360',
        'Jokulsarlon 360', 'Skogafoss 360', 'Seljalandsfoss 360', 'Vik 360', 'Akureyri 360',
        
        # 希腊与葡萄牙
        'Greece 360', 'Athens 360', 'Acropolis 360', 'Santorini 360', 'Mykonos 360', 'Crete 360',
        'Rhodes 360', 'Meteora 360', 'Delphi 360', 'Corfu 360', 'Zakynthos 360',
        'Portugal 360', 'Lisbon 360', 'Porto 360', 'Sintra 360', 'Algarve 360', 'Madeira 360', 'Azores 360',
        
        # 波兰与捷克
        'Poland 360', 'Warsaw 360', 'Krakow 360', 'Wroclaw 360', 'Gdansk 360', 'Poznan 360',
        'Wieliczka 360', 'Zakopane 360', 'Czech 360', 'Prague 360', 'Cesky Krumlov 360', 'Brno 360',
        'Karlovy Vary 360', 'Kutna Hora 360'
    ]

    print(f"Phase 1: Querying {len(targeted_queries)} targeted search queries...", flush=True)
    all_titles = set()
    with ThreadPoolExecutor(max_workers=14) as ex:
        futs = [ex.submit(fetch_search_titles, q, 50) for q in targeted_queries]
        for f in as_completed(futs):
            all_titles.update(f.result())

    print(f"Phase 1 Complete! Collected {len(all_titles)} unique candidate titles.", flush=True)

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
    print("Phase 3: Targeted Regional Injection & Balance Control...", flush=True)

    # 统计当前各大洲已有数量
    cont_counts = {'欧洲': 0, '亚洲': 0, '北美洲': 0, '南美洲': 0, '非洲': 0, '大洋洲': 0, '其他': 0}
    for it in catalog:
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        cont_counts[cont] = cont_counts.get(cont, 0) + 1

    print(f"Current continent counts before enrichment: {cont_counts}", flush=True)

    # 目标限额
    SOUTH_AMERICA_TARGET = 520
    AFRICA_TARGET = 520
    OCEANIA_TARGET = 220

    added_by_cont = {'欧洲': 0, '亚洲': 0, '北美洲': 0, '南美洲': 0, '非洲': 0, '大洋洲': 0, '其他': 0}
    added_by_country = {}

    for it in resolved_candidates:
        url = it['url']
        if url in seen_urls:
            continue

        lat = it['lat']
        lon = it['lon']
        country_name, country_code, continent = resolve_coords_country(lat, lon)

        # 1. 坚决排除德意瑞
        if country_name in ['德国', '意大利', '瑞士']:
            continue

        if country_name == '海外名胜' and country_code == 'INTL':
            continue

        # 2. 检查大洲配额
        curr_total = cont_counts.get(continent, 0)
        
        if continent == '南美洲':
            if curr_total >= SOUTH_AMERICA_TARGET:
                continue
        elif continent == '非洲':
            if curr_total >= AFRICA_TARGET:
                continue
        elif continent == '大洋洲':
            if curr_total >= OCEANIA_TARGET:
                continue
        elif continent == '欧洲':
            # 欧洲仅允许冷门/中小国家加入，大国（如已很多的西班牙、英国、法国等）适量控制
            big_eu = ['西班牙', '英国', '法国', '荷兰', '奥地利']
            if country_name in big_eu:
                country_curr = sum(1 for x in catalog if x['country'] == country_name)
                if country_curr >= 160:
                    continue
        elif continent in ['亚洲', '北美洲']:
            # 亚北美已有较多，仅允许冷门国家补齐
            country_curr = sum(1 for x in catalog if x['country'] == country_name)
            if country_name in ['美国', '中国', '日本'] and country_curr >= 550:
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
        added_by_cont[continent] = added_by_cont.get(continent, 0) + 1
        added_by_country[country_name] = added_by_country.get(country_name, 0) + 1

    total_added = sum(added_by_cont.values())
    print(f"\nPhase 3 Finished! Added {total_added} targeted questions across regions.", flush=True)
    print(f"Added breakdown by continent: {added_by_cont}", flush=True)

    # 重新排序并分配 ID
    dom = [x for x in catalog if x.get('isDomestic')]
    intl = [x for x in catalog if not x.get('isDomestic')]
    final_catalog = dom + intl

    for idx, it in enumerate(final_catalog):
        it['id'] = f"sv_stream_{idx+1:05d}"

    out_file = "src/data/streetViewCatalog.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(final_catalog, f, ensure_ascii=False, indent=2)

    # 输出统计报告
    continents = {}
    countries = {}
    for it in final_catalog:
        c = it['country']
        countries[c] = countries.get(c, 0) + 1
        _, _, cont = resolve_coords_country(it['lat'], it['lng'])
        continents[cont] = continents.get(cont, 0) + 1

    print("\n=====================================================", flush=True)
    print(f"TARGET ENRICHMENT SUCCESS! Final catalog size: {len(final_catalog)}")
    print("CONTINENT BREAKDOWN (大洲分布):")
    for cont, count in sorted(continents.items(), key=lambda x: -x[1]):
        pct = (count / len(final_catalog)) * 100
        print(f"  - {cont}: {count} 题 ({pct:.1f}%)")
    print("\nUNDERREPRESENTED COUNTRIES REPORT:")
    target_check = ['比利时', '芬兰', '丹麦', '挪威', '匈牙利', '爱沙尼亚', '拉脱维亚', '立陶宛',
                    '克罗地亚', '爱尔兰', '罗马尼亚', '乌克兰', '斯洛伐克', '斯洛文尼亚', '塞尔维亚',
                    '白俄罗斯', '保加利亚', '波斯尼亚和黑塞哥维那', '黑山', '阿尔巴尼亚', '冰岛',
                    '巴西', '阿根廷', '智利', '秘鲁', '哥伦比亚', '厄瓜多尔', '玻利维亚', '乌拉圭',
                    '南非', '埃及', '摩洛哥', '肯尼亚', '坦桑尼亚', '阿尔及利亚', '突尼斯', '尼日利亚', '纳米比亚',
                    '澳大利亚', '新西兰', '斐济']
    for c in target_check:
        print(f"  - {c}: {countries.get(c, 0)} 题")
    print("=====================================================", flush=True)

if __name__ == '__main__':
    main()
