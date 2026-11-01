# -*- coding: utf-8 -*-
"""
build_global_cameras.py
Aggregates the comprehensive global CCTV camera catalog (~4,500+ nodes) matching OSIRIS:
1. Caltrans California (2,000 cameras across Bay Area, LA, San Diego - exact nodes in user's screenshot)
2. Hong Kong Transport Dept (1,013 cameras across HK)
3. Transport for London (890 cameras across London)
4. Japan MLIT & Tokyo (50 cameras)
5. European Highway & City Webcams (Poland, Spain, France, Italy, Bulgaria, Switzerland, etc.)
"""
import os
import re
import json
import urllib.request
import xml.etree.ElementTree as ET

all_cameras = []
seen_ids = set()

# 1. Fetch Caltrans California (~2,000 cameras)
print("1/5 Fetching Caltrans California cameras...")
try:
    req = urllib.request.Request(
        'https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/CCTV/FeatureServer/0/query?where=1%3D1&outFields=*&f=json',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read().decode('utf-8'))
        features = d.get('features', [])
        added_cal = 0
        for feat in features:
            p = feat.get('attributes', {})
            lat = p.get('latitude')
            lng = p.get('longitude')
            img_url = p.get('currentImageURL')
            video_url = p.get('streamingVideoURL') or ''
            name = p.get('locationName') or 'Caltrans CCTV'
            obj_id = p.get('OBJECTID')
            city = p.get('nearbyPlace') or p.get('county') or 'California'
            
            if not lat or not lng or not img_url:
                continue
            
            cam_id = f"cal_{obj_id}"
            if cam_id in seen_ids:
                continue
            seen_ids.add(cam_id)
            
            all_cameras.append({
                'id': cam_id,
                'name': name.strip(),
                'lat': round(float(lat), 5),
                'lng': round(float(lng), 5),
                'city': city.strip(),
                'country': 'United States',
                'continent': '北美洲',
                'stream_url': video_url,
                'stream_type': 'mp4' if video_url else 'jpg',
                'feed_url': img_url.strip(),
                'external_url': 'https://cwwp2.dot.ca.gov/',
                'source': 'Caltrans (California DOT)',
                'has_live_video': bool(video_url)
            })
            added_cal += 1
        print(f"Added {added_cal} Caltrans California cameras!")
except Exception as e:
    print(f"Caltrans fetch error: {e}")

# 2. Fetch Hong Kong Transport Department (~1,013 cameras)
print("2/5 Fetching Hong Kong Transport Department cameras...")
try:
    req = urllib.request.Request(
        'https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=12) as r:
        xml_text = r.read().decode('utf-8')
        root = ET.fromstring(xml_text)
        added_hk = 0
        for img in root.findall('.//image'):
            key = img.findtext('key', '').strip()
            url = img.findtext('url', '').strip()
            desc = img.findtext('description', '').strip() or f"Hong Kong CCTV {key}"
            lat_str = img.findtext('latitude', '').strip()
            lng_str = img.findtext('longitude', '').strip()
            
            if not key or not url or not lat_str or not lng_str:
                continue
            try:
                lat = float(lat_str)
                lng = float(lng_str)
            except:
                continue
            
            if lat < 22.0 or lat > 22.7 or lng < 113.8 or lng > 114.6:
                continue
            
            cam_id = f"hk_{key}"
            if cam_id in seen_ids:
                continue
            seen_ids.add(cam_id)
            
            all_cameras.append({
                'id': cam_id,
                'name': desc,
                'lat': round(lat, 5),
                'lng': round(lng, 5),
                'city': 'Hong Kong',
                'country': 'Hong Kong',
                'continent': '亚洲',
                'stream_url': '',
                'stream_type': 'jpg',
                'feed_url': url,
                'external_url': 'https://data.gov.hk',
                'source': 'Hong Kong Transport Dept',
                'has_live_video': False
            })
            added_hk += 1
        print(f"Added {added_hk} Hong Kong cameras!")
except Exception as e:
    print(f"Hong Kong fetch error: {e}")

# 3. Fetch London TfL (~890 cameras)
print("3/5 Fetching London TfL JamCams...")
try:
    req = urllib.request.Request('https://api.tfl.gov.uk/Place/Type/JamCam', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=12) as r:
        tfl_data = json.loads(r.read().decode('utf-8'))
        added_tfl = 0
        for item in tfl_data:
            cam_id = f"tfl_{item.get('id', '')}"
            if cam_id in seen_ids:
                continue
            lat = item.get('lat')
            lon = item.get('lon')
            if not lat or not lon:
                continue
            name = item.get('commonName', 'London JamCam')
            img_prop = next((p.get('value') for p in item.get('additionalProperties', []) if p.get('key') == 'imageUrl'), '')
            video_prop = next((p.get('value') for p in item.get('additionalProperties', []) if p.get('key') == 'videoUrl'), '')

            seen_ids.add(cam_id)
            all_cameras.append({
                'id': cam_id,
                'name': name.strip(),
                'lat': round(float(lat), 5),
                'lng': round(float(lon), 5),
                'city': 'London',
                'country': 'United Kingdom',
                'continent': '欧洲',
                'stream_url': video_prop or img_prop,
                'stream_type': 'mp4' if video_prop else 'jpg',
                'feed_url': img_prop,
                'external_url': f"https://tfl.gov.uk/traffic/status/?disruptionIds=&jamcam={item.get('id', '')}",
                'source': 'Transport for London',
                'has_live_video': bool(video_prop)
            })
            added_tfl += 1
        print(f"Added {added_tfl} London TfL JamCams!")
except Exception as e:
    print(f"London TfL fetch error: {e}")

# 4. Add Japan MLIT River & Expressway Feeds (Tokyo, Yokohama)
print("4/5 Adding Japan MLIT and City Feeds...")
japan_file = 'tools/osiris_repo/src/app/api/cctv/japan.ts'
if os.path.exists(japan_file):
    with open(japan_file, 'r', encoding='utf-8') as fp:
        j_text = fp.read()
        for m in re.finditer(r'\{[^{}]*?id:\s*[\'\"](?P<id>[^\'\"]+)[\'\"][^{}]*?\}', j_text, re.DOTALL):
            chunk = m.group(0)
            cid = m.group('id').strip()
            if cid in seen_ids:
                continue
            lat_m = re.search(r'lat:\s*([-\d\.]+)', chunk)
            lng_m = re.search(r'lng:\s*([-\d\.]+)', chunk)
            if not lat_m or not lng_m:
                continue
            name_m = re.search(r'name:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
            feed_m = re.search(r'feed_url:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
            stream_m = re.search(r'stream_url:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
            city_m = re.search(r'city:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
            source_m = re.search(r'source:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)

            name = name_m.group(1).strip() if name_m else 'Japan CCTV'
            feed_url = feed_m.group(1).strip() if feed_m else ''
            stream_url = stream_m.group(1).strip() if stream_m else ''
            city = city_m.group(1).strip() if city_m else 'Tokyo'
            source = source_m.group(1).strip() if source_m else 'MLIT Japan'

            seen_ids.add(cid)
            all_cameras.append({
                'id': cid,
                'name': name,
                'lat': round(float(lat_m.group(1)), 5),
                'lng': round(float(lng_m.group(1)), 5),
                'city': city,
                'country': 'Japan',
                'continent': '亚洲',
                'stream_url': stream_url,
                'stream_type': 'iframe' if 'youtube' in stream_url else ('hls' if '.m3u8' in stream_url else 'jpg'),
                'feed_url': feed_url,
                'external_url': 'https://cam.river.go.jp/',
                'source': source,
                'has_live_video': bool(stream_url)
            })

# 5. Add European High-Reliability Feeds (Poland, Spain, Bulgaria, etc.)
print("5/5 Adding European and Global Curated Feeds...")
for country_file, def_country, def_continent in [
    ('poland.ts', 'Poland', '欧洲'),
    ('spain.ts', 'Spain', '欧洲'),
    ('france.ts', 'France', '欧洲'),
    ('bulgaria.ts', 'Bulgaria', '欧洲'),
    ('italy.ts', 'Italy', '欧洲'),
    ('switzerland.ts', 'Switzerland', '欧洲')
]:
    fpath = os.path.join('tools/osiris_repo/src/app/api/cctv', country_file)
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as fp:
            text = fp.read()
            for m in re.finditer(r'\{[^{}]*?id:\s*[\'\"](?P<id>[^\'\"]+)[\'\"][^{}]*?\}', text, re.DOTALL):
                chunk = m.group(0)
                cid = m.group('id').strip()
                if cid in seen_ids:
                    continue
                lat_m = re.search(r'lat:\s*([-\d\.]+)', chunk)
                lng_m = re.search(r'lng:\s*([-\d\.]+)', chunk)
                if not lat_m or not lng_m:
                    continue
                name_m = re.search(r'name:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
                feed_m = re.search(r'feed_url:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
                stream_m = re.search(r'stream_url:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
                city_m = re.search(r'city:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)
                source_m = re.search(r'source:\s*[\'\"]([^\'\"]+)[\'\"]', chunk)

                name = name_m.group(1).strip() if name_m else 'European CCTV'
                feed_url = feed_m.group(1).strip() if feed_m else ''
                stream_url = stream_m.group(1).strip() if stream_m else ''
                city = city_m.group(1).strip() if city_m else def_country
                source = source_m.group(1).strip() if source_m else f"{def_country} Roadway"

                seen_ids.add(cid)
                all_cameras.append({
                    'id': cid,
                    'name': name,
                    'lat': round(float(lat_m.group(1)), 5),
                    'lng': round(float(lng_m.group(1)), 5),
                    'city': city,
                    'country': def_country,
                    'continent': def_continent,
                    'stream_url': stream_url,
                    'stream_type': 'hls' if '.m3u8' in stream_url else ('mp4' if '.mp4' in stream_url else 'jpg'),
                    'feed_url': feed_url,
                    'external_url': 'https://osirisai.live',
                    'source': source,
                    'has_live_video': bool(stream_url)
                })

# Final normalization and stats
continents_stat = {}
for c in all_cameras:
    continents_stat[c['continent']] = continents_stat.get(c['continent'], 0) + 1

out_path = 'src/features/liveCams/services/camerasData.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(all_cameras, f, ensure_ascii=False, indent=2)

print("\n" + "=" * 50)
print(f"SUCCESS: Built {len(all_cameras)} total real CCTV cameras!")
print("Continent breakdown:")
for k, v in sorted(continents_stat.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v}")
print(f"Saved to {out_path} ({os.path.getsize(out_path)} bytes)")
print("=" * 50)
