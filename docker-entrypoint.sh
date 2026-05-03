#!/bin/sh
set -e

echo "==> Ejecutando migraciones..."
npx prisma migrate deploy

if [ "${RUN_SEED_PROD:-0}" = "1" ]; then
  echo "==> Cargando datos iniciales..."
  npx prisma db execute --file /app/seed-prod.sql
else
  echo "==> Seed inicial omitido (RUN_SEED_PROD!=1)"
fi

echo "==> Iniciando HidroCRM..."
exec npm start
