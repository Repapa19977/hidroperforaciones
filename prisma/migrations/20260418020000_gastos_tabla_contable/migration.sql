-- Convertir GastoExtra en una tabla contable con crédito y vencimiento.
-- Se agregan columnas nuevas y se mantienen los campos legacy (concepto, montoUnit) para no romper datos existentes.

ALTER TABLE "GastoExtra" ADD COLUMN "producto"         TEXT NOT NULL DEFAULT '';
ALTER TABLE "GastoExtra" ADD COLUMN "descripcion"      TEXT NOT NULL DEFAULT '';
ALTER TABLE "GastoExtra" ADD COLUMN "costoUnitario"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "GastoExtra" ADD COLUMN "valorUnitario"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "GastoExtra" ADD COLUMN "diasCredito"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GastoExtra" ADD COLUMN "fechaVencimiento" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GastoExtra" ADD COLUMN "pagado"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GastoExtra" ADD COLUMN "proveedor"        TEXT NOT NULL DEFAULT '';

-- Migrar datos existentes: producto = concepto, costoUnitario = montoUnit
UPDATE "GastoExtra" SET "producto" = "concepto", "costoUnitario" = "montoUnit" WHERE "producto" = '';

-- Índice nuevo para alertas por vencimiento
CREATE INDEX "GastoExtra_fechaVencimiento_idx" ON "GastoExtra"("fechaVencimiento");
