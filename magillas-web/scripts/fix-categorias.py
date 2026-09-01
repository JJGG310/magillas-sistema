#!/usr/bin/env python3
"""Re-categoriza productos en 'otros' usando colecciones Shopify + heurísticas por nombre."""
import json
import re
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data" / "products.json"
SHOP = "https://magillasaccesorios.com"

COLLECTIONS = [
    ("sale", "ofertas"),
    ("personalizable", "personalizables"),
    ("te-amo-100-idiomas❤️", "te-amo-100-idiomas"),
    ("seleccion-colombia", "seleccion-colombia"),
    ("collares", "collares"),
    ("pulseras-neopreno", "pulseras-neopreno"),
    ("pulseras-tejidas", "pulseras-tejidas"),
    ("candongas", "candongas"),
    ("aretes", "aretes"),
    ("anillos", "anillos"),
    ("camandulas", "camandulas"),
    ("brazaletes", "brazaletes"),
    ("tobilleras", "tobilleras"),
    ("estuches", "estuches"),
    ("topos", "topos"),
]

PRIORITY = [c[1] for c in COLLECTIONS]

NAME_RULES = [
    (re.compile(r"candonga", re.I), "candongas"),
    (re.compile(r"\barete\b|aretes", re.I), "aretes"),
    (re.compile(r"\btopo\b|topos", re.I), "topos"),
    (re.compile(r"camandula", re.I), "camandulas"),
    (re.compile(r"tobillera", re.I), "tobilleras"),
    (re.compile(r"brazalete", re.I), "brazaletes"),
    (re.compile(r"estuche|bolsa de regalo", re.I), "estuches"),
    (re.compile(r"anillo", re.I), "anillos"),
    (re.compile(r"100.?idiomas|te amo.*idiomas", re.I), "te-amo-100-idiomas"),
    (re.compile(r"selecci[oó]n|colombia|tricolor", re.I), "seleccion-colombia"),
    (re.compile(r"personaliz|grabad|fotograb|placa|militar|esclava|relicario", re.I), "personalizables"),
    (re.compile(r"tejida|tejido", re.I), "pulseras-tejidas"),
    (re.compile(r"pulsera", re.I), "pulseras-neopreno"),
    (re.compile(r"collar|choker|cadena", re.I), "collares"),
]


def main():
    catalog = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    prod_cats = {p["id"]: set() for p in catalog["productos"]}

    for handle, cat_id in COLLECTIONS:
        enc = urllib.parse.quote(handle, safe="")
        try:
            prods = json.load(urllib.request.urlopen(f"{SHOP}/collections/{enc}/products.json?limit=250", timeout=30))["products"]
            for p in prods:
                prod_cats[p["handle"]].add(cat_id)
        except Exception as e:
            print(f"  ⚠ {handle}: {e}")

    fixed = 0
    for p in catalog["productos"]:
        if p["categoria"] != "otros":
            continue
        cats = prod_cats.get(p["id"], set())
        new_cat = None
        for cid in PRIORITY:
            if cid in cats:
                new_cat = cid
                break
        if not new_cat:
            text = p["nombre"] + " " + p.get("desc", "")
            for rx, cid in NAME_RULES:
                if rx.search(text):
                    new_cat = cid
                    break
        if new_cat:
            p["categoria"] = new_cat
            fixed += 1
        else:
            print(f"  sin categoría: {p['id']} — {p['nombre']}")

    # actualizar categorías con imágenes
    ids_used = {p["categoria"] for p in catalog["productos"]}
    meta = {
        "ofertas": ("Ofertas", "Descuentos y promociones"),
        "personalizables": ("Personalizables", "Piezas grabadas con tu foto, nombre o mensaje"),
        "te-amo-100-idiomas": ("Te amo 100 idiomas", "Collares y anillos con mensaje oculto"),
        "seleccion-colombia": ("Selección Colombia", "Orgullo tricolor 🇨🇴"),
        "collares": ("Collares", "Cadenas y dijes que cuentan historias"),
        "pulseras-neopreno": ("Pulseras neopreno", "Neopreno, mostacilla y dijes hechos a mano"),
        "pulseras-tejidas": ("Pulseras tejidas", "Tejidas a mano con mostacilla"),
        "candongas": ("Candongas", "Aretes tipo candonga"),
        "aretes": ("Aretes", "Aretes y pendientes"),
        "topos": ("Topos", "Topos y piercings"),
        "anillos": ("Anillos", "Anillos y sortijas"),
        "camandulas": ("Camándulas", "Camándulas y rosarios"),
        "brazaletes": ("Brazaletes", "Brazaletes rígidos y abiertos"),
        "tobilleras": ("Tobilleras", "Tobilleras y cadenas para tobillo"),
        "estuches": ("Estuches", "Estuches y empaques regalo"),
        "otros": ("Otros", "Más detalles Magillas"),
    }
    old_cats = {c["id"]: c for c in catalog["categorias"]}
    catalog["categorias"] = []
    for cid in PRIORITY + (["otros"] if "otros" in ids_used else []):
        if cid not in ids_used:
            continue
        nombre, desc = meta.get(cid, (cid.title(), ""))
        c = {"id": cid, "nombre": nombre, "desc": desc}
        if old_cats.get(cid, {}).get("img"):
            c["img"] = old_cats[cid]["img"]
        elif not c.get("img"):
            sample = next((x for x in catalog["productos"] if x["categoria"] == cid), None)
            if sample:
                c["img"] = sample["img"]
        catalog["categorias"].append(c)

    PRODUCTS.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    otros_left = sum(1 for p in catalog["productos"] if p["categoria"] == "otros")
    print(f"✅ {fixed} productos re-categorizados · quedan {otros_left} en otros · {len(catalog['categorias'])} categorías")


if __name__ == "__main__":
    main()
