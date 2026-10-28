# -*- coding: utf-8 -*-
"""
enrich_catalog.py
扩充并结构化街景题库：
1. 注入包括上海外滩、北京正阳门、慕田峪长城、颐和园谐趣园、云南香格里拉属都湖、金山岭长城、青海湖、广州大学城等高精中国 360° 全景；
2. 为所有题目统一打上 isDomestic 标记（True 为国内，False 为国外），精准支持“全球 / 国内 / 国外”三大赛区分类。
"""
import json
import urllib.request
import urllib.parse
import os

HEADERS = {'User-Agent': 'TravelMapEducationalApp/1.0 (contact@travelmap.app)'}

CHINA_LANDMARKS = [
    {
        "title": "File:Shanghai bund – Panorama (Greg Zaal via Poly Haven).jpg",
        "city": "上海 · 外滩黄浦江畔与陆家嘴天际线",
        "cityName": "上海",
        "desc": "中国上海黄浦江畔标志性外滩万国建筑群与对岸东方明珠现代陆家嘴全景",
        "lat": 31.24168,
        "lng": 121.48601
    },
    {
        "title": "File:Mutianyu – Panorama (Greg Zaal via Poly Haven).jpg",
        "city": "北京 · 怀柔慕田峪长城崇山峻岭",
        "cityName": "北京",
        "desc": "中国北京怀柔区慕田峪明长城敌楼与雄关万里的苍茫群山全景",
        "lat": 40.43290,
        "lng": 116.57000
    },
    {
        "title": "File:Zhengyang gate – Panorama (Greg Zaal via Poly Haven).jpg",
        "city": "北京 · 前门正阳门箭楼历史中轴线",
        "cityName": "北京",
        "desc": "中国北京古都中轴线南端前门正阳门城楼与历史大街",
        "lat": 39.90098,
        "lng": 116.39789
    },
    {
        "title": "File:Xiequ yuan – Panorama (Greg Zaal via Poly Haven).jpg",
        "city": "北京 · 颐和园谐趣园江南水乡园中之园",
        "cityName": "北京",
        "desc": "中国北京皇家园林颐和园内仿无锡寄畅园建造的谐趣园池塘与古典水榭",
        "lat": 39.99910,
        "lng": 116.27600
    },
    {
        "title": "File:Shudu lake - Panorama (Alex Radosnov via Poly Haven).jpg",
        "city": "云南 · 迪庆香格里拉普达措属都湖",
        "cityName": "迪庆",
        "desc": "中国云南迪庆藏族自治州香格里拉普达措国家公园清澈澄碧的高原属都湖与原始冷杉林",
        "lat": 27.90465,
        "lng": 99.93898
    },
    {
        "title": "File:Jinshanling-panorama.jpg",
        "city": "河北 · 承德滦平金山岭长城日出",
        "cityName": "承德",
        "desc": "中国河北与北京交界处金山岭长城蜿蜒于燕山山脉之巅的壮美自然风光",
        "lat": 40.66888,
        "lng": 117.26772
    },
    {
        "title": "File:360 degree panorama from Sand Dunes Northeast of Qinghai Lake - panoramio.jpg",
        "city": "青海 · 刚察县青海湖东北岸金沙湾",
        "cityName": "青海湖",
        "desc": "中国青海省青海湖畔金沙湾独特的沙漠与高原圣湖交相辉映的奇观",
        "lat": 36.73277,
        "lng": 100.77855
    },
    {
        "title": "File:Panorama Hailar.Hailar river by night.jpg",
        "city": "内蒙古 · 呼伦贝尔海拉尔河畔夜景",
        "cityName": "呼伦贝尔",
        "desc": "中国内蒙古自治区呼伦贝尔海拉尔河畔大桥与草原边塞城市夜景",
        "lat": 49.21089,
        "lng": 119.74914
    },
    {
        "title": "File:SCUT GZIC C3 Photosphere.jpg",
        "city": "广东 · 广州华南理工大学国际校区C3广场",
        "cityName": "广州",
        "desc": "中国广东广州番禺区现代化红砖大学校园学术环廊与现代绿化景观",
        "lat": 23.01258,
        "lng": 113.39846
    },
    {
        "title": "File:SCUT GZIC D2 Photosphere.jpg",
        "city": "广东 · 广州华南理工大学国际校区D2林荫道",
        "cityName": "广州",
        "desc": "中国南方现代化高等学府国际校区绿茵大道与阳光草坪",
        "lat": 23.01213,
        "lng": 113.40044
    },
    {
        "title": "File:SCUT Library Lobby Photosphere.jpg",
        "city": "广东 · 广州五山校区百年高校图书馆",
        "cityName": "广州",
        "desc": "中国广州天河区五山高等学府开阔庄严的现代图书馆大厅",
        "lat": 23.15371,
        "lng": 113.34301
    },
    {
        "title": "File:TTA HK Central Lai Yuen Amusement Park 360-degree.jpg",
        "city": "香港 · 中环海滨摩天轮与维多利亚港街区",
        "cityName": "香港",
        "desc": "中国香港中环海滨维多利亚港湾、繁华都会高楼群与荔园嘉年华街区",
        "lat": 22.28532,
        "lng": 114.15964
    }
]

def run():
    out_file = "src/data/streetViewCatalog.json"
    items = []
    if os.path.exists(out_file):
        with open(out_file, "r", encoding="utf-8") as f:
            items = json.load(f)

    # 1. 批量抓取 CHINA_LANDMARKS 的 4K 缩略图
    titles = [item["title"] for item in CHINA_LANDMARKS]
    pipe = "|".join(titles)
    url = f"https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(pipe)}&prop=imageinfo&iiprop=url&iiurlwidth=3840&format=json"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))

    pages = res['query']['pages']
    url_map = {}
    for pid, p in pages.items():
        t = p['title']
        ii = p.get('imageinfo', [{}])[0]
        thumb = ii.get('thumburl') or ii.get('url')
        if thumb:
            url_map[t] = thumb

    # 2. 注入中国精品地标
    existing_urls = {it['panoUrl'] for it in items}
    added_china = 0
    for lm in CHINA_LANDMARKS:
        t = lm["title"]
        thumb = url_map.get(t)
        if thumb and thumb not in existing_urls:
            existing_urls.add(thumb)
            new_id = f"sv_china_{added_china+1:03d}"
            items.insert(0, {
                "id": new_id,
                "panoUrl": thumb,
                "country": "中国",
                "countryName": "中国",
                "countryCode": "CHN",
                "city": lm["city"],
                "cityName": lm["cityName"],
                "region": "domestic",
                "lat": lm["lat"],
                "lng": lm["lng"],
                "initialHeading": 0,
                "description": lm["desc"],
                "isDomestic": True,
                "source": "Wikimedia Commons / Poly Haven CC0"
            })
            added_china += 1

    # 3. 为所有条目标准化 isDomestic 字段
    for it in items:
        c = it.get("country", "")
        cc = it.get("countryCode", "")
        lat = it.get("lat", 0)
        lng = it.get("lng", 0)
        is_cn = (
            c in ("中国", "China", "香港", "Hong Kong", "台湾", "Taiwan", "澳门", "Macau")
            or cc in ("CHN", "HKG", "TWN", "MAC")
            or (18.0 <= lat <= 53.6 and 73.5 <= lng <= 135.1 and cc in ("CHN", None))
        )
        it["isDomestic"] = bool(is_cn)
        it["region"] = "domestic" if is_cn else "international"

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    domestic_count = sum(1 for it in items if it.get("isDomestic"))
    intl_count = len(items) - domestic_count
    print(f"Catalog updated! Total: {len(items)}, 国内 (中国): {domestic_count}, 国外 (国际): {intl_count}")

if __name__ == "__main__":
    run()
