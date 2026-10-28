# -*- coding: utf-8 -*-
"""
clean_city_names.py
深度清洗 streetViewCatalog.json 中的地名：
1. 修复 Q-ID (如 Q115521326 -> 雅典 · 维基媒体峰会中心)
2. 修复带有前导特殊符号的城市名 (如 ° Zitterklapfen -> Zitterklapfen)
3. 移除多余的引号、哈希值、相机编号和时间戳
4. 将 Mapillary 批量文件名转化为准确、人类可读的城市与地标街景名
5. 限制地名最大长度在合理美观范围内，防止表格溢出
"""
import json
import re
import urllib.parse

# 特殊 Q-ID 字典人工优化（针对已知知名地标）
Q_ID_OVERRIDES = {
    'Q115521326': '雅典 · 维基媒体峰会中心',
    'Q18338882': '糸岛 · 端山古坟',
    'Q1244041': '安普勒本 · 乡村大教堂',
    'Q112926517': '明户古坟 · 顶峰全景',
    'Q113206776': '霍厄鲁夫特 · 历史风光',
    'Q113235553': '亚梅尔恩风车 · 全景步道',
    'Q113366355': '瓜迪克斯 · 历史古城俯瞰',
    'Q113834526': '萨拉瀑布 · 峡谷绝壁',
    'Q130389171': '罗斯托克 · 湖畔野营地',
    'Q130550229': '克拉斯博 · 自然林道',
    'Q130550316': '瓦尔斯哈格 · 原野步道',
    'Q130593551': '斯托尔穆尔 · 历史庄园',
    'Q15111728': '戈劳 · 田园林荫大道',
    'Q17229712': '熊谷 · 野原古坟群',
    'Q108606352': '小泉大冢古坟 · 封土全景',
}

def clean_filename_to_title(url):
    fname = url.split('/')[-1].split('?')[0]
    fname = urllib.parse.unquote(fname)
    fname = re.sub(r'^\d+px-', '', fname)
    fname = re.sub(r'\.(jpg|jpeg|png)$', '', fname, flags=re.I)
    fname = re.sub(r'[\(\[\{].*?[\)\]\}]', '', fname)
    fname = re.sub(r'360\s*(degree|deg|x180|Kugelpanorama)?|panorama|panosphere|photosphere|equirectangular|groupshot', '', fname, flags=re.I)
    fname = re.sub(r'(pano_)?Torsten_Bae.*', '', fname, flags=re.I)
    fname = re.sub(r'_\d{3,}_\d{3,}.*', '', fname)
    fname = fname.replace('_', ' ').replace('-', ' ').strip()
    fname = re.sub(r'\s+', ' ', fname)
    return fname[:28] if fname else "特色地标"

def clean_city_string(city, url, country, lat, lng):
    city = (city or '').strip()
    
    # 0. 针对特定拼接长串
    if 'BoaiPark' in city: return '苗栗 · 竹南博爱公园'
    if 'SomewhereYonghe' in city: return '新北 · 永和街景'
    if 'FactoryEmpty' in city: return '新北 · 工业区街景'
    if 'West Kowloon' in city: return '香港 · 西九龙站'
    if 'Awesome outdoor' in city: return '北京 · 怀柔雁栖湖'
    if 'Maharaja Sriram' in city: return '奥里萨 · 斯里兰姆大学'
    if 'Qinghai' in city: return '青海湖 · 东北沙丘'
    if 'Lai Yuen' in city: return '香港 · 中环荔园游乐场'

    # 1. 检查是否为 Q-ID (如 Q115521326)
    m = re.match(r'^Q(\d+)$', city)
    if m:
        if city in Q_ID_OVERRIDES:
            return Q_ID_OVERRIDES[city]
        cleaned = clean_filename_to_title(url)
        if cleaned and cleaned != "特色地标":
            return cleaned
        return f"{country} · 特色全景地标"

    # 2. 清理 Mapillary 批量时间戳与序列号
    if 'mapillary' in city.lower() or re.match(r'^\d{4}[\s_-]\d{2}[\s_-]\d{2}', city):
        if country == '中国':
            if 39.5 < lat < 41.0 and 115.5 < lng < 117.5: return '北京 · 城市街景'
            if 30.8 < lat < 31.8 and 121.0 < lng < 122.0: return '上海 · 城市街景'
            if 22.4 < lat < 22.9 and 113.8 < lng < 114.5: return '深圳 · 城市街景'
            if 24.5 < lat < 25.5 and 121.0 < lng < 122.0: return '台北 · 城市街景'
            return '中国 · 城市街景'
        elif country == '韩国':
            if 37.3 < lat < 37.8 and 126.7 < lng < 127.3: return '首尔 · 城市街景'
            return '韩国 · 城市街景'
        elif country == '日本':
            if 35.5 < lat < 35.9 and 139.5 < lng < 140.0: return '东京 · 城市街景'
            if 34.5 < lat < 35.2 and 135.3 < lng < 136.0: return '大阪 · 城市街景'
            return '日本 · 城市街景'
        elif country == '德国':
            if 48.0 < lat < 48.3 and 11.4 < lng < 11.8: return '慕尼黑 · 城市街景'
            if 52.3 < lat < 52.7 and 13.2 < lng < 13.6: return '柏林 · 城市街景'
            return '德国 · 城市街景'
        elif country == '西班牙':
            if 40.2 < lat < 40.6 and -3.9 < lng < -3.5: return '马德里 · 城市街景'
            if 41.2 < lat < 41.6 and 2.0 < lng < 2.3: return '巴塞罗那 · 城市街景'
            return '西班牙 · 城市街景'
        elif country == '美国':
            if 37.6 < lat < 37.9 and -122.6 < lng < -122.3: return '旧金山 · 城市街景'
            if 33.7 < lat < 34.4 and -118.6 < lng < -118.0: return '洛杉矶 · 城市街景'
            if 40.5 < lat < 40.9 and -74.1 < lng < -73.8: return '纽约 · 城市街景'
            if 47.4 < lat < 47.8 and -122.5 < lng < -122.2: return '西雅图 · 城市街景'
            return '美国 · 城市街景'
        elif country == '加拿大':
            if 43.5 < lat < 43.9 and -79.6 < lng < -79.2: return '多伦多 · 城市街景'
            if 49.1 < lat < 49.4 and -123.3 < lng < -122.9: return '温哥华 · 城市街景'
            return '加拿大 · 城市街景'
        elif country == '英国':
            if 51.3 < lat < 51.7 and -0.4 < lng < 0.2: return '伦敦 · 城市街景'
            return '英国 · 城市街景'
        elif country == '法国':
            if 48.7 < lat < 49.0 and 2.1 < lng < 2.5: return '巴黎 · 城市街景'
            return '法国 · 城市街景'
        return f"{country} · 城市街景"

    # 3. 清洗前导和尾随符号 (如 ° Zitterklapfen, "house of cultures")
    city = re.sub(r'^[^\w\u4e00-\u9fa5]+', '', city)
    city = re.sub(r'[^\w\u4e00-\u9fa5]+$', '', city)
    
    # 4. 移除多余的后缀和相机编码、时间戳
    city = re.sub(r'\s*360.*$', '', city, flags=re.I)
    city = re.sub(r'\s*panorama.*$', '', city, flags=re.I)
    city = re.sub(r'_\d{3,}_\d{3,}.*', '', city)
    city = re.sub(r'20\d{6}$', '', city) # 移除尾随日期如 20200829
    city = re.sub(r'_\d{4,}$', '', city)
    
    city = city.strip()
    if not city or len(city) < 2:
        extracted = clean_filename_to_title(url)
        return extracted if extracted else f"{country} · 特色地标"
        
    if len(city) > 28:
        city = city[:28].rstrip()
        
    return city

with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

print(f"Cleaning city names for {len(catalog)} questions...")
cleaned_count = 0

for it in catalog:
    old_city = it.get('city', '')
    new_city = clean_city_string(
        old_city, 
        it.get('panoUrl', ''), 
        it.get('country', ''),
        it.get('lat', 0),
        it.get('lng', 0)
    )
    if new_city != old_city:
        cleaned_count += 1
        it['city'] = new_city
        it['cityName'] = new_city
        it['description'] = f"{it['country']} · {new_city} 真实 360° 球面全景"

with open('src/data/streetViewCatalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"Done! Cleaned {cleaned_count} city names.")
