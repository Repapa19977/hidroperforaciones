-- CreateTable
CREATE TABLE "CuentaPorPagar" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "nit" TEXT NOT NULL DEFAULT '',
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "aplicarIva" BOOLEAN NOT NULL DEFAULT true,
    "aplicarIsr" BOOLEAN NOT NULL DEFAULT false,
    "ivaMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isrMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "fechaEmision" TEXT NOT NULL,
    "diasCredito" INTEGER NOT NULL DEFAULT 0,
    "fechaVencimiento" TEXT NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TEXT,
    "metodoPago" TEXT NOT NULL DEFAULT '',
    "referenciaPago" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "creadoPor" TEXT NOT NULL DEFAULT '',
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,
    "motivoBorrado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaPorPagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaPorCobrar" (
    "id" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "nit" TEXT NOT NULL DEFAULT '',
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "aplicarIva" BOOLEAN NOT NULL DEFAULT true,
    "aplicarIsr" BOOLEAN NOT NULL DEFAULT false,
    "ivaMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isrMonto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "fechaEmision" TEXT NOT NULL,
    "diasCredito" INTEGER NOT NULL DEFAULT 0,
    "fechaVencimiento" TEXT NOT NULL,
    "cobrado" BOOLEAN NOT NULL DEFAULT false,
    "fechaCobro" TEXT,
    "metodoCobro" TEXT NOT NULL DEFAULT '',
    "referenciaCobro" TEXT NOT NULL DEFAULT '',
    "nota" TEXT NOT NULL DEFAULT '',
    "creadoPor" TEXT NOT NULL DEFAULT '',
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,
    "motivoBorrado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaPorCobrar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuentaPorPagar_proveedor_idx" ON "CuentaPorPagar"("proveedor");

-- CreateIndex
CREATE INDEX "CuentaPorPagar_pagado_idx" ON "CuentaPorPagar"("pagado");

-- CreateIndex
CREATE INDEX "CuentaPorPagar_fechaVencimiento_idx" ON "CuentaPorPagar"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "CuentaPorPagar_eliminadoEn_idx" ON "CuentaPorPagar"("eliminadoEn");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_cliente_idx" ON "CuentaPorCobrar"("cliente");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_cobrado_idx" ON "CuentaPorCobrar"("cobrado");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_fechaVencimiento_idx" ON "CuentaPorCobrar"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "CuentaPorCobrar_eliminadoEn_idx" ON "CuentaPorCobrar"("eliminadoEn");
