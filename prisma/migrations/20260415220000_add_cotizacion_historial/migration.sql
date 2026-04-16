-- CreateTable
CREATE TABLE "CotizacionHistorial" (
    "id" TEXT NOT NULL,
    "correlativo" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAntes" TEXT NOT NULL DEFAULT '',
    "valorDespues" TEXT NOT NULL DEFAULT '',
    "usuario" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CotizacionHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CotizacionHistorial_correlativo_idx" ON "CotizacionHistorial"("correlativo");

-- CreateIndex
CREATE INDEX "CotizacionHistorial_correlativo_createdAt_idx" ON "CotizacionHistorial"("correlativo", "createdAt");
