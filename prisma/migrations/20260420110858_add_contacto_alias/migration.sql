-- AlterTable
ALTER TABLE "Contacto" ADD COLUMN     "alias" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "GastoExtra" ALTER COLUMN "concepto" SET DEFAULT '',
ALTER COLUMN "montoUnit" SET DEFAULT 0,
ALTER COLUMN "producto" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Contacto_vendedor_idx" ON "Contacto"("vendedor");

-- CreateIndex
CREATE INDEX "Contacto_tipo_idx" ON "Contacto"("tipo");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_vendedor_idx" ON "Cotizacion"("vendedor");

-- CreateIndex
CREATE INDEX "Cotizacion_tipo_idx" ON "Cotizacion"("tipo");

-- CreateIndex
CREATE INDEX "Cotizacion_vendedor_estado_idx" ON "Cotizacion"("vendedor", "estado");

-- CreateIndex
CREATE INDEX "Oportunidad_etapa_idx" ON "Oportunidad"("etapa");

-- CreateIndex
CREATE INDEX "Oportunidad_vendedor_idx" ON "Oportunidad"("vendedor");

-- CreateIndex
CREATE INDEX "Oportunidad_vendedor_etapa_idx" ON "Oportunidad"("vendedor", "etapa");

-- CreateIndex
CREATE INDEX "Proyecto_estado_idx" ON "Proyecto"("estado");

-- CreateIndex
CREATE INDEX "Proyecto_vendedor_idx" ON "Proyecto"("vendedor");

-- CreateIndex
CREATE INDEX "Proyecto_tipo_idx" ON "Proyecto"("tipo");

-- CreateIndex
CREATE INDEX "Proyecto_vendedor_estado_idx" ON "Proyecto"("vendedor", "estado");
