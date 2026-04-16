#!/bin/sh
set -e

echo "==> Ejecutando migraciones..."
npx prisma migrate deploy

echo "==> Cargando datos iniciales..."
npx prisma db execute --file /app/seed-prod.sql || true

echo "==> Iniciando HidroCRM..."
exec npm start
