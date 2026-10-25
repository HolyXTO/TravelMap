import os
import sys
import json
import urllib.request
import time

sys.stdout.reconfigure(encoding='utf-8')

points = [
    ('卢森堡_萨尔', 49.4695, 6.3685),
    ('海牙_区域2', 52.3387, 4.8730),
    ('奥斯陆_区域2', 60.1936, 11.0990),
    ('巴塞罗那_区域1', 41.3955, 2.1680),
    ('马略卡_区域2', 39.3137, 3.1205),
    ('慕尼黑_贝希特斯加登', 47.5475, 12.9828),
    ('巴黎_区域2', 48.8712, 2.7787),
    ('巴黎_凡尔赛', 48.8040, 2.1232),
    ('柏林_波茨坦', 52.4187, 13.0703),
    ('阿姆斯特丹_利瑟', 52.2696, 4.5473),
    ('卢塞恩_瑞吉山', 47.0559, 8.4847)
]

for name, lat, lon in points:
    url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}&accept-language=zh-Hans,zh,en"
    req = urllib.request.Request(url, headers={'User-Agent': 'Batch11OutlierCheck/1.0'})
    try:
        time.sleep(1.0)
        with urllib.request.urlopen(req, timeout=6) as response:
            res = json.loads(response.read().decode('utf-8'))
            print(f"=== {name} ({lat}, {lon}) ===")
            print("  Name:", res.get('name'))
            print("  Display:", res.get('display_name'))
            print("  Address:", res.get('address'))
    except Exception as e:
        print(f"=== {name} Error: {e} ===")
