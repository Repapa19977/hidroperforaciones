# Scripts

Esta carpeta contiene utilidades operativas. Los scripts de uso frecuente o
referenciados por `package.json` se quedan en la raiz de `scripts/`.

- `admin/`: tareas administrativas o sensibles, como tokens, usuarios y resets.
- `checks/`: consultas de diagnostico y conteos puntuales.
- `fixes/`: reparaciones puntuales de datos o encoding.
- `tests/`: pruebas E2E/manuales fuera del bundle de Next.
- `tools/`: generadores, exports y respaldos manuales.

Regla: si un script se vuelve parte del flujo normal de deploy, dejarlo en la
raiz de `scripts/` o actualizar `package.json` para que el comando sea explicito.
