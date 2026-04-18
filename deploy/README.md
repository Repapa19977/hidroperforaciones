# Deploy HidroCRM en VPS Hostinger

Guía paso a paso para deployar HidroCRM en un VPS Hostinger (Ubuntu 22.04) con dominio propio + SSL gratis.

## Pre-requisitos

- [ ] VPS Hostinger KVM 2 o superior (2 GB RAM, Ubuntu 22.04 LTS)
- [ ] Dominio registrado (ej. `hidroperforaciones.com`)
- [ ] Acceso SSH al VPS (usuario + contraseña o llave SSH)
- [ ] DNS apuntado al VPS (registro A: `@` y `www` → IP del VPS)
- [ ] Decisión: ¿Postgres en Neon (gratis, managed) o local en el VPS?

## Paso 1 — Apuntar dominio al VPS

En el panel de Hostinger (Dominio → DNS):

```
Tipo  Nombre  Valor                TTL
A     @       <IP_DEL_VPS>         3600
A     www     <IP_DEL_VPS>         3600
```

Esperá 10-30 min para propagación.

## Paso 2 — Conexión SSH

Desde Windows PowerShell o cmd:

```bash
ssh root@<IP_DEL_VPS>
```

(o el usuario que te dio Hostinger)

## Paso 3 — Instalar stack base

Copiar y ejecutar como root el script `vps-setup.sh`. Instala:
- Node.js 20
- Git
- Nginx (reverse proxy)
- Certbot (SSL Let's Encrypt)
- PM2 (process manager)
- PostgreSQL 16 (opcional — solo si NO usás Neon)

```bash
curl -fsSL https://raw.githubusercontent.com/<tu_user>/hidrocrm/main/deploy/vps-setup.sh | bash
```

O copiá el archivo `deploy/vps-setup.sh` al VPS y ejecutalo con `bash vps-setup.sh`.

## Paso 4 — Clonar repo

```bash
cd /opt
git clone https://github.com/<tu_user>/hidrocrm.git
cd hidrocrm
npm ci
```

## Paso 5 — Variables de entorno

Crear `/opt/hidrocrm/.env`:

```bash
# ── Base de datos ──
# Opción A: Neon (recomendado — managed gratis)
DATABASE_URL="postgresql://usuario:pass@ep-xxx.us-east-2.aws.neon.tech/hidrocrm?sslmode=require"

# Opción B: Postgres local
# DATABASE_URL="postgresql://hidrocrm:password_seguro@localhost:5432/hidrocrm"

# ── Auth ──
JWT_SECRET="<generar con: openssl rand -hex 64>"

# ── Email (opcional — si usás Resend para bitácora al cliente) ──
RESEND_API_KEY="re_xxx"
RESEND_FROM="no-reply@hidroperforaciones.com"

# ── Entorno ──
NODE_ENV="production"
PORT="3000"
```

Proteger permisos:

```bash
chmod 600 /opt/hidrocrm/.env
```

## Paso 6 — Migraciones de DB + seed

```bash
cd /opt/hidrocrm
npx prisma generate
npx prisma migrate deploy
# Opcional — cargar usuarios/config iniciales
npx prisma db execute --file seed-prod.sql || true
```

## Paso 7 — Build + PM2

```bash
cd /opt/hidrocrm
npm run build
pm2 start npm --name hidrocrm -- start
pm2 save
pm2 startup      # genera el comando para ejecutar al boot — copiar y ejecutar lo que imprima
```

## Paso 8 — Nginx reverse proxy

Copiar `deploy/nginx.conf.template` al VPS como `/etc/nginx/sites-available/hidrocrm`, reemplazar `TU_DOMINIO.com` por el real, y:

```bash
ln -s /etc/nginx/sites-available/hidrocrm /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## Paso 9 — SSL Let's Encrypt (gratis)

```bash
certbot --nginx -d TU_DOMINIO.com -d www.TU_DOMINIO.com --non-interactive --agree-tos -m rodriporres@gmail.com
```

Auto-renueva cada 90 días. Ya.

## Paso 10 — Probar

```
https://TU_DOMINIO.com
```

Debería cargar HidroCRM con SSL válido (candado verde).

## Actualizar el app después (CI/CD manual)

Cada vez que quieras deployar cambios:

```bash
cd /opt/hidrocrm
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload hidrocrm
```

O usá el script `deploy/update.sh`.

## Logs y monitoreo

```bash
pm2 logs hidrocrm         # logs en vivo
pm2 status                # estado del proceso
pm2 restart hidrocrm      # reiniciar
systemctl status nginx    # estado Nginx
tail -f /var/log/nginx/error.log
```

## Backups de DB

Si usás Neon: automático.
Si usás Postgres local:

```bash
# diario con cron
pg_dump hidrocrm | gzip > /backups/hidrocrm_$(date +%Y%m%d).sql.gz
```

## Troubleshooting

- **502 Bad Gateway**: revisar `pm2 logs hidrocrm` — el app no está corriendo.
- **Base de datos no conecta**: verificar `DATABASE_URL` en `.env` + que el puerto 5432 esté abierto (si es local).
- **SSL no válido**: `certbot renew --dry-run` para probar.
- **DNS no propagado**: esperar más tiempo, probar con `dig TU_DOMINIO.com`.
