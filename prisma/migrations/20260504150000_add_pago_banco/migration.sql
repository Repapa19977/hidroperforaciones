-- Campo opcional para identificar el banco receptor de pagos no efectivos.
-- Default vacio para no afectar pagos existentes.
ALTER TABLE "Pago" ADD COLUMN "banco" TEXT NOT NULL DEFAULT '';
