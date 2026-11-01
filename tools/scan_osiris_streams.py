# -*- coding: utf-8 -*-
import os
import re

cctv_dir = 'tools/osiris_repo/src/app/api/cctv'
types_count = {}
hls_samples = []

for f in os.listdir(cctv_dir):
    if f.endswith('.ts') and not f.endswith('.test.ts'):
        p = os.path.join(cctv_dir, f)
        with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
            c = fp.read()
            for m in re.finditer(r"stream_type:\s*['\"]([^'\"]+)['\"]", c):
                st = m.group(1)
                types_count[st] = types_count.get(st, 0) + 1
            for m in re.finditer(r"stream_url:\s*['\"]([^'\"]+)['\"]", c):
                url = m.group(1)
                if '.m3u8' in url:
                    hls_samples.append((f, url))

print("Stream types in OSIRIS:", types_count)
print(f"HLS samples count: {len(hls_samples)}")
for item in hls_samples[:15]:
    print(" ", item)
