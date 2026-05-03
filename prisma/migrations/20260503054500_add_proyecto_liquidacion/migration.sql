-- Liquidaciones de cancelacion para proyectos confirmados.
-- Se separa de Cotizacion.estado = cancelada, que representa venta perdida.

CREATE TABLE "ProyectoLiquidacion" (
  "id" TEXT NOT NULL,
  "proyectoId" TEXT NOT NULL,
  "proyectoCorrelativo" TEXT NOT NULL DEFAULT '',
  "estado" TEXT NOT NULL DEFAULT 'borrador',
  "fecha" TEXT NOT NULL DEFAULT '',
  "motivo" TEXT NOT NULL DEFAULT '',
  "lineas" TEXT NOT NULL DEFAULT '[]',
  "resumen" TEXT NOT NULL DEFAULT '{}',
  "creadoPor" TEXT NOT NULL DEFAULT '',
  "actualizadoPor" TEXT NOT NULL DEFAULT '',
  "confirmadoPor" TEXT NOT NULL DEFAULT '',
  "confirmadoEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProyectoLiquidacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProyectoLiquidacion_proyectoId_key" ON "ProyectoLiquidacion"("proyectoId");
CREATE INDEX "ProyectoLiquidacion_proyectoCorrelativo_idx" ON "ProyectoLiquidacion"("proyectoCorrelativo");
CREATE INDEX "ProyectoLiquidacion_estado_idx" ON "ProyectoLiquidacion"("estado");
CREATE INDEX "ProyectoLiquidacion_fecha_idx" ON "ProyectoLiquidacion"("fecha");
