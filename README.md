# HidroCRM

Sistema interno para Hidroperforaciones, S.A. Guatemala.

HidroCRM centraliza contactos, cotizaciones, PDFs, proyectos, bitacora, gastos, inventario, cuentas por pagar, cuentas por cobrar, reportes, usuarios y portal de cliente.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript strict
- Prisma 7
- PostgreSQL / Neon
- Tailwind CSS
- jsPDF / jspdf-autotable
- JWT en cookie httpOnly
- Service tokens para integraciones
- VPS con Nginx, PM2 y SSL

## Comandos

```bash
npm run dev
npm run check:hygiene
npm run lint
npm run build
npm run predeploy
npm run verify
npm run qa:local
```

Antes de cualquier despliegue ejecutar:

```bash
npm run predeploy
```

Ese comando valida higiene del repo, Prisma, TypeScript y build de produccion.

## Variables De Entorno

Usar `.env.example` como plantilla y crear `.env.local` en desarrollo o `.env` en produccion.

Nunca subir estos archivos:

- `.env`
- `.env.local`
- backups de `.env`
- dumps de base de datos
- archivos `dev.db`
- tokens generados
- llaves SSH o certificados privados

Variables criticas:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPERADMIN_USERNAME`
- `SUPERADMIN_PASSWORD_HASH`
- `SUPERADMIN_VENDEDOR`
- `TOTP_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`

Los valores reales viven solo en el entorno local, el VPS o el proveedor de secretos. El README y las guias deben usar placeholders como `<VPS_HOST>`, `<DATABASE_URL>` y `<SECRET_GENERADO>`.

## Deploy Seguro

El deploy recomendado es desde Git:

1. Commit local probado.
2. Push a GitHub.
3. Pull en el VPS desde la rama `main`.
4. `npm ci`.
5. `npx prisma generate`.
6. `npx prisma migrate deploy`.
7. `npm run build`.
8. `pm2 reload hidrocrm`.

No documentar IPs reales, passwords, tokens, URLs privadas de base de datos ni comandos SSH con credenciales reales.

## Backups

Antes de cambios grandes:

1. Backup liviano del codigo, excluyendo `node_modules`, `.next`, `.git`, caches, logs y `dev.db`.
2. Backup o snapshot de base de datos.
3. `npm run predeploy`.
4. Deploy.
5. Healthcheck.

Evitar backups completos de `/opt/hidrocrm` que incluyan `node_modules`; crecen rapido y consumen espacio del VPS.

## Seguridad Operativa

- Las rutas principales se protegen por `proxy.ts`.
- Los endpoints sensibles deben validar auth tambien en handler usando `requireAuth` o `requireSuperAdmin`.
- Los modulos de proyectos, gastos, inventario, cuentas, usuarios y tokens son solo para `superadmin`.
- El portal cliente usa rol `cliente_final` y rutas `/cliente/*`.
- Los cron jobs deben validar `X-Cron-Secret`.
- Los service tokens deben tener scopes especificos y revocarse cuando ya no se usen.

## Reglas Para No Romper Flujos

- No cambiar `lib/calculator.ts` sin prueba manual de cotizacion.
- No cambiar `lib/control-gastos.ts` sin validar bitacora/gastos.
- No cambiar `lib/pdf-cotizacion.ts` sin revisar visualmente el PDF.
- No cambiar `prisma/schema.prisma` sin migracion y backup.
- No subir cambios a produccion sin validar `npm run predeploy`.

## Documentacion

- Guia operativa: `docs/OPERACION_ADMIN.md`
- Checklist funcional: `docs/QA_FUNCIONAL.md`
- Deploy VPS: `deploy/README.md`

## Legacy

El cotizador antiguo Rails debe mantenerse como sub-app aislada si se integra:

- proceso separado,
- base de datos separada,
- ruta o subdominio separado,
- sin mezclar tablas con HidroCRM nuevo.
