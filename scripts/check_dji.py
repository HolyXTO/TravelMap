import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
b = r"C:\Users\HolyX\Desktop\图寻照片candidate\第十一批"
for folder in ['扬州', '镇江']:
    d = os.path.join(b, folder)
    files = os.listdir(d)
    print(f"=== {folder} ({len(files)} files) ===")
    for f in files:
        fp = os.path.join(d, f)
        with open(fp, 'rb') as fin:
            content = fin.read()
        has_invalid = b'GpsStatus="Invalid"' in content or b'GpsLatitude="+0.000000000"' in content
        print(f"  {f}: GpsInvalid={has_invalid}")
