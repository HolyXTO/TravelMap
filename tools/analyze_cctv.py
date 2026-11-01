# -*- coding: utf-8 -*-
import os
import re

cctv_dir = 'tools/osiris_repo/src/app/api/cctv'
total_cams = 0
files_stats = {}

for f in os.listdir(cctv_dir):
    if f.endswith('.ts') and not f.endswith('.test.ts'):
        p = os.path.join(cctv_dir, f)
        with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
            c = fp.read()
            matches = re.findall(r"id:\s*['\"]([^'\"]+)['\"]", c)
            if matches:
                total_cams += len(matches)
                files_stats[f] = len(matches)

print(f"Total camera definitions found in OSIRIS: {total_cams}")
for k, v in sorted(files_stats.items(), key=lambda x: -x[1])[:25]:
    print(f"  {k}: {v}")
