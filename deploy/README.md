# Deploy HidroCRM En VPS

Guia segura para desplegar HidroCRM en un VPS Ubuntu con dominio, Nginx, PM2 y SSL.

Esta guia usa placeholders. No escribir IPs reales, passwords, tokens, URLs privadas de base de datos ni secretos en el repositorio.

## Pre-Requisitos

- VPS Ubuntu 22.04/24.04 LTS.
- Dominio apuntando al VPS.
- Acceso SSH con usuario autorizado o llave SSH.
- Base de datos PostgreSQL administrada o local.
- Archivo `.env` creado directamente en el VPS, nunca versionado.

## DNS

En el panel del dominio:

```text
Tipo  Nombre  Valor        TTL
A     @       <VPS_HOST>   3600
A     www     <VPS_HOST>   3600
```

## Conexion SSH

```bash
ssh <SSH_USER>@<VPS_HOST>
```

No guardar credenciales SSH reales en README, issues, commits, scripts ni logs compartidos.

## Instalar Stack Base

Copiar `deploy/vps-setup.sh` al VPS y ejecutarlo con el usuario autorizado:

```bash
bash deploy/vps-setup.sh
```

Evitar `curl | bash` con URLs no verificadas.

## Clonar Repo

```bash
cd /opt
git clone https://github.com/<OWNER>/<REPO>.git hidrocrm
cd hidrocrm
npm ci
```

## Variables De Entorno

Crear `/opt/hidrocrm/.env` directamente en el VPS usando `.env.example` como plantilla.

Ejemplo seguro:

```bash
DATABASE_URL="<DATABASE_URL_POSTGRESQL>"
JWT_SECRET="<SECRET_GENERADO>"
JWT_EXP="8h"
SUPERADMIN_USERNAME="<USUARIO_SUPERADMIN>"
SUPERADMIN_PASSWORD_HASH="<HASH_DE_PASSWORD>"
SUPERADMIN_VENDEDOR="<NOMBRE_VISIBLE>"
TOTP_ENCRYPTION_KEY="<SECRET_GENERADO>"
RESEND_API_KEY="<RESEND_API_KEY>"
SMTP_RELAY_HOST="smtp-relay.gmail.com"
SMTP_RELAY_PORT="587"
COTIZACION_NOTIFY_EMAIL="rdominguez@hidroperforaciones.com"
CRON_SECRET="<SECRET_GENERADO>"
NODE_ENV="production"
PORT="3000"
```

Proteger permisos:

```bash
chmod 600 /opt/hidrocrm/.env
```

## Migraciones Y Build

```bash
cd /opt/hidrocrm
npx prisma generate
npx prisma migrate deploy
npm run build
```

## PM2

```bash
pm2 start npm --name hidrocrm -- start
pm2 save
pm2 startup
```

Si el proceso ya existe:

```bash
pm2 reload hidrocrm
```

## Nginx

Copiar `deploy/nginx.conf.template` al VPS como `/etc/nginx/sites-available/hidrocrm`, reemplazar `TU_DOMINIO.com` por el dominio real y validar:

```bash
ln -s /etc/nginx/sites-available/hidrocrm /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## SSL

```bash
certbot --nginx -d <DOMINIO> -d www.<DOMINIO> --non-interactive --agree-tos -m <EMAIL_ADMIN>
```

Validar renovacion:

```bash
certbot renew --dry-run
```

## Actualizar App

```bash
cd /opt/hidrocrm
git pull --ff-only
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload hidrocrm
```

Tambien se puede usar:

```bash
bash deploy/update.sh
```

## Backups

Antes de deploys grandes:

```bash
mkdir -p /opt/hidrocrm-backups
tar \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=dev.db \
  --exclude='*.log' \
  -czf /opt/hidrocrm-backups/hidrocrm-<FECHA>.tgz \
  -C /opt hidrocrm
```

Si la base de datos es externa, usar snapshots/backups del proveedor. Si es local, generar dump con credenciales seguras fuera del repo.

## Verificacion

```bash
pm2 status hidrocrm
curl -I http://127.0.0.1:3000
nginx -t
df -h /
```

## Troubleshooting

- `502 Bad Gateway`: revisar `pm2 logs hidrocrm` y puerto local.
- Error de base de datos: validar `DATABASE_URL` en el `.env` del VPS.
- SSL no valido: revisar DNS y `certbot renew --dry-run`.
- Disco creciendo: revisar backups que no excluyan `node_modules`, `.next` o `.git`.
