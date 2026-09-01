#!/usr/bin/env python3
"""Aplica configs de vista previa a productos personalizables."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data" / "products.json"
PERS = ROOT / "data" / "personalizacion.json"

SKIP_KEYS = {"plantilla", "custom"}


def merge_preview(tpl: dict, meta: dict, fonts: list) -> dict:
    preview = dict(tpl)
    for k, v in meta.items():
        if k in SKIP_KEYS:
            continue
        preview[k] = v
    preview.setdefault("fonts", fonts)
    preview.setdefault("sizeMul", 1)
    if preview.get("mockup"):
        preview["displayImg"] = preview["mockup"]
    return preview


def main():
    cfg = json.loads(PERS.read_text(encoding="utf-8"))
    catalog = json.loads(PRODUCTS.read_text(encoding="utf-8"))
    plantillas = cfg["plantillas"]
    fonts = cfg.get("fonts", [])
    by_id = {p["id"]: p for p in catalog["productos"]}

    applied = 0
    for pid, meta in cfg["productos"].items():
        p = by_id.get(pid)
        if not p:
            print(f"  ⚠ no existe: {pid}")
            continue

        tpl_name = meta.get("plantilla", "placa")
        tpl = dict(plantillas.get(tpl_name, plantillas["placa"]))
        preview = merge_preview(tpl, meta, fonts)

        campo = meta.get("campo", preview.get("campo", "nombre"))
        label = meta.get("label", "Nombre o mensaje a grabar")
        preview["campo"] = campo

        if meta.get("custom"):
            p["custom"] = meta["custom"]
        elif preview.get("tipo") in ("carta", "relicario", "foto"):
            fields = []
            if preview.get("tipo") == "carta":
                fields.append({"id": campo, "label": label, "type": "text"})
                fields.append({"id": "foto", "label": "Sube tu foto favorita", "type": "file"})
            elif preview.get("tipo") == "relicario":
                fields.append({"id": "foto", "label": "Sube tu foto favorita", "type": "file"})
                if campo:
                    fields.append({"id": campo, "label": label or "Texto (opcional)", "type": "text"})
            elif preview.get("tipo") == "foto":
                fields.append({"id": "foto", "label": "Sube tu foto favorita", "type": "file"})
                fields.append({"id": campo, "label": "Mensaje opcional", "type": "text"})
            p["custom"] = fields
        elif preview.get("capas"):
            p["custom"] = [
                {"id": c["campo"], "label": f"Texto dije {i + 1}", "type": "text"}
                for i, c in enumerate(preview["capas"])
            ]
        else:
            p["custom"] = [
                {"id": campo, "label": label, "type": "text"},
                {"id": "foto", "label": "Si lleva foto, envíala por WhatsApp al confirmar", "type": "nota"},
            ]

        p["preview"] = preview
        p.pop("imgPreview", None)
        applied += 1

    for p in catalog["productos"]:
        if p.get("preview") or p["id"] in cfg["productos"]:
            continue
        if not p.get("custom"):
            continue
        n = p["nombre"].lower()
        if any(k in n for k in ("fotograb", "foto grab")):
            tpl = dict(plantillas["foto"])
            p["custom"] = [
                {"id": "foto", "label": "Sube tu foto favorita", "type": "file"},
                {"id": "mensaje", "label": "Mensaje opcional", "type": "text"},
            ]
            p["preview"] = merge_preview(tpl, {"campo": "mensaje"}, fonts)
            applied += 1
        elif any(k in n for k in ("inicial", "letra")):
            tpl = dict(plantillas["iniciales"])
            p["custom"] = [{"id": "iniciales", "label": "Iniciales a grabar", "type": "text"}]
            p["preview"] = merge_preview(tpl, {"campo": "iniciales"}, fonts)
            applied += 1
        elif "anillo" in n:
            tpl = dict(plantillas["anillo"])
            p["custom"] = [{"id": "nombre", "label": "Nombre o palabra a grabar", "type": "text"}]
            p["preview"] = merge_preview(tpl, {"campo": "nombre"}, fonts)
            applied += 1
        elif any(k in n for k in ("esclava", "placa", "militar", "barra", "argolla")):
            key = "argollas" if "argolla" in n else "placa"
            tpl = dict(plantillas[key])
            p["custom"] = [{"id": "nombre", "label": "Nombre o mensaje a grabar", "type": "text"}]
            p["preview"] = merge_preview(tpl, {"campo": "nombre"}, fonts)
            applied += 1

    for p in catalog["productos"]:
        if not p.get("imgs") and p.get("img"):
            p["imgs"] = [p["img"]]

    PRODUCTS.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with_preview = sum(1 for p in catalog["productos"] if p.get("preview"))
    mockups = sum(1 for p in catalog["productos"] if p.get("preview", {}).get("mockup"))
    print(f"✅ {applied} personalizables · {with_preview} preview · {mockups} con mockup Zepto")


if __name__ == "__main__":
    main()
