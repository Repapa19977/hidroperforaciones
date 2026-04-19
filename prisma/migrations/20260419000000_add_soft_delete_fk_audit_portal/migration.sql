-- Migración 2026-04-19: Soft delete + FK preparación + Portal cliente + Bot tokens + Audit log
-- Cambios agregativos: solo columnas nullable y tablas nuevas. NO toca data existente.

-- ═══════════════════════════════════════════════════════════════
-- Soft delete + contactoId en Cotizacion
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "Cotizacion" ADD COLUMN "contactoId" TEXT;
ALTER TABLE "Cotizacion" ADD COLUMN "eliminadaEn" TIMESTAMP(3);
ALTER TABLE "Cotizacion" ADD COLUMN "eliminadaPor" TEXT;
ALTER TABLE "Cotizacion" ADD COLUMN "motivoBorrado" TEXT;
CREATE INDEX "Cotizacion_contactoId_idx" ON "Cotizacion"("contactoId");
CREATE INDEX "Cotizacion_eliminadaEn_idx" ON "Cotizacion"("eliminadaEn");

-- ═══════════════════════════════════════════════════════════════
-- Soft delete + contactoId en Oportunidad
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "Oportunidad" ADD COLUMN "contactoId" TEXT;
ALTER TABLE "Oportunidad" ADD COLUMN "eliminadaEn" TIMESTAMP(3);
ALTER TABLE "Oportunidad" ADD COLUMN "eliminadaPor" TEXT;
ALTER TABLE "Oportunidad" ADD COLUMN "motivoBorrado" TEXT;
CREATE INDEX "Oportunidad_contactoId_idx" ON "Oportunidad"("contactoId");
CREATE INDEX "Oportunidad_eliminadaEn_idx" ON "Oportunidad"("eliminadaEn");

-- ═══════════════════════════════════════════════════════════════
-- Soft delete + portal + contactoId en Proyecto
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "Proyecto" ADD COLUMN "contactoId" TEXT;
ALTER TABLE "Proyecto" ADD COLUMN "visibleParaCliente" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Proyecto" ADD COLUMN "eliminadoEn" TIMESTAMP(3);
ALTER TABLE "Proyecto" ADD COLUMN "eliminadoPor" TEXT;
ALTER TABLE "Proyecto" ADD COLUMN "motivoBorrado" TEXT;
CREATE INDEX "Proyecto_contactoId_idx" ON "Proyecto"("contactoId");
CREATE INDEX "Proyecto_eliminadoEn_idx" ON "Proyecto"("eliminadoEn");

-- ═══════════════════════════════════════════════════════════════
-- Soft delete en Contacto
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "Contacto" ADD COLUMN "eliminadoEn" TIMESTAMP(3);
ALTER TABLE "Contacto" ADD COLUMN "eliminadoPor" TEXT;
ALTER TABLE "Contacto" ADD COLUMN "motivoBorrado" TEXT;
CREATE INDEX "Contacto_eliminadoEn_idx" ON "Contacto"("eliminadoEn");

-- ═══════════════════════════════════════════════════════════════
-- Usuario: rol extendido + campos para cliente_final + magic link
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "Usuario" ADD COLUMN "contactoId" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Usuario" ADD COLUMN "ultimoAcceso" TIMESTAMP(3);
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");
CREATE INDEX "Usuario_contactoId_idx" ON "Usuario"("contactoId");
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- ═══════════════════════════════════════════════════════════════
-- ServiceToken — API keys para bots (OpenClaw, integraciones)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "ServiceToken" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoUso" TIMESTAMP(3),
    "vecesUsado" INTEGER NOT NULL DEFAULT 0,
    "creadoPor" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',
    "expiraEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceToken_nombre_key" ON "ServiceToken"("nombre");
CREATE UNIQUE INDEX "ServiceToken_tokenHash_key" ON "ServiceToken"("tokenHash");
CREATE INDEX "ServiceToken_activo_idx" ON "ServiceToken"("activo");
CREATE INDEX "ServiceToken_tokenHash_idx" ON "ServiceToken"("tokenHash");

-- ═══════════════════════════════════════════════════════════════
-- AuditLog — registro de acciones sensibles
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL DEFAULT '',
    "rol" TEXT NOT NULL DEFAULT '',
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL DEFAULT '',
    "antes" TEXT NOT NULL DEFAULT '',
    "despues" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_usuario_idx" ON "AuditLog"("usuario");
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_rol_idx" ON "AuditLog"("rol");

-- ═══════════════════════════════════════════════════════════════
-- MagicLink — login sin contraseña para cliente final
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MagicLink_token_key" ON "MagicLink"("token");
CREATE INDEX "MagicLink_token_idx" ON "MagicLink"("token");
CREATE INDEX "MagicLink_usuarioId_idx" ON "MagicLink"("usuarioId");
CREATE INDEX "MagicLink_expiraEn_idx" ON "MagicLink"("expiraEn");

-- ═══════════════════════════════════════════════════════════════
-- OportunidadAI — historial de conversaciones con el bot Hidra
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "OportunidadAI" (
    "id" TEXT NOT NULL,
    "oportunidadId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "usuario" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OportunidadAI_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OportunidadAI_oportunidadId_idx" ON "OportunidadAI"("oportunidadId");
CREATE INDEX "OportunidadAI_oportunidadId_createdAt_idx" ON "OportunidadAI"("oportunidadId", "createdAt");
