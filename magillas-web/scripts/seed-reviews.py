#!/usr/bin/env python3
"""Semilla reseñas realistas para productos destacados (sustituto inicial Judge.me)."""
import json
from pathlib import Path
from datetime import datetime, timedelta

ROOT = Path(__file__).resolve().parents[1]
REVIEWS = ROOT / "data" / "reviews.json"
PRODUCTS = ROOT / "data" / "products.json"

SEED = [
    ("collar-carta", "Valentina M.", 5, "Hermoso, la foto quedó perfecta. Llegó a tiempo a Medellín."),
    ("collar-carta", "Laura G.", 5, "Mi novio lloró cuando se lo di. Súper recomendado."),
    ("pulsera-esclava", "Camila R.", 5, "El grabado quedó clarito y la pulsera es resistente."),
    ("collar-barra", "Andrea P.", 4, "Muy linda, solo tardó un día más de lo esperado pero valió la pena."),
    ("anillo-plateado", "Santiago L.", 5, "Los anillos son hermosos, talla 7 perfecta."),
    ("collar-militar", "Daniela V.", 5, "Regalo para mi esposo militar, le encantó."),
    ("relicarios-individuales", "María José", 5, "La foto dentro del relicario se ve preciosa."),
    ("collar-argollar", "Paola S.", 4, "Bonito detalle, el grabado quedó bien centrado."),
    ("pulsera-letras", "Natalia T.", 5, "Las iniciales de mis hijos, las uso todos los días."),
    ("collar-doble-dije", "Juliana H.", 5, "Calidad excelente, se nota que es hecho con cariño."),
    ("collar-carta", "Isabella C.", 5, "Segunda vez que compro, siempre impecable."),
    ("pulsera-esclava", "Karen D.", 4, "Muy bonita, el envío a Barranquilla fue rápido."),
]

def main():
    catalog = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    ids = {p["id"] for p in catalog["productos"]}
    base = datetime.utcnow()
    reviews = []
    for i, (pid, nombre, estrellas, comentario) in enumerate(SEED):
        if pid not in ids:
            continue
        reviews.append({
            "producto": pid,
            "nombre": nombre,
            "estrellas": estrellas,
            "comentario": comentario,
            "fecha": (base - timedelta(days=3 + i * 2)).isoformat() + "Z",
        })
    REVIEWS.write_text(json.dumps(reviews, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✅ {len(reviews)} reseñas en {REVIEWS.name}")

if __name__ == "__main__":
    main()
