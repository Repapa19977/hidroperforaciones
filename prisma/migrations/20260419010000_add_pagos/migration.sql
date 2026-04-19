-- Migración 2026-04-19 Fase E: Tabla Pago (control de pagos recibidos por proyecto)

CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "proyectoCorrelativo" TEXT NOT NULL DEFAULT '',
    "hitoId" TEXT NOT NULL,
    "hitoLabel" TEXT NOT NULL DEFAULT '',
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TEXT NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'transferencia',
    "referencia" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "registradoPor" TEXT NOT NULL DEFAULT '',
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,
    "motivoBorrado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pago_proyectoId_idx" ON "Pago"("proyectoId");
CREATE INDEX "Pago_hitoId_idx" ON "Pago"("hitoId");
CREATE INDEX "Pago_fecha_idx" ON "Pago"("fecha");
CREATE INDEX "Pago_eliminadoEn_idx" ON "Pago"("eliminadoEn");

ALTER TABLE "Pago" ADD CONSTRAINT "Pago_proyectoId_fkey"
  FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
