ALTER TABLE "Contacto" ADD COLUMN "tipoPersona" TEXT NOT NULL DEFAULT 'individual';

UPDATE "Contacto"
SET "tipoPersona" = 'empresa'
WHERE COALESCE("empresa", '') <> '';

CREATE INDEX "Contacto_tipoPersona_idx" ON "Contacto"("tipoPersona");
