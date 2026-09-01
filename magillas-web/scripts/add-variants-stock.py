#!/usr/bin/env python3
"""Añade stock por defecto y opciones de variante (color/talla) como Shopify."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data" / "products.json"

VARIANTES = {
    "anillo-plateado": [
        {"id": "color", "label": "Color", "type": "select", "options": ["Plateado", "Dorado", "Negro"]},
        {"id": "talla", "label": "Talla", "type": "select", "options": ["6", "7", "8", "9", "10", "11", "12"]},
    ],
    "pulsera-esclava": [
        {"id": "color", "label": "Acabado", "type": "select", "options": ["Dorado", "Plateado"]},
    ],
    "pulsera-esclava-cuero": [
        {"id": "color", "label": "Acabado de la placa", "type": "select", "options": ["Dorado", "Plateado"]},
    ],
    "pulseras-esclava": [
        {"id": "color", "label": "Acabado", "type": "select", "options": ["Dorado", "Plateado"]},
    ],
    "esclava-tejida": [
        {"id": "color", "label": "Acabado", "type": "select", "options": ["Dorado", "Plateado"]},
    ],
    "pulsera-balitista": [
        {"id": "color", "label": "Acabado", "type": "select", "options": ["Dorado", "Plateado"]},
    ],
    "pulseras-corona-personalizada": [
        {"id": "color", "label": "Acabado", "type": "select", "options": ["Dorado", "Plateado"]},
    ],
}

def main():
    catalog = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    n_stock = n_var = 0
    for p in catalog["productos"]:
        if p.get("stock") is None:
            p["stock"] = 50
            n_stock += 1
        if p["id"] in VARIANTES:
            extra = VARIANTES[p["id"]]
            custom = list(p.get("custom") or [])
            for v in extra:
                if not any(c.get("id") == v["id"] for c in custom):
                    custom.insert(0, v)
            p["custom"] = custom
            n_var += 1
    PRODUCTS.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✅ stock en {n_stock} productos · variantes en {n_var}")

if __name__ == "__main__":
    main()
