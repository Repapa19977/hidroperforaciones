-- AlterTable
ALTER TABLE "BitacoraEntry" ADD COLUMN     "camareo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "diaActivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "diamExtraidos" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "diamInstalados" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "otrosTrabajos" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "quimicoCanecas" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "quimicoProducto" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tubosExtraidos" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tubosInstalados" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InventarioReserva" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT,
    "proyectoCorrelativo" TEXT NOT NULL DEFAULT '',
    "producto" TEXT NOT NULL,
    "cantidadOriginal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "costoUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioVentaSugerido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'reservado',
    "fechaCreacion" TEXT NOT NULL DEFAULT '',
    "fechaLiberacion" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventarioReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cliente" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "usuario" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventarioReserva_proyectoId_idx" ON "InventarioReserva"("proyectoId");

-- CreateIndex
CREATE INDEX "InventarioReserva_producto_idx" ON "InventarioReserva"("producto");

-- CreateIndex
CREATE INDEX "InventarioReserva_estado_idx" ON "InventarioReserva"("estado");

-- CreateIndex
CREATE INDEX "MovimientoInventario_reservaId_idx" ON "MovimientoInventario"("reservaId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_tipo_idx" ON "MovimientoInventario"("tipo");

-- CreateIndex
CREATE INDEX "MovimientoInventario_createdAt_idx" ON "MovimientoInventario"("createdAt");
