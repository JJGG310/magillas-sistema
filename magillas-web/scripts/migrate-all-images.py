#!/usr/bin/env python3
"""Descarga TODAS las imágenes de cada producto desde Shopify."""
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data" / "products.json"
IMG_DIR = ROOT / "public" / "img" / "shop"
SHOP = "https://magillasaccesorios.com"


def ext(url):
    u = url.lower().split("?")[0]
    if u.endswith(".png"):
        return ".png"
    if u.endswith(".webp"):
        return ".webp"
    return ".jpg"


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    u = url + ("&width=1200" if "?" in url else "?width=1200")
    req = urllib.request.Request(u, headers={"User-Agent": "MagillasImages/2.0"})
    data = urllib.request.urlopen(req, timeout=90).read()
    dest.write_bytes(data)


def main():
    catalog = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    by_handle = {p["id"]: p for p in catalog["productos"]}

    # cache shopify products
    shop = json.load(urllib.request.urlopen(f"{SHOP}/collections/all/products.json?limit=250", timeout=60))
    shop_map = {p["handle"]: p for p in shop["products"]}

    total_dl = 0
    for pid, p in by_handle.items():
        sp = shop_map.get(pid)
        if not sp or not sp.get("images"):
            # mantener img actual como única
            if p.get("img"):
                p["imgs"] = [p["img"]]
            continue

        imgs = []
        for i, simg in enumerate(sp["images"]):
            e = ext(simg["src"])
            local = f"/img/shop/{pid}-{i}{e}"
            dest = IMG_DIR / f"{pid}-{i}{e}"
            try:
                download(simg["src"], dest)
                imgs.append(local)
                total_dl += 1
            except Exception as ex:
                print(f"  ⚠ {pid}-{i}: {ex}")

        if imgs:
            p["imgs"] = imgs
            p["img"] = imgs[0]  # card del catálogo = primera foto Shopify
            # limpiar imgPreview suelto; lo define personalizacion.json
            p.pop("imgPreview", None)

    PRODUCTS.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    multi = sum(1 for p in catalog["productos"] if len(p.get("imgs", [])) > 1)
    print(f"✅ {total_dl} imágenes descargadas · {multi} productos con galería")


if __name__ == "__main__":
    main()
