#!/usr/bin/env python3
"""Convierte notas 'envía foto por WA' en upload opcional en sitio (32 personalizables)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data" / "products.json"

FOTO_REQUERIDA = {
    "relicarios-individuales",
    "collar-corazon-cupido",
    "collar-doble-dije",
}


def main():
    data = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    n = 0
    for p in data["productos"]:
        custom = p.get("custom") or []
        if not custom:
            continue
        has_file = any(c.get("type") == "file" for c in custom)
        new_custom = []
        for c in custom:
            if c.get("type") == "nota":
                n += 1
                req = p["id"] in FOTO_REQUERIDA or "relicario" in p["id"]
                new_custom.append({
                    "id": "foto",
                    "label": "Sube tu foto para el grabado" if req else "Foto o referencia para el grabado (opcional)",
                    "type": "file",
                    "opcional": not req,
                })
            else:
                new_custom.append(c)
        if not has_file and not any(c.get("type") == "file" for c in new_custom):
            pass
        p["custom"] = new_custom
        if p["id"] in FOTO_REQUERIDA:
            p["fotoRequerida"] = True
    cfg = data.setdefault("config", {})
    cfg["upsells"] = [
        {"id": "decorative-gift-bag-for-special-occasions", "label": "Bolsa de regalo premium"},
        {"id": "estuche-amor", "label": "Estuche corazón"},
    ]
    cfg["empaquePremium"] = {"id": "decorative-gift-bag-for-special-occasions", "precio": 7900}
    cfg["addi"] = {"activo": True, "desde": 100000, "url": "https://www.addi.com/co/compradores/como-funciona-addi/"}
    cfg["analytics"] = cfg.get("analytics") or {"ga4": "", "metaPixel": ""}
    cfg["quizRegalo"] = {
        "preguntas": [
            {"id": "para", "texto": "¿Para quién es el regalo?", "opciones": [
                {"v": "pareja", "l": "Mi pareja"},
                {"v": "madre", "l": "Mamá"},
                {"v": "padre", "l": "Papá / militar"},
                {"v": "amigo", "l": "Amigo/a"},
            ]},
            {"id": "presupuesto", "texto": "¿Cuál es tu presupuesto?", "opciones": [
                {"v": "bajo", "l": "Hasta $50.000"},
                {"v": "medio", "l": "$50.000 – $100.000"},
                {"v": "alto", "l": "Más de $100.000"},
            ]},
            {"id": "tipo", "texto": "¿Qué tipo de pieza buscas?", "opciones": [
                {"v": "collar", "l": "Collar"},
                {"v": "pulsera", "l": "Pulsera"},
                {"v": "foto", "l": "Con foto / relicario"},
                {"v": "militar", "l": "Placa militar"},
            ]},
        ],
        "mapa": {
            "pareja|medio|collar": ["collar-carta", "collar-doble-dije", "collar-corazon-cupido"],
            "madre|medio|collar": ["collar-carta", "collar-barra", "relicarios-individuales"],
            "padre|medio|militar": ["collar-militar", "pulsera-esclava", "collar-mini-placa-militar"],
            "amigo|bajo|pulsera": ["pulsera-letras", "pulsera-esclava", "pulsera-barca"],
            "pareja|alto|foto": ["relicarios-individuales", "collar-corazon-cupido", "collar-carta"],
        },
    }
    PRODUCTS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("ok notas_convertidas=", n)

if __name__ == "__main__":
    main()
