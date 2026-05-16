ALTER TABLE "Usuario" ADD COLUMN "cargo" TEXT NOT NULL DEFAULT 'Asesor de Ventas';

UPDATE "Usuario"
SET "cargo" = CASE
  WHEN translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%rene%'
    OR translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%dominguez%' THEN 'Ventas de Gerencia'
  WHEN translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%mario%'
    OR translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%ramirez%' THEN 'Jefe de Operaciones'
  WHEN translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%gilda%'
    OR translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%garcia%'
    OR translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%anabella%'
    OR translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%annabella%'
    OR translate(LOWER("nombre"), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00F1', 'aeiouun') LIKE '%castro%' THEN 'Asesora de Ventas'
  WHEN "rol" = 'superadmin' THEN 'Ventas de Gerencia'
  ELSE 'Asesor de Ventas'
END
WHERE "rol" IN ('admin', 'superadmin');
