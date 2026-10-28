import os

files = [f.replace('.png', '') for f in os.listdir('public/flags/circle-195') if f.endswith('.png')]
with open('tools/flag_names.txt', 'w', encoding='utf-8') as out:
    for name in sorted(files):
        out.write(name + '\n')
print(f"Dumped {len(files)} names to tools/flag_names.txt")
