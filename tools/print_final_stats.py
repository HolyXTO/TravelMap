# -*- coding: utf-8 -*-
import json
import re

with open('src/data/streetViewCatalog.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

with open('src/QuestionBankStatsPopover.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

m = re.search(r'const COUNTRY_TO_CONTINENT = \{(.*?)\};', code, re.DOTALL)
mapping = dict(re.findall(r'"([^"]+)":\s*"([^"]+)"', m.group(1)))

continents = {}
by_country = {}
for it in catalog:
    c = it['country']
    by_country[c] = by_country.get(c, 0) + 1
    cont = mapping.get(c, '其他')
    continents[cont] = continents.get(cont, 0) + 1

print(f"TOTAL QUESTIONS: {len(catalog)}")
print("\n=== 大洲题量统计 ===")
for cont, count in sorted(continents.items(), key=lambda x: -x[1]):
    print(f"  - {cont}: {count} 题 ({count/len(catalog)*100:.1f}%)")

print("\n=== 用户重点关注的南美洲各国家 ===")
sa_countries = ['巴西', '厄瓜多尔', '哥伦比亚', '秘鲁', '阿根廷', '智利', '乌拉圭', '玻利维亚', '巴拉圭']
for c in sa_countries:
    print(f"  - {c}: {by_country.get(c, 0)} 题")

print("\n=== 用户重点关注的非洲各国家 ===")
af_countries = ['南非', '摩洛哥', '尼日利亚', '埃及', '坦桑尼亚', '突尼斯', '阿尔及利亚', '肯尼亚', '塞内加尔', '乌干达', '卢旺达', '加纳', '津巴布韦']
for c in af_countries:
    print(f"  - {c}: {by_country.get(c, 0)} 题")

print("\n=== 用户重点关注的大洋洲各国家 ===")
oc_countries = ['澳大利亚', '新西兰', '斐济']
for c in oc_countries:
    print(f"  - {c}: {by_country.get(c, 0)} 题")

print("\n=== 用户点名扩充的欧洲冷门/中小国家 ===")
cold_eu = [
    '比利时', '芬兰', '丹麦', '挪威', '匈牙利', '爱沙尼亚', '拉脱维亚', '立陶宛',
    '克罗地亚', '爱尔兰', '罗马尼亚', '乌克兰', '斯洛伐克', '斯洛文尼亚', '塞尔维亚',
    '白俄罗斯', '保加利亚', '波斯尼亚和黑塞哥维那', '黑山', '阿尔巴尼亚', '冰岛'
]
for c in cold_eu:
    print(f"  - {c}: {by_country.get(c, 0)} 题")

print("\n=== 严格限额控制的国家（德意瑞） ===")
capped = ['德国', '意大利', '瑞士']
for c in capped:
    print(f"  - {c}: {by_country.get(c, 0)} 题")
