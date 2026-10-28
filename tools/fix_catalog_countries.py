# -*- coding: utf-8 -*-
import urllib.request
import json
import re
from shapely.geometry import shape, Point

# 1. 下载或加载 Natural Earth 110m 权威国家边界
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

# 2. ISO / 英文名 -> 标准简体中文名称对照表 (100% 对齐 public/flags/circle-195/*.png)
ISO_TO_CN = {
    'CN': ('中国', 'CHN'),
    'HK': ('中国', 'CHN'),
    'MO': ('中国', 'CHN'),
    'TW': ('中国', 'CHN'),
    'IT': ('意大利', 'IT'),
    'FR': ('法国', 'FR'),
    'DE': ('德国', 'DE'),
    'ES': ('西班牙', 'ES'),
    'GB': ('英国', 'GB'),
    'US': ('美国', 'US'),
    'CH': ('瑞士', 'CH'),
    'AT': ('奥地利', 'AT'),
    'NL': ('荷兰', 'NL'),
    'JP': ('日本', 'JP'),
    'BR': ('巴西', 'BR'),
    'RU': ('俄罗斯', 'RU'),
    'SE': ('瑞典', 'SE'),
    'NO': ('挪威', 'NO'),
    'FI': ('芬兰', 'FI'),
    'DK': ('丹麦', 'DK'),
    'PL': ('波兰', 'PL'),
    'CZ': ('捷克', 'CZ'),
    'GR': ('希腊', 'GR'),
    'BE': ('比利时', 'BE'),
    'PT': ('葡萄牙', 'PT'),
    'IE': ('爱尔兰', 'IE'),
    'HU': ('匈牙利', 'HU'),
    'TR': ('土耳其', 'TR'),
    'AU': ('澳大利亚', 'AU'),
    'CA': ('加拿大', 'CA'),
    'NZ': ('新西兰', 'NZ'),
    'MX': ('墨西哥', 'MX'),
    'AR': ('阿根廷', 'AR'),
    'CL': ('智利', 'CL'),
    'KR': ('韩国', 'KR'),
    'TH': ('泰国', 'TH'),
    'SG': ('新加坡', 'SG'),
    'MY': ('马来西亚', 'MY'),
    'ID': ('印度尼西亚', 'ID'),
    'IN': ('印度', 'IN'),
    'EG': ('埃及', 'EG'),
    'ZA': ('南非', 'ZA'),
    'IS': ('冰岛', 'IS'),
    'EE': ('爱沙尼亚', 'EE'),
    'LV': ('拉脱维亚', 'LV'),
    'LT': ('立陶宛', 'LT'),
    'SK': ('斯洛伐克', 'SK'),
    'SI': ('斯洛文尼亚', 'SI'),
    'HR': ('克罗地亚', 'HR'),
    'RS': ('塞尔维亚', 'RS'),
    'BG': ('保加利亚', 'BG'),
    'RO': ('罗马尼亚', 'RO'),
    'UA': ('乌克兰', 'UA'),
    'GE': ('格鲁吉亚', 'GE'),
    'AM': ('亚美尼亚', 'AM'),
    'AZ': ('阿塞拜疆', 'AZ'),
    'IL': ('以色列', 'IL'),
    'AE': ('阿联酋', 'AE'),
    'SA': ('沙特阿拉伯', 'SA'),
    'PH': ('菲律宾', 'PH'),
    'VN': ('越南', 'VN'),
    'KH': ('柬埔寨', 'KH'),
    'MA': ('摩洛哥', 'MA'),
    'CO': ('哥伦比亚', 'CO'),
    'PE': ('秘鲁', 'PE'),
    'UY': ('乌拉圭', 'UY'),
    'EC': ('厄瓜多尔', 'EC'),
    'CU': ('古巴', 'CU'),
    'PA': ('巴拿马', 'PA'),
    'CR': ('哥斯达黎加', 'CR'),
    'KZ': ('哈萨克斯坦', 'KZ'),
    'UZ': ('乌兹别克斯坦', 'UZ'),
    'BY': ('白俄罗斯', 'BY'),
    'TZ': ('坦桑尼亚', 'TZ'),
    'KE': ('肯尼亚', 'KE'),
    'NG': ('尼日利亚', 'NG'),
    'DZ': ('阿尔及利亚', 'DZ'),
    'LY': ('利比亚', 'LY'),
    'MG': ('马达加斯加', 'MG'),
    'VA': ('梵蒂冈', 'VA'),
    'MC': ('摩纳哥', 'MC'),
    'SM': ('圣马力诺', 'SM'),
    'AD': ('安道尔', 'AD'),
    'LU': ('卢森堡', 'LU'),
    'LI': ('列支敦士登', 'LI'),
    'CY': ('塞浦路斯', 'CY'),
    'MT': ('马耳他', 'MT'),
    'ME': ('黑山', 'ME'),
    'BA': ('波斯尼亚和黑塞哥维那', 'BA'),
    'MK': ('马其顿', 'MK'),
    'AL': ('阿尔巴尼亚', 'AL'),
    'MD': ('摩尔多瓦', 'MD'),
}

NAME_TO_CN = {
    'China': ('中国', 'CHN'),
    'Taiwan': ('中国', 'CHN'),
    'Hong Kong': ('中国', 'CHN'),
    'Macau': ('中国', 'CHN'),
    'Italy': ('意大利', 'IT'),
    'France': ('法国', 'FR'),
    'Germany': ('德国', 'DE'),
    'Spain': ('西班牙', 'ES'),
    'United Kingdom': ('英国', 'GB'),
    'United States': ('美国', 'US'),
    'Switzerland': ('瑞士', 'CH'),
    'Austria': ('奥地利', 'AT'),
    'Netherlands': ('荷兰', 'NL'),
    'Japan': ('日本', 'JP'),
    'Brazil': ('巴西', 'BR'),
    'Russia': ('俄罗斯', 'RU'),
    'Sweden': ('瑞典', 'SE'),
    'Norway': ('挪威', 'NO'),
    'Finland': ('芬兰', 'FI'),
    'Denmark': ('丹麦', 'DK'),
    'Poland': ('波兰', 'PL'),
    'Czech Republic': ('捷克', 'CZ'),
    'Greece': ('希腊', 'GR'),
    'Belgium': ('比利时', 'BE'),
    'Portugal': ('葡萄牙', 'PT'),
    'Ireland': ('爱尔兰', 'IE'),
    'Hungary': ('匈牙利', 'HU'),
    'Turkey': ('土耳其', 'TR'),
    'Australia': ('澳大利亚', 'AU'),
    'Canada': ('加拿大', 'CA'),
    'New Zealand': ('新西兰', 'NZ'),
    'Mexico': ('墨西哥', 'MX'),
    'Argentina': ('阿根廷', 'AR'),
    'Chile': ('智利', 'CL'),
    'South Korea': ('韩国', 'KR'),
    'Thailand': ('泰国', 'TH'),
    'Singapore': ('新加坡', 'SG'),
    'Malaysia': ('马来西亚', 'MY'),
    'Indonesia': ('印度尼西亚', 'ID'),
    'India': ('印度', 'IN'),
    'Egypt': ('埃及', 'EG'),
    'South Africa': ('南非', 'ZA'),
    'Iceland': ('冰岛', 'IS'),
    'Estonia': ('爱沙尼亚', 'EE'),
    'Latvia': ('拉脱维亚', 'LV'),
    'Lithuania': ('立陶宛', 'LT'),
    'Slovakia': ('斯洛伐克', 'SK'),
    'Slovenia': ('斯洛文尼亚', 'SI'),
    'Croatia': ('克罗地亚', 'HR'),
    'Serbia': ('塞尔维亚', 'RS'),
    'Bulgaria': ('保加利亚', 'BG'),
    'Romania': ('罗马尼亚', 'RO'),
    'Ukraine': ('乌克兰', 'UA'),
    'Georgia': ('格鲁吉亚', 'GE'),
    'Armenia': ('亚美尼亚', 'AM'),
    'Azerbaijan': ('阿塞拜疆', 'AZ'),
    'Israel': ('以色列', 'IL'),
    'United Arab Emirates': ('阿联酋', 'AE'),
    'Saudi Arabia': ('沙特阿拉伯', 'SA'),
    'Philippines': ('菲律宾', 'PH'),
    'Vietnam': ('越南', 'VN'),
    'Cambodia': ('柬埔寨', 'KH'),
    'Morocco': ('摩洛哥', 'MA'),
    'Colombia': ('哥伦比亚', 'CO'),
    'Peru': ('秘鲁', 'PE'),
    'Uruguay': ('乌拉圭', 'UY'),
    'Ecuador': ('厄瓜多尔', 'EC'),
    'Cuba': ('古巴', 'CU'),
    'Panama': ('巴拿马', 'PA'),
    'Costa Rica': ('哥斯达黎加', 'CR'),
    'Kazakhstan': ('哈萨克斯坦', 'KZ'),
    'Uzbekistan': ('乌兹别克斯坦', 'UZ'),
    'Belarus': ('白俄罗斯', 'BY'),
    'Tanzania': ('坦桑尼亚', 'TZ'),
    'Kenya': ('肯尼亚', 'KE'),
    'Nigeria': ('尼日利亚', 'NG'),
    'Algeria': ('阿尔及利亚', 'DZ'),
    'Libya': ('利比亚', 'LY'),
    'Madagascar': ('马达加斯加', 'MG'),
    'Vatican': ('梵蒂冈', 'VA'),
    'Monaco': ('摩纳哥', 'MC'),
    'San Marino': ('圣马力诺', 'SM'),
    'Andorra': ('安道尔', 'AD'),
    'Luxembourg': ('卢森堡', 'LU'),
    'Liechtenstein': ('列支敦士登', 'LI'),
    'Cyprus': ('塞浦路斯', 'CY'),
    'Malta': ('马耳他', 'MT'),
    'Montenegro': ('黑山', 'ME'),
    'Bosnia and Herzegovina': ('波斯尼亚和黑塞哥维那', 'BA'),
    'Macedonia': ('马其顿', 'MK'),
    'Albania': ('阿尔巴尼亚', 'AL'),
    'Moldova': ('摩尔多瓦', 'MD'),
}

# 繁体中文转简体中文字典
TRAD_TO_SIMP = {
    '中國': '中国', '法國': '法国', '德國': '德国', '美國': '美国', '荷蘭': '荷兰',
    '奧地利': '奥地利', '波蘭': '波兰', '愛沙尼亞': '爱沙尼亚', '拉脫維亞': '拉脱维亚',
    '烏克蘭': '乌克兰', '烏拉圭': '乌拉圭', '愛爾蘭共和國': '爱尔兰', '愛爾蘭': '爱尔兰',
    '坦桑尼亞': '坦桑尼亚', '白俄羅斯': '白俄罗斯', '芬蘭': '芬兰', '梵蒂岡城國': '梵蒂冈',
    '梵蒂岡': '梵蒂冈', '羅馬尼亞': '罗马尼亚', '馬達加斯加': '马达加斯加', '希臘': '希腊',
    '俄羅斯': '俄罗斯', '義大利': '意大利', '澳大利亞': '澳大利亚', '紐西蘭': '新西兰',
    '南非共和國': '南非', '沙烏地阿拉伯': '沙特阿拉伯', '土耳其共和國': '土耳其',
    '南韓': '韩国', '北韓': '朝鲜', '菲律賓': '菲律宾', '阿爾及利亞': '阿尔及利亚',
    '奈及利亞': '尼日利亚', '利比亞': '利比亚', '葛摩': '科摩罗'
}

def clean_city_label(text):
    if not text: return "全景地标"
    name = re.sub(r'^(File:|Image:)', '', text, flags=re.I)
    name = re.sub(r'\.(jpg|jpeg|png)$', '', name, flags=re.I)
    name = re.sub(r'[\(\[\{].*?[\)\]\}]', '', name)
    name = re.sub(r'360\s*(degree|deg|x180)?|panorama|panosphere|photosphere|equirectangular|全景图?|球面', '', name, flags=re.I)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    name = re.sub(r'\s+', ' ', name)
    # 如果全为英文或特殊符号，美化一下
    return name[:38] if name else "全景地标"

def is_china_exact(lat, lon):
    # 中国严格地理多边形粗筛
    if 18.0 <= lat <= 53.6 and 73.5 <= lon <= 135.1:
        if lat < 40.0 and lon > 122.5: return False # 排除日本冲绳等
        if lat > 45.0 and lon < 85.0: return False  # 排除哈萨克
        if lat > 50.0 and lon > 120.0: return False # 排除俄罗斯外兴安岭
        if lat > 50.0 and lon < 88.0: return False  # 排除俄罗斯阿尔泰
        return True
    return False

# 加载题库
with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

print(f"Recalibrating {len(catalog)} questions...")
recalibrated = []

for it in catalog:
    lat = it['lat']
    lng = it['lng']
    pt = Point(lng, lat)
    
    # 1. 优先通过 Natural Earth Polygon 判断
    found_country = None
    found_code = None
    
    for s in shapes:
        if s['geom'].contains(pt):
            iso2 = s['iso_a2']
            sname = s['name']
            if iso2 in ISO_TO_CN:
                found_country, found_code = ISO_TO_CN[iso2]
            elif sname in NAME_TO_CN:
                found_country, found_code = NAME_TO_CN[sname]
            break
            
    # 2. 如果落在海岸线微小误差外，找最近的多边形 (buffer < 1.0度)
    if not found_country:
        nearest_s = min(shapes, key=lambda s: s['geom'].distance(pt))
        dist = nearest_s['geom'].distance(pt)
        if dist < 1.2:
            iso2 = nearest_s['iso_a2']
            sname = nearest_s['name']
            if iso2 in ISO_TO_CN:
                found_country, found_code = ISO_TO_CN[iso2]
            elif sname in NAME_TO_CN:
                found_country, found_code = NAME_TO_CN[sname]
                
    # 3. 兜底与中国判定
    is_cn = is_china_exact(lat, lng) or (found_country == '中国')
    if is_cn:
        found_country = '中国'
        found_code = 'CHN'
        
    if not found_country:
        raw_c = it.get('country', '')
        simp_c = TRAD_TO_SIMP.get(raw_c, raw_c)
        if simp_c in NAME_TO_CN:
            found_country, found_code = NAME_TO_CN[simp_c]
        else:
            found_country = simp_c if simp_c and simp_c != 'Unknown' else '海外名胜'
            found_code = it.get('countryCode') or 'INTL'

    # 规范化繁体字
    found_country = TRAD_TO_SIMP.get(found_country, found_country)
    
    # 清洗城市地名
    clean_city = clean_city_label(it.get('city', ''))
    
    it['country'] = found_country
    it['countryName'] = found_country
    it['countryCode'] = found_code
    it['city'] = clean_city
    it['cityName'] = clean_city
    it['isDomestic'] = is_cn
    it['region'] = 'domestic' if is_cn else 'international'
    it['description'] = f"{found_country} · {clean_city} 真实 360° 球面全景"
    recalibrated.append(it)

# 重新排序：国内在前，国外在后
domestic = [x for x in recalibrated if x['isDomestic']]
intl = [x for x in recalibrated if not x['isDomestic']]
final_catalog = domestic + intl

for idx, it in enumerate(final_catalog):
    it['id'] = f"sv_stream_{idx+1:05d}"

with open('src/data/streetViewCatalog.json', 'w', encoding='utf-8') as f:
    json.dump(final_catalog, f, ensure_ascii=False, indent=2)

print("\n==========================================")
print(f"RECALIBRATION COMPLETE!")
print(f"  - 国内 (中国) 题库: {len(domestic)} 题")
print(f"  - 国外 (国际) 题库: {len(intl)} 题")
print(f"  - 全球总题数:       {len(final_catalog)} 题")
print("==========================================")

# 打印特定问题检查
for it in final_catalog:
    if 'Madre della Chiesa' in it.get('city', ''):
        print("Fixed Madre della Chiesa:", it['country'], it['countryCode'], it['city'], it['lat'], it['lng'])
    if '马涅尔' in it.get('city', '') or 'Marnay' in it.get('city', ''):
        print("Fixed Marnay/马涅尔:", it['country'], it['countryCode'], it['city'], it['lat'], it['lng'])
