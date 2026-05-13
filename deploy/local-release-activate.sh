#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:?archivo .tgz requerido}"
SOURCE_BRANCH="${2:-unknown}"
SOURCE_COMMIT="${3:-unknown}"
BASE="/opt/hidrocrm-releases"
TS="$(date +%Y%m%d-%H%M%S)"
REL="$BASE/$TS-local"
LEGACY_ENV="/opt/hidrocrm/.env"

cleanup_canary() {
  pm2 delete hidrocrm-canary >/dev/null 2>&1 || true
}
trap cleanup_canary EXIT

if [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: no existe el paquete local $ARCHIVE"
  exit 1
fi

echo "==> Detectando release activa"
PID="$(pm2 pid hidrocrm 2>/dev/null || true)"
ACTIVE=""
if [ -n "${PID:-}" ] && [ "$PID" != "0" ]; then
  ACTIVE="$(readlink -f "/proc/$PID/cwd" 2>/dev/null || true)"
fi

ENV_SOURCE="$LEGACY_ENV"
if [ -n "${ACTIVE:-}" ] && [ -f "$ACTIVE/.env" ]; then
  ENV_SOURCE="$ACTIVE/.env"
fi

if [ ! -f "$ENV_SOURCE" ]; then
  echo "ERROR: no encontre .env en release activa ni en /opt/hidrocrm"
  exit 1
fi

echo "==> Release nueva: $REL"
mkdir -p "$REL"
cleanup_canary

echo "==> Descomprimiendo paquete local"
tar -xzf "$ARCHIVE" -C "$REL"

echo "==> Preservando .env desde $ENV_SOURCE"
cp -p "$ENV_SOURCE" "$REL/.env"

cd "$REL"

{
  echo "branch=$SOURCE_BRANCH"
  echo "commit=$SOURCE_COMMIT"
  echo "deployed_at=$(date -Iseconds)"
} > LOCAL_DEPLOY_SOURCE.txt

grep -q '^SMTP_RELAY_HOST=' .env || printf '%s\n' 'SMTP_RELAY_HOST=smtp-relay.gmail.com' >> .env
grep -q '^SMTP_RELAY_PORT=' .env || printf '%s\n' 'SMTP_RELAY_PORT=587' >> .env
grep -q '^COTIZACION_NOTIFY_EMAIL=' .env || printf '%s\n' 'COTIZACION_NOTIFY_EMAIL=rdominguez@hidroperforaciones.com' >> .env

echo "==> Fuente local"
cat LOCAL_DEPLOY_SOURCE.txt

echo "==> Instalando dependencias"
npm ci

echo "==> Audit produccion"
npm audit --omit=dev

echo "==> Prisma"
npx prisma generate
npx prisma migrate deploy

echo "==> Build"
npm run build

echo "==> Canary en puerto 3010"
PORT=3010 NODE_ENV=production pm2 start npm --name hidrocrm-canary -- start
sleep 5
curl -fsSI http://127.0.0.1:3010/login
cleanup_canary

echo "==> Activando release"
pm2 delete hidrocrm || true
NODE_ENV=production pm2 start npm --name hidrocrm -- start
pm2 save

echo "==> Verificacion final"
sleep 5
pm2 status --no-color
curl -fsSI http://127.0.0.1:3000/login
df -h /

rm -f "$ARCHIVE"
echo "DEPLOY_OK release=$REL"
