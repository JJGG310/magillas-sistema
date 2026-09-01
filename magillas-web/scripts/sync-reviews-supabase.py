#!/usr/bin/env python3
"""Sincroniza data/reviews.json → Supabase (inserta faltantes y aprueba)."""
import json
import os
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWS = json.loads((ROOT / "data" / "reviews.json").read_text(encoding="utf-8"))

SB_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SB_ANON = os.environ.get("SUPABASE_ANON_KEY", "")
ADMIN = os.environ.get("ADMIN_TOKEN", "")

if not SB_URL or not SB_ANON or not ADMIN:
    # leer .env local
    env = {}
    try:
        for line in (ROOT / ".env").read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    SB_URL = SB_URL or env.get("SUPABASE_URL", "").rstrip("/")
    SB_ANON = SB_ANON or env.get("SUPABASE_ANON_KEY", "")
    ADMIN = ADMIN or env.get("ADMIN_TOKEN", "")

if not all([SB_URL, SB_ANON, ADMIN]):
    raise SystemExit("Faltan SUPABASE_URL, SUPABASE_ANON_KEY y ADMIN_TOKEN")

def sb_get(path):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        headers={"apikey": SB_ANON, "Authorization": f"Bearer {SB_ANON}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def rpc(fn, args):
    body = json.dumps({"p_secret": ADMIN, **args}).encode()
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/rpc/{fn}",
        data=body,
        headers={
            "apikey": SB_ANON,
            "Authorization": f"Bearer {SB_ANON}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

existentes = sb_get("magillas_reviews?select=producto,nombre,fecha")
keys = {(r["producto"], r["nombre"], r["fecha"][:19]) for r in existentes}

insertados = 0
aprobados = 0
for rv in REVIEWS:
    fecha = rv["fecha"].replace("Z", "+00:00")
    key = (rv["producto"], rv["nombre"], fecha[:19])
    if key in keys:
        continue
    rpc("magillas_guardar_resena", {
        "p_producto": rv["producto"],
        "p_nombre": rv["nombre"],
        "p_estrellas": int(rv["estrellas"]),
        "p_comentario": rv.get("comentario") or "",
        "p_fecha": fecha,
    })
    insertados += 1
    if rv.get("aprobada", True):
        rpc("magillas_aprobar_resena", {
            "p_fecha": fecha,
            "p_producto": rv["producto"],
            "p_aprobada": True,
        })
        aprobados += 1
    keys.add(key)

print(f"ok insertados={insertados} aprobados={aprobados} total_json={len(REVIEWS)}")
