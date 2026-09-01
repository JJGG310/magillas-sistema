#!/usr/bin/env python3
"""Crea (o promueve) un usuario administrador del panel de Magillas.

Uso:  python3 scripts/crear-admin.py

Pide correo y contraseña por teclado. La contraseña NO se guarda en ningún
archivo ni se muestra en pantalla: viaja directo a Supabase Auth.
"""
import getpass, json, re, sys, urllib.request, urllib.error
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / '.env'
env = {}
for line in ENV_PATH.read_text().splitlines():
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip()

for k in ('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ADMIN_TOKEN'):
    if not env.get(k):
        sys.exit(f'Falta {k} en .env')


def post(path, payload, extra_headers=None):
    headers = {
        'apikey': env['SUPABASE_ANON_KEY'],
        'Authorization': 'Bearer ' + env['SUPABASE_ANON_KEY'],
        'Content-Type': 'application/json',
    }
    headers.update(extra_headers or {})
    req = urllib.request.Request(env['SUPABASE_URL'] + path,
                                 data=json.dumps(payload).encode(),
                                 headers=headers, method='POST')
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read() or '{}'), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode()[:300]


correo = input('Correo del administrador: ').strip()
clave = getpass.getpass('Contraseña (mínimo 8 caracteres): ')
if len(clave) < 8:
    sys.exit('La contraseña debe tener al menos 8 caracteres.')
if clave != getpass.getpass('Repite la contraseña: '):
    sys.exit('Las contraseñas no coinciden.')

print('\n1/2 Registrando usuario…')
_, err = post('/auth/v1/signup', {'email': correo, 'password': clave})
if err and 'already registered' not in err.lower():
    print('   Aviso:', err)
else:
    print('   Usuario listo.')

print('2/2 Dando permisos de administrador…')
res, err = post('/rest/v1/rpc/magillas_hacer_admin',
                {'p_secret': env['ADMIN_TOKEN'], 'p_email': correo})
if err:
    sys.exit('   Error: ' + err)
if not res.get('ok'):
    sys.exit('   ' + res.get('error', 'no se pudo'))

print(f"\n✅ Listo. {correo} ya puede entrar al panel.")
print("   Si olvidas la contraseña, vuelve a correr este script con el mismo correo")
print("   (usa 'Recuperar contraseña' del panel una vez esté desplegado).")
