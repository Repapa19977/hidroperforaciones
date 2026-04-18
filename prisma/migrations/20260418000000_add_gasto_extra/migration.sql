-- CreateTable
CREATE TABLE "GastoExtra" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "rubro" TEXT NOT NULL DEFAULT 'otro',
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT NOT NULL DEFAULT 'Unidad',
    "montoUnit" DOUBLE PRECISION NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "nota" TEXT NOT NULL DEFAULT '',
    "creadoPor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GastoExtra_proyectoId_idx" ON "GastoExtra"("proyectoId");

-- CreateIndex
CREATE INDEX "GastoExtra_fecha_idx" ON "GastoExtra"("fecha");
