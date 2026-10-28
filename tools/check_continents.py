import json
from shapely.geometry import shape, Point

with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

print(f"Total catalog questions: {len(catalog)}")

# Map countries to continents
COUNTRY_TO_CONTINENT = {
    "中国": "亚洲", "日本": "亚洲", "韩国": "亚洲", "泰国": "亚洲", "新加坡": "亚洲",
    "马来西亚": "亚洲", "印度尼西亚": "亚洲", "印度": "亚洲", "菲律宾": "亚洲", "越南": "亚洲",
    "柬埔寨": "亚洲", "以色列": "亚洲", "阿联酋": "亚洲", "沙特阿拉伯": "亚洲", "哈萨克斯坦": "亚洲",
    "乌兹别克斯坦": "亚洲", "亚美尼亚": "亚洲", "阿塞拜疆": "亚洲", "格鲁吉亚": "亚洲", "土耳其": "亚洲",
    
    "意大利": "欧洲", "德国": "欧洲", "法国": "欧洲", "瑞士": "欧洲", "奥地利": "欧洲",
    "荷兰": "欧洲", "英国": "欧洲", "西班牙": "欧洲", "葡萄牙": "欧洲", "瑞典": "欧洲",
    "挪威": "欧洲", "芬兰": "欧洲", "丹麦": "欧洲", "冰岛": "欧洲", "波兰": "欧洲",
    "捷克": "欧洲", "匈牙利": "欧洲", "希腊": "欧洲", "比利时": "欧洲", "爱尔兰": "欧洲",
    "斯洛伐克": "欧洲", "斯洛文尼亚": "欧洲", "克罗地亚": "欧洲", "塞尔维亚": "欧洲", "保加利亚": "欧洲",
    "罗马尼亚": "欧洲", "乌克兰": "欧洲", "白俄罗斯": "欧洲", "爱沙尼亚": "欧洲", "拉脱维亚": "欧洲",
    "立陶宛": "欧洲", "梵蒂冈": "欧洲", "摩纳哥": "欧洲", "圣马力诺": "欧洲", "安道尔": "欧洲",
    "卢森堡": "欧洲", "列支敦士登": "欧洲", "塞浦路斯": "欧洲", "马耳他": "欧洲", "黑山": "欧洲",
    "波斯尼亚和黑塞哥维那": "欧洲", "马其顿": "欧洲", "阿尔巴尼亚": "欧洲", "摩尔多瓦": "欧洲", "俄罗斯": "欧洲",
    
    "美国": "北美洲", "加拿大": "北美洲", "墨西哥": "北美洲", "古巴": "北美洲",
    "巴拿马": "北美洲", "哥斯达黎加": "北美洲",
    
    "巴西": "南美洲", "阿根廷": "南美洲", "智利": "南美洲", "秘鲁": "南美洲",
    "哥伦比亚": "南美洲", "乌拉圭": "南美洲", "厄瓜多尔": "南美洲", "玻利维亚": "南美洲",
    
    "澳大利亚": "大洋洲", "新西兰": "大洋洲", "斐济": "大洋洲",
    
    "埃及": "非洲", "南非": "非洲", "摩洛哥": "非洲", "肯尼亚": "非洲",
    "坦桑尼亚": "非洲", "尼日利亚": "非洲", "阿尔及利亚": "非洲", "利比亚": "非洲",
    "突尼斯": "非洲", "纳米比亚": "非洲", "马达加斯加": "非洲", "埃塞俄比亚": "非洲"
}

continents = {}
countries = {}
for it in catalog:
    c = it['country']
    countries[c] = countries.get(c, 0) + 1
    cont = COUNTRY_TO_CONTINENT.get(c, "其他")
    continents[cont] = continents.get(cont, 0) + 1

with open('tools/continent_summary.txt', 'w', encoding='utf-8') as out:
    out.write("CONTINENTS:\n")
    for cont, count in sorted(continents.items(), key=lambda x: -x[1]):
        out.write(f"  {cont}: {count}\n")
    out.write("\nTOP COUNTRIES:\n")
    for c, count in sorted(countries.items(), key=lambda x: -x[1]):
        out.write(f"  {c} ({COUNTRY_TO_CONTINENT.get(c, '其他')}): {count}\n")

print("Written to tools/continent_summary.txt")
