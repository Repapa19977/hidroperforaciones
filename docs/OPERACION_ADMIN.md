# Operacion Admin HidroCRM

Guia corta para operar el sistema sin perder control del codigo, deploys y respaldos.

## Antes de Cambios Grandes

1. Crear backup local del codigo.
2. Validar que no haya secretos dentro del paquete a desplegar.
3. Correr `npm run verify`.
4. Probar manualmente el modulo afectado.
5. Solo despues preparar deploy.

## Validacion Local

```bash
npm run check:hygiene
npm run lint
npm run predeploy
```

`npm run verify` ejecuta lint y predeploy. El predeploy incluye:

- higiene del repo,
- validacion Prisma,
- generacion Prisma Client,
- TypeScript sin emitir,
- build de produccion.

## Smoke Local

Con el servidor levantado:

```bash
npm run build
npm run start
npm run smoke:local
```

Tambien se puede apuntar a otra URL:

```bash
HIDROCRM_BASE_URL=https://dominio.com npm run smoke:local
```

En Windows PowerShell:

```powershell
$env:HIDROCRM_BASE_URL="http://127.0.0.1:3000"
npm run smoke:local
```

## Deploy Seguro

El deploy correcto debe tener estas fases:

1. Build/predeploy local.
2. Paquete limpio sin `.env`, `.git`, `.next`, `node_modules` ni `dev.db`.
3. Build en carpeta nueva del VPS.
4. Migraciones Prisma.
5. Cambio de release activo.
6. `pm2 reload hidrocrm --update-env`.
7. Smoke test.
8. Conservar release anterior para rollback.

## Legacy Encapsulado

El cotizador viejo debe correr como sub-app separada.

- No comparte base de datos con HidroCRM.
- No se importan modelos, Prisma ni codigo interno del legacy dentro del CRM nuevo.
- HidroCRM solo monta `/legacy` por proxy usando `LEGACY_APP_URL`.
- En local, levantar primero el legacy en otro puerto, por ejemplo `3001`.
- Luego configurar `LEGACY_APP_URL=http://127.0.0.1:3001` y reiniciar el CRM nuevo.

Si `LEGACY_APP_URL` no existe, `/legacy` muestra una pantalla de configuracion en vez de 404.

## Rollback

Si el release nuevo no responde:

1. Dejar de tocar la base de datos.
2. Restaurar carpeta anterior de `/opt/hidrocrm-backups`.
3. Ejecutar `pm2 reload hidrocrm --update-env`.
4. Validar `/login` y rutas privadas.

## Backups

Mantener separados:

- backups locales de codigo,
- releases anteriores del VPS,
- backups/snapshots del proveedor,
- dumps de base de datos cuando aplique.

No subir backups locales dentro del app ni al VPS como parte del deploy.

## Pruebas Manuales Minimas

Antes de marcar una version como estable:

- login admin,
- dashboard,
- nueva cotizacion,
- PDF cotizacion,
- crear contacto,
- abrir proyecto,
- nueva entrada de bitacora,
- PDF bitacora,
- gastos/control de proyecto,
- pagos/cuentas,
- vista movil con menu abierto/cerrado.
