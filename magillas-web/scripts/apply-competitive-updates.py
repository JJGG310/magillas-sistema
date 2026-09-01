#!/usr/bin/env python3
"""Ofertas, ocasiones y tags para semanas A–C."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data" / "products.json"

OFERTAS = {
    "collar-carta": 75000,
    "pulsera-esclava": 45000,
    "collar-corazon-cupido": 55000,
    "candonga-grande": 35000,
    "pulsera-barca": 28000,
    "camandula-premium": 65000,
    "collar-barra": 52000,
    "anillo-plateado": 38000,
    "collar-militar": 58000,
    "relicarios-individuales": 72000,
}

OCASIONES = [
    {
        "id": "san-valentin",
        "nombre": "San Valentín",
        "desc": "Regalos con amor para pareja",
        "img": "/img/shop/collar-carta.jpg",
        "productos": ["collar-carta", "collar-corazon-cupido", "collar-doble-dije", "anillo-plateado", "collar-corazon-esmeralda"],
    },
    {
        "id": "dia-madre",
        "nombre": "Día de la Madre",
        "desc": "Detalles que emocionan a mamá",
        "img": "/img/shop/collar-barra.jpg",
        "productos": ["collar-carta", "collar-barra", "pulsera-barca", "relicarios-individuales", "pulsera-letras"],
    },
    {
        "id": "dia-padre",
        "nombre": "Día del Padre",
        "desc": "Placas y esclavas para papá",
        "img": "/img/shop/collar-militar.jpg",
        "productos": ["collar-militar", "pulsera-esclava", "collar-placa-grabada", "pulsera-letras"],
    },
    {
        "id": "navidad",
        "nombre": "Navidad",
        "desc": "Regalos con estuche incluido",
        "img": "/img/shop/estuche-rosa.jpg",
        "productos": ["estuche-rosa", "collar-carta", "camandula-premium", "collar-argollar"],
    },
]

def main():
    data = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    data["config"]["ocasiones"] = OCASIONES
    data["config"]["beneficios"] = [
        "🎁 Estuche de regalo incluido",
        "🚚 Envío nacional gratis desde $150.000",
        "💳 PSE · Nequi · Tarjeta · Contraentrega",
        "✨ Vista previa antes de pagar",
    ]
    data["config"]["pagosOnline"] = True
    data["config"]["addiDesde"] = 100000
    ids = {p["id"] for p in data["productos"]}
    for oid, antes in OFERTAS.items():
        for p in data["productos"]:
            if p["id"] == oid:
                p["precioAntes"] = antes
                if p.get("categoria") != "ofertas":
                    p["badge"] = p.get("badge") or "Oferta"
    for oc in OCASIONES:
        oc["productos"] = [x for x in oc["productos"] if x in ids]
    PRODUCTS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("ok", len(OFERTAS), "ofertas", len(OCASIONES), "ocasiones")

if __name__ == "__main__":
    main()
