FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Generar cliente Prisma y compilar Next.js
# La URL es solo para que Prisma lea el schema — no conecta durante el build
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npx prisma generate
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npm run build

EXPOSE 3000

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
