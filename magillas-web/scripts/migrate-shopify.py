#!/usr/bin/env python3
"""Migra catálogo e imágenes desde magillasaccesorios.com (Shopify) al MVP local."""
import json
import re
import os
import html
import urllib.request
import urllib.parse
from pathlib import Path

BASE = "https://magillasaccesorios.com"
ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "public" / "img" / "shop"
OUT = ROOT / "data" / "products.json"
OLD = OUT.read_text(encoding="utf-8") if OUT.exists() else "{}"
OLD_DATA = json.loads(OLD)

# Colecciones Shopify → categoría interna
COLLECTIONS = [
    ("sale", "ofertas", "Ofertas", "Descuentos y promociones"),
    ("personalizable", "personalizables", "Personalizables", "Piezas grabadas con tu foto, nombre o mensaje"),
    ("te-amo-100-idiomas❤️", "te-amo-100-idiomas", "Te amo 100 idiomas", "Collares y anillos con mensaje oculto"),
    ("seleccion-colombia", "seleccion-colombia", "Selección Colombia", "Orgullo tricolor 🇨🇴"),
    ("collares", "collares", "Collares", "Cadenas y dijes que cuentan historias"),
    ("pulseras-neopreno", "pulseras-neopreno", "Pulseras neopreno", "Neopreno, mostacilla y dijes hechos a mano"),
    ("pulseras-tejidas", "pulseras-tejidas", "Pulseras tejidas", "Tejidas a mano con mostacilla"),
    ("candongas", "candongas", "Candongas", "Aretes tipo candonga"),
    ("aretes", "aretes", "Aretes", "Aretes y pendientes"),
    ("topos", "topos", "Topos", "Topos y piercings"),
    ("anillos", "anillos", "Anillos", "Anillos y sortijas"),
    ("camandulas", "camandulas", "Camándulas", "Camándulas y rosarios"),
    ("brazaletes", "brazaletes", "Brazaletes", "Brazaletes rígidos y abiertos"),
    ("tobilleras", "tobilleras", "Tobilleras", "Tobilleras y cadenas para tobillo"),
    ("estuches", "estuches", "Estuches", "Estuches y empaques regalo"),
]

# Prioridad para categoría principal (más específica primero)
CAT_PRIORITY = [c[1] for c in COLLECTIONS]

BESTSELLERS = {
    "candonga-delgada", "camandula-premium", "pulsera-sol", "pulsera-balines",
    "collar-corazon-cupido", "pulsera-barca", "candonga-grande", "pulsera-corazon-tejido",
    "collar-corazon-esmeralda", "collar-carta", "pulsera-infinito-azul", "camandula-1",
    "estuche-rosa",
}

# Preview / custom del MVP anterior (por handle Shopify o id legacy)
ENHANCEMENTS = {
    "collar-carta": {
        "badge": "Más vendido", "destacado": True,
        "custom": [
            {"id": "mensaje", "label": "Mensaje grabado (ej: Te amo)", "type": "text"},
            {"id": "foto", "label": "La foto nos la envías por WhatsApp al confirmar", "type": "nota"},
        ],
        "preview": {
            "campo": "mensaje", "x": 44.5, "y": 18.6, "rot": -4,
            "font": "'Great Vibes', cursive", "size": 5.2, "color": "#4a3a10",
            "placeholder": "Te amo",
            "fonts": [
                {"n": "Manuscrita", "f": "'Great Vibes', cursive"},
                {"n": "Imprenta", "f": "'Cormorant Garamond', serif"},
            ],
        },
    },
    "collar-placa-grabada": {
        "custom": [
            {"id": "nombre", "label": "Nombre o palabra a grabar", "type": "text"},
            {"id": "diseno", "label": "Diseño (ej: ancla, corazón, tu idea)", "type": "text"},
        ],
        "preview": {
            "campo": "nombre", "x": 50.5, "y": 67, "rot": -7,
            "font": "'Cormorant Garamond', serif", "size": 4.5, "color": "#6b5b33",
            "placeholder": "Celt",
            "fonts": [
                {"n": "Imprenta", "f": "'Cormorant Garamond', serif"},
                {"n": "Manuscrita", "f": "'Great Vibes', cursive"},
            ],
        },
    },
}

# Mapeo id legacy → handle Shopify
LEGACY_HANDLE = {
    "collar-carta-foto": "collar-carta",
    "pulsera-placas-foto": "pulsera-placas-foto-grabada",
    "collar-placa-grabada": "collar-placa-grabada",
}

PERSONAL_KEYWORDS = re.compile(
    r"personaliz|grabad|foto|laser|láser|nombre|mensaje|fotograb",
    re.I,
)


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def download_image(url, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 500:
        return
    # Shopify CDN: pedir tamaño razonable
    if "cdn.shopify.com" in url and "?" not in url:
        url = url + "?width=800"
    req = urllib.request.Request(url, headers={"User-Agent": "MagillasMigration/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    dest.write_bytes(data)


def main():
    print("Descargando productos…")
    all_products = fetch_json(f"{BASE}/collections/all/products.json?limit=250")["products"]
    print(f"  {len(all_products)} productos")

    # producto → set de categorías
    prod_cats = {p["id"]: set() for p in all_products}
    cat_products = {}
    categorias_meta = {}

    for handle, cat_id, nombre, desc in COLLECTIONS:
        enc = urllib.parse.quote(handle, safe="")
        try:
            prods = fetch_json(f"{BASE}/collections/{enc}/products.json?limit=250")["products"]
        except Exception as e:
            print(f"  ⚠ colección {handle}: {e}")
            prods = []
        cat_products[cat_id] = prods
        categorias_meta[cat_id] = {"id": cat_id, "nombre": nombre, "desc": desc}
        for p in prods:
            prod_cats[p["id"]].add(cat_id)

    # enhancements del JSON anterior
    for old_p in OLD_DATA.get("productos", []):
        hid = LEGACY_HANDLE.get(old_p["id"], old_p["id"])
        enh = {}
        for k in ("preview", "custom", "badge", "destacado"):
            if k in old_p:
                enh[k] = old_p[k]
        if enh:
            ENHANCEMENTS.setdefault(hid, {}).update(enh)

    productos = []
    cat_cover = {}

    for p in all_products:
        handle = p["handle"]
        v = p["variants"][0]
        price = int(round(float(v["price"])))
        compare = v.get("compare_at_price")
        precio_antes = int(round(float(compare))) if compare and float(compare) > price else None

        # categoría principal
        cats = prod_cats.get(p["id"], set())
        primary = "otros"
        for cid in CAT_PRIORITY:
            if cid in cats:
                primary = cid
                break

        # imagen
        img_src = (p.get("images") or [{}])[0].get("src", "")
        ext = ".jpg"
        if ".png" in img_src.lower():
            ext = ".png"
        elif ".webp" in img_src.lower():
            ext = ".webp"
        local_img = f"/img/shop/{handle}{ext}"
        if img_src:
            try:
                download_image(img_src, IMG_DIR / f"{handle}{ext}")
            except Exception as e:
                print(f"  ⚠ imagen {handle}: {e}")

        desc = strip_html(p.get("body_html", "")) or p["title"]
        if len(desc) > 280:
            desc = desc[:277] + "…"

        item = {
            "id": handle,
            "nombre": p["title"].strip(),
            "categoria": primary,
            "precio": price,
            "img": local_img,
            "desc": desc,
        }
        if precio_antes:
            item["precioAntes"] = precio_antes
        if handle in BESTSELLERS or primary == "ofertas":
            item["destacado"] = True
        if handle in BESTSELLERS:
            item.setdefault("badge", "Más vendido")

        # personalización
        enh = ENHANCEMENTS.get(handle, {})
        if enh.get("custom"):
            item["custom"] = enh["custom"]
        elif "personalizables" in cats or PERSONAL_KEYWORDS.search(p["title"] + " " + desc):
            item["custom"] = [
                {"id": "detalle", "label": "Detalle de personalización (nombre, mensaje, foto…)", "type": "text"},
                {"id": "foto", "label": "Si lleva foto, envíala por WhatsApp al confirmar", "type": "nota"},
            ]
        if enh.get("preview"):
            item["preview"] = enh["preview"]
        if enh.get("badge"):
            item["badge"] = enh["badge"]
        if enh.get("destacado"):
            item["destacado"] = True

        if not p.get("available", True) or v.get("inventory_quantity") == 0:
            item["stock"] = 0

        productos.append(item)
        if primary not in cat_cover:
            cat_cover[primary] = local_img

    # categorías con imagen de portada
    categorias = []
    for handle, cat_id, nombre, desc in COLLECTIONS:
        c = dict(categorias_meta[cat_id])
        if cat_id in cat_cover:
            c["img"] = cat_cover[cat_id]
        categorias.append(c)

    # quitar categorías vacías (excepto ofertas si hay precioAntes)
    ids_con_productos = {p["categoria"] for p in productos}
    categorias = [c for c in categorias if c["id"] in ids_con_productos]

    catalogo = {
        "config": {
            "whatsapp": "573165864539",
            "email": "accessoriesmagillas@gmail.com",
            "mayoristaWhatsapp": "573165864539",
            "mayoristaMensaje": "Hola Magillas, me interesa comprar al por mayor. ¿Me pueden enviar el catálogo y precios mayoristas?",
            "envioGratisDesde": 150000,
            "cupones": {"BIENVENIDA10": 10},
            "redes": {
                "instagram": "https://www.instagram.com/magillas_accesorios/",
                "facebook": "https://www.facebook.com/share/1BNg1zwCJL/?mibextid=wwXIfr",
                "tiktok": "https://www.tiktok.com/@magillas_accesorio?_r=1&_t=ZS-92qqy77hU5h",
            },
            "envios": [
                {"id": "recogida", "nombre": "Recogida en Cali", "precio": 0},
                {"id": "cali", "nombre": "Domicilio en Cali", "precio": 8000},
                {"id": "nacional", "nombre": "Envío nacional (Interrapidísimo / Servientrega)", "precio": 12000},
            ],
            "politicas": {
                "envio": "Todos los pedidos se procesan en 1–2 días hábiles tras confirmar la compra. Envíos con Interrapidísimo: Cali 1–2 días, ciudades principales 2–4 días, municipios 4–7 días hábiles.",
                "devoluciones": "5 días hábiles desde la entrega para reportar faltantes. Cambios solo por defecto de fabricación o producto incorrecto. Personalizados sin cambio por retracto. Anillos sin cambio por talla.",
                "pagos": "Nequi, transferencia, contraentrega y Addi (cuotas) según disponibilidad al confirmar por WhatsApp.",
            },
        },
        "categorias": categorias,
        "productos": sorted(productos, key=lambda x: (x["categoria"], x["nombre"].lower())),
    }

    OUT.write_text(json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n✅ {len(productos)} productos → {OUT}")
    print(f"✅ {len(categorias)} categorías")
    print(f"✅ imágenes en {IMG_DIR}")


if __name__ == "__main__":
    main()
