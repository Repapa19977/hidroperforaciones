#!/usr/bin/env bash
# vps-setup.sh — Instalación inicial del stack HidroCRM en VPS Ubuntu 22.04
# Ejecutar COMO ROOT: curl ... | bash    o bien: sudo bash vps-setup.sh
set -e

echo "════════════════════════════════════════════════════"
echo "  HidroCRM VPS Setup — Ubuntu 22.04"
echo "════════════════════════════════════════════════════"
echo ""

# 1. Actualizar sistema
echo "[1/8] Actualizando sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# 2. Dependencias base
echo "[2/8] Instalando dependencias base..."
apt-get install -y curl wget git build-essential ufw

# 3. Node.js 20 (oficial NodeSource)
echo "[3/8] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# 4. PM2 global
echo "[4/8] Instalando PM2..."
npm install -g pm2

# 5. Nginx
echo "[5/8] Instalando Nginx..."
apt-get install -y nginx

# 6. Certbot (SSL)
echo "[6/8] Instalando Certbot (Let's Encrypt)..."
apt-get install -y certbot python3-certbot-nginx

# 7. Firewall — abrir 22 (SSH), 80 (HTTP), 443 (HTTPS)
echo "[7/8] Configurando firewall UFW..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 8. PostgreSQL local (opcional — solo si no usás Neon)
read -rp "¿Instalar PostgreSQL 16 local? (s/N): " INSTALL_PG
if [[ "$INSTALL_PG" =~ ^[sS]$ ]]; then
  echo "[8/8] Instalando PostgreSQL 16..."
  apt-get install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  read -rp "Password para el usuario 'hidrocrm' de la DB: " PG_PASS
  sudo -u postgres psql <<EOF
CREATE DATABASE hidrocrm;
CREATE USER hidrocrm WITH ENCRYPTED PASSWORD '$PG_PASS';
GRANT ALL PRIVILEGES ON DATABASE hidrocrm TO hidrocrm;
\c hidrocrm
GRANT ALL ON SCHEMA public TO hidrocrm;
EOF
  echo ""
  echo "DATABASE_URL para .env:"
  echo "  postgresql://hidrocrm:$PG_PASS@localhost:5432/hidrocrm"
else
  echo "[8/8] Saltando PostgreSQL local — usarás Neon externo."
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  INSTALACIÓN BÁSICA COMPLETA"
echo "════════════════════════════════════════════════════"
echo ""
echo "Siguiente paso:"
echo "  cd /opt"
echo "  git clone <URL_DEL_REPO> hidrocrm"
echo "  cd hidrocrm"
echo "  npm ci"
echo "  nano .env         # pegar variables de entorno"
echo "  npx prisma generate"
echo "  npx prisma migrate deploy"
echo "  npm run build"
echo "  pm2 start npm --name hidrocrm -- start"
echo "  pm2 save && pm2 startup"
echo ""
echo "Después configurá Nginx y Certbot (ver deploy/README.md)"
