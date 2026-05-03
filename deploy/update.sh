#!/usr/bin/env bash
# update.sh — Pull + build + reload PM2 del app en producción
# Uso: cd /opt/hidrocrm && bash deploy/update.sh
set -e

echo "==> Pull del repo..."
git pull --ff-only

echo "==> Instalar dependencias..."
npm ci

echo "==> Generar Prisma Client..."
npx prisma generate

echo "==> Aplicar migraciones..."
npx prisma migrate deploy

echo "==> Build Next.js..."
npm run build

echo "==> Reload PM2..."
pm2 reload hidrocrm

echo "==> Estado:"
pm2 status hidrocrm

echo ""
echo "✅ Deploy completado. Verificar en https://tu-dominio.com"
