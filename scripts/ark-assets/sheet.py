"""Lays the rendered tiles of one set out as contact sheets (system Python + Pillow).

  python3 scripts/ark-assets/sheet.py --set trees --work <work dir> --out <sheet dir>

Writes <out>/<set>-variants.jpg (every asset at lod0, plus its closed state if it has one)
and <out>/<set>-lods.jpg (lod0 / lod1 / lod2 / card for each kind's first variant).
"""

import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def sheet(cells, cols, out, tile=300, title=""):
    rows = (len(cells) + cols - 1) // cols
    head = 44
    img = Image.new("RGB", (cols * tile, rows * (tile + 24) + head), (24, 26, 28))
    draw = ImageDraw.Draw(img)
    draw.text((12, 10), title, fill=(235, 235, 235), font=font(22))
    f = font(15)
    for i, (path, label) in enumerate(cells):
        x, y = (i % cols) * tile, head + (i // cols) * (tile + 24)
        if path and os.path.exists(path):
            img.paste(Image.open(path).convert("RGB").resize((tile, tile), Image.LANCZOS), (x, y))
        draw.text((x + 6, y + tile + 3), label, fill=(220, 220, 220), font=f)
    img.save(out, quality=88)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", required=True)
    ap.add_argument("--work", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=6)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    tiles = json.load(open(os.path.join(args.work, f"tiles-{args.set}.json")))
    man = json.load(open(os.path.join(args.work, f"manifest-{args.set}.json")))
    variants, lods = [], []
    for aid in sorted(tiles, key=lambda k: (man[k]["kind"], man[k]["variant"])):
        t = tiles[aid]
        if "lod0" in t:
            variants.append((t["lod0"]["path"], f"{aid}  {t['lod0']['tris']}t"))
        if "closed" in t:
            variants.append((t["closed"]["path"], f"{aid} closed"))
        for extra in ("head", "head-closed"):
            if extra in t:
                variants.append((t[extra]["path"], f"{aid} {extra.replace('head', 'close-up')}"))
        if "lod1" in t:
            for level in ("lod0", "lod1", "lod2", "card"):
                if level in t:
                    lods.append((t[level]["path"], f"{aid} {level} {t[level]['tris']}t"))
    paths = [sheet(variants, args.cols, os.path.join(args.out, f"{args.set}-variants.jpg"),
                   title=f"Ark assets v1 · {args.set} · every variant (lod0)")]
    if lods:
        paths.append(sheet(lods, 4, os.path.join(args.out, f"{args.set}-lods.jpg"), tile=260,
                           title=f"Ark assets v1 · {args.set} · lod0 / lod1 / lod2 / card"))
    print("\n".join(paths))


if __name__ == "__main__":
    main()
