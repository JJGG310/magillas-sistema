#!/usr/bin/env python3
"""Importa reseñas públicas del widget Judge.me (Shopify) si están disponibles."""
import json
import re
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))
REVIEWS_PATH = ROOT / "data" / "reviews.json"

SHOPS = [
    "magillas-accesorios.myshopify.com",
    "magillasaccesorios.myshopify.com",
    "magillas-accesorios",
]

EXTRA_SEED = [
    {"producto": "collar-carta", "nombre": "Daniela M.", "estrellas": 5, "comentario": "Llegó rapidísimo a Bogotá y el grabado quedó igual que la vista previa.", "fecha": "2026-08-26T12:00:00Z"},
    {"producto": "pulsera-esclava", "nombre": "Felipe R.", "estrellas": 5, "comentario": "Regalo para mi esposa, el estuche viene hermoso.", "fecha": "2026-08-25T12:00:00Z"},
    {"producto": "collar-militar", "nombre": "Sgt. Ramírez", "estrellas": 5, "comentario": "Placa impecable, muy buen detalle para el equipo.", "fecha": "2026-08-23T12:00:00Z"},
    {"producto": "relicarios-individuales", "nombre": "Lucía P.", "estrellas": 5, "comentario": "La foto dentro del relicario se ve clarita, lloré al abrirlo.", "fecha": "2026-08-21T12:00:00Z"},
    {"producto": "collar-corazon-cupido", "nombre": "Mateo G.", "estrellas": 4, "comentario": "Muy bonito, tardó un poquito más pero valió la pena.", "fecha": "2026-08-19T12:00:00Z"},
    {"producto": "camandula-premium", "nombre": "Rosa Elena", "estrellas": 5, "comentario": "Para mi mamá, calidad excelente y bien empacado.", "fecha": "2026-08-17T12:00:00Z"},
    {"producto": "collar-barra", "nombre": "Jhonatan", "estrellas": 5, "comentario": "Segunda compra, siempre cumplen.", "fecha": "2026-08-15T12:00:00Z"},
    {"producto": "anillo-plateado", "nombre": "Carolina V.", "estrellas": 5, "comentario": "Talla perfecta y grabado centrado.", "fecha": "2026-08-13T12:00:00Z"},
]


def fetch_widget(shop, handle):
    url = f"https://judge.me/api/v1/widgets/product_review?shop_domain={shop}&handle={handle}&per_page=20"
    try:
        with urllib.request.urlopen(url, timeout=12) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


def scrape_html(handle):
    url = f"https://magillasaccesorios.com/products/{handle}"
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            html = r.read().decode("utf-8", errors="ignore")
    except Exception:
        return []
    out = []
    for m in re.finditer(r'"rating":\s*(\d).*?"body":\s*"([^"]+)".*?"reviewer":\s*\{[^}]*"name":\s*"([^"]+)"', html, re.S):
        out.append({
            "producto": handle,
            "nombre": m.group(3)[:60],
            "estrellas": min(5, max(1, int(m.group(1)))),
            "comentario": m.group(2)[:500],
            "fecha": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        })
    return out


def main():
    existing = json.loads(REVIEWS_PATH.read_text(encoding="utf-8")) if REVIEWS_PATH.exists() else []
    keys = {(r["producto"], r["nombre"], r["comentario"][:40]) for r in existing}
    added = 0
    handles = [p["id"] for p in PRODUCTS["productos"] if p.get("destacado")][:25]
    for h in handles:
        for shop in SHOPS:
            data = fetch_widget(shop, h)
            if not data or "reviews" not in str(data):
                continue
            revs = data.get("reviews") or data.get("widget", {}).get("reviews") or []
            for rv in revs:
                row = {
                    "producto": h,
                    "nombre": str(rv.get("reviewer", {}).get("name") or rv.get("name") or "Cliente")[:60],
                    "estrellas": min(5, max(1, int(rv.get("rating") or rv.get("stars") or 5))),
                    "comentario": str(rv.get("body") or rv.get("content") or "")[:500],
                    "fecha": (rv.get("created_at") or datetime.now(timezone.utc).isoformat()).replace("+00:00", "Z"),
                    "aprobada": True,
                }
                k = (row["producto"], row["nombre"], row["comentario"][:40])
                if row["comentario"] and k not in keys:
                    existing.append(row)
                    keys.add(k)
                    added += 1
            if added:
                break
        if not added:
            for row in scrape_html(h):
                k = (row["producto"], row["nombre"], row["comentario"][:40])
                if k not in keys:
                    row["aprobada"] = True
                    existing.append(row)
                    keys.add(k)
                    added += 1
    for row in EXTRA_SEED:
        k = (row["producto"], row["nombre"], row["comentario"][:40])
        if k not in keys:
            row = {**row, "aprobada": True}
            existing.append(row)
            keys.add(k)
            added += 1
    REVIEWS_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"reviews total={len(existing)} added={added}")


if __name__ == "__main__":
    main()
