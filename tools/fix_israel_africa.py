# -*- coding: utf-8 -*-
"""
fix_israel_africa.py
Fixes misclassified cameras in Africa:
- Relocates Israel and Middle East cameras to Asia (亚洲)
- Relocates Cyprus and Austria cameras to Europe (欧洲)
- Ensures real African cameras (Egypt, Morocco, Senegal, South Africa, Kenya, Tanzania, Seychelles) are accurately tagged
"""
import json
import sys
from collections import Counter

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

paths = [
    'src/features/liveCams/services/camerasData.json',
    'public/data/camerasData.json'
]

for p in paths:
    with open(p, 'r', encoding='utf-8') as f:
        cameras = json.load(f)

    print(f"Loaded {len(cameras)} cameras from {p}...")
    fixed_count = 0

    for c in cameras:
        cid = str(c.get('id', '')).lower()
        name = str(c.get('name', '')).lower()
        city = str(c.get('city', '')).lower()
        source = str(c.get('source', '')).lower()
        lat = float(c.get('lat', 0))
        lng = float(c.get('lng', 0))

        all_text = f"{cid} {name} {city} {source}"

        # 1. Israel & Middle East detection
        is_israel = (
            any(k in all_text for k in [
                'israel', 'tel aviv', 'haifa', 'jerusalem', 'galilee', 'herzliya',
                'tiberias', 'eilat', 'netanya', 'ashdod', 'kotel', 'western wall',
                'beachcam-il', 'bcil-', 'hula nature', 'jezreel valley', 'even yehuda',
                'kiryat haim', 'מועצה אזורית', 'העיר העתיקה', 'צ׳ק פוסט'
            ])
            or (34.2 <= lng <= 35.9 and 29.4 <= lat <= 33.5)
        )

        if is_israel:
            c['country'] = '以色列'
            c['continent'] = '亚洲'
            fixed_count += 1
            continue

        # 2. Iraq / Karbala / Baghdad
        if 'iraq' in all_text or 'karbala' in all_text or 'al-abbas' in all_text:
            c['country'] = '伊拉克'
            c['continent'] = '亚洲'
            fixed_count += 1
            continue

        # 3. Iran / Isfahan / Tehran
        if 'iran' in all_text or 'isfahan' in all_text or 'tehran' in all_text:
            c['country'] = '伊朗'
            c['continent'] = '亚洲'
            fixed_count += 1
            continue

        # 4. Jordan / Petra / Amman
        if 'jordan' in all_text or 'petra' in all_text or 'amman' in all_text:
            c['country'] = '约旦'
            c['continent'] = '亚洲'
            fixed_count += 1
            continue

        # 5. Lebanon / Beirut
        if 'lebanon' in all_text or 'beirut' in all_text or 'lb-me-multicam' in cid:
            c['country'] = '黎巴嫩'
            c['continent'] = '亚洲'
            fixed_count += 1
            continue

        # 6. Cyprus
        if 'cyprus' in all_text or 'limassol' in all_text or 'pissouri' in all_text or (32.0 <= lng <= 34.6 and 34.5 <= lat <= 35.8):
            c['country'] = '塞浦路斯'
            c['continent'] = '欧洲'
            fixed_count += 1
            continue

        # 7. Austria misclassified as Africa (due to YE city code)
        if 'öbelboden' in all_text or 'austria' in all_text or (14.0 <= lng <= 15.0 and 47.0 <= lat <= 48.5):
            c['country'] = '奥地利'
            c['continent'] = '欧洲'
            fixed_count += 1
            continue

        # 8. Egypt
        if 'egypt' in all_text or 'hurghada' in all_text or 'cairo' in all_text or 'red sea' in all_text:
            c['country'] = '埃及'
            c['continent'] = '非洲'
            fixed_count += 1
            continue

        # 9. Morocco
        if 'morocco' in all_text or 'imsouane' in all_text or 'marrakech' in all_text or 'casablanca' in all_text:
            c['country'] = '摩洛哥'
            c['continent'] = '非洲'
            fixed_count += 1
            continue

        # 10. Senegal
        if 'senegal' in all_text or 'lake retba' in all_text or 'dakar' in all_text:
            c['country'] = '塞内加尔'
            c['continent'] = '非洲'
            fixed_count += 1
            continue

        # 11. General Middle East
        if 'middle east' in all_text:
            c['continent'] = '亚洲'
            fixed_count += 1
            continue

        # Geographic boundary sanity check:
        # If in Middle East (lng >= 34.0, lat >= 27.0) -> MUST BE 亚洲
        if c.get('continent') == '非洲' and lng >= 34.0 and lat >= 27.5:
            c['continent'] = '亚洲'
            if c.get('country') == '全球':
                c['country'] = '以色列' if 34.2 <= lng <= 35.9 and 29.4 <= lat <= 33.5 else '中东'
            fixed_count += 1

    with open(p, 'w', encoding='utf-8') as f:
        json.dump(cameras, f, ensure_ascii=False)

    print(f"Updated {p}: {fixed_count} cameras adjusted.")

    # Inspect Africa
    africa_cams = [c for c in cameras if c.get('continent') == '非洲']
    africa_countries = Counter(c.get('country') for c in africa_cams)
    print(f"Africa camera total: {len(africa_cams)}")
    print("Africa countries distribution:")
    for cnt, num in africa_countries.most_common():
        print(f"  {cnt}: {num}")
