-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "correlativo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "proyecto" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TEXT NOT NULL,
    "vendedor" TEXT NOT NULL,
    "datos" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidad" (
    "id" TEXT NOT NULL,
    "correlativo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "monto" DOUBLE PRECISION NOT NULL,
    "etapa" TEXT NOT NULL,
    "vendedor" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '',
    "fecha" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "profundidad" INTEGER,
    "proyecto" TEXT NOT NULL DEFAULT '',
    "diasSinActividad" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oportunidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'admin',
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contacto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'cliente',
    "pais" TEXT NOT NULL DEFAULT 'Guatemala',
    "notas" TEXT NOT NULL DEFAULT '',
    "vendedor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "datos" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "correlativo" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "empresa" TEXT NOT NULL DEFAULT '',
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "vendedor" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "fechaInicio" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BitacoraEntry" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "turno" TEXT NOT NULL DEFAULT 'dia',
    "estado" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL,
    "perforacionDia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ampliacion1Dia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ampliacion2Dia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rehabilitacionDia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perforacionTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ampliacion1Total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ampliacion2Total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rehabilitacionTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasPerforacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bentonitaSacos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pipas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasLimpieza" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasAforo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diaAdverso" BOOLEAN NOT NULL DEFAULT false,
    "notaInterna" TEXT NOT NULL DEFAULT '',
    "notaCliente" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BitacoraEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_correlativo_key" ON "Cotizacion"("correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "Oportunidad_correlativo_key" ON "Oportunidad"("correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_correlativo_key" ON "Proyecto"("correlativo");

-- CreateIndex
CREATE INDEX "BitacoraEntry_proyectoId_idx" ON "BitacoraEntry"("proyectoId");

-- CreateIndex
CREATE INDEX "BitacoraEntry_proyectoId_fecha_idx" ON "BitacoraEntry"("proyectoId", "fecha");

-- AddForeignKey
ALTER TABLE "BitacoraEntry" ADD CONSTRAINT "BitacoraEntry_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
