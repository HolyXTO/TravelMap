from __future__ import annotations

import json
import re
from collections import OrderedDict, defaultdict
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = [
    Path(r"C:\Users\HolyX\Desktop\足迹地图\195国家图片"),
    Path(r"C:\Users\HolyX\Desktop\足迹地图\195国家图片2"),
    Path(r"C:\Users\HolyX\Desktop\足迹地图\195国家图片3"),
]
OUTPUT_DIR = ROOT / "public" / "country-gallery"
MANIFEST_PATH = ROOT / "src" / "data" / "countryGallery.js"
TARGET_SIZE = (480, 320)
WEBP_QUALITY = 84


def read_manifest() -> OrderedDict[str, list[str]]:
    text = MANIFEST_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"const countryGalleryImages = (?P<object>\{.*?\});\s*\n\nexport",
        text,
        re.S,
    )
    if not match:
        raise RuntimeError("Cannot find countryGalleryImages object.")
    return json.loads(match.group("object"), object_pairs_hook=OrderedDict)


def write_manifest(images: OrderedDict[str, list[str]]) -> None:
    payload = json.dumps(images, ensure_ascii=False, indent=2)
    MANIFEST_PATH.write_text(
        "// Generated country gallery image manifest.\n"
        "// Images are resized to 480x320 WebP for fast loading.\n"
        f"const countryGalleryImages = {payload};\n\n"
        "export default countryGalleryImages;\n",
        encoding="utf-8",
    )


def save_webp(source: Path, relative_output: str) -> None:
    output = ROOT / "public" / relative_output
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image = image.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        image.save(output, "WEBP", quality=WEBP_QUALITY, method=6)


def grouped_images(source_dir: Path) -> dict[str, list[Path]]:
    groups: dict[str, list[tuple[int, Path]]] = defaultdict(list)
    for path in source_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        match = re.match(r"^(?P<name>.+?)(?P<index>\d*)$", path.stem)
        if not match:
            continue
        name = match.group("name")
        index = int(match.group("index") or 1)
        groups[name].append((index, path))
    return {
        name: [path for _, path in sorted(paths, key=lambda item: item[0])]
        for name, paths in groups.items()
    }


def next_extra_index(images: OrderedDict[str, list[str]]) -> int:
    highest = 0
    for paths in images.values():
        for path in paths:
            match = re.search(r"country-extra-(\d+)-", path)
            if match:
                highest = max(highest, int(match.group(1)))
    return highest + 1


def main() -> None:
    images = read_manifest()

    norway_replacement = SOURCE_DIRS[0] / "挪威New.jpg"
    if norway_replacement.exists() and "挪威" in images and len(images["挪威"]) >= 3:
        save_webp(norway_replacement, images["挪威"][2])

    extra_index = next_extra_index(images)
    for source_dir in SOURCE_DIRS:
        if not source_dir.exists():
            print(f"Skip missing source: {source_dir}")
            continue
        for country_name, paths in sorted(grouped_images(source_dir).items()):
            if country_name in images or country_name.endswith("New"):
                continue
            relative_paths = []
            for image_index, source_path in enumerate(paths, start=1):
                relative = f"country-gallery/country-extra-{extra_index:03d}-{image_index}.webp"
                save_webp(source_path, relative)
                relative_paths.append(relative)
            if relative_paths:
                images[country_name] = relative_paths
                extra_index += 1

    write_manifest(images)


if __name__ == "__main__":
    main()
