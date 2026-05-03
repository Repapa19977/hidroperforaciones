# HidroCRM

Sistema interno para Hidroperforaciones, S.A. Guatemala.

HidroCRM centraliza contactos, cotizaciones, PDFs, proyectos, bitacora, gastos, inventario, cuentas por pagar, cuentas por cobrar, reportes, usuarios y portal de cliente.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript strict
- Prisma 7
- PostgreSQL
- Tailwind CSS
- jsPDF / jspdf-autotable
- JWT en cookie httpOnly
- Service tokens para integraciones
- VPS con Nginx, PM2 y SSL

## Comandos Principales

```bash
npm run dev
npm run check:hygiene
npm run lint
npm run build
npm run predeploy
npm run verify
npm run qa:local
```

Antes de cualquier despliegue se debe ejecutar:

```bash
npm run predeploy
```

Ese comando valida higiene del repo, Prisma, genera cliente Prisma, ejecuta TypeScript y hace build de produccion.

Para smoke test local, levantar el servidor y correr:

```bash
npm run smoke:local
```

Guia operativa: `docs/OPERACION_ADMIN.md`.
Checklist funcional: `docs/QA_FUNCIONAL.md`.

## Variables De Entorno

Usar `.env.example` como plantilla.

Variables criticas:

- `DATABASE_URL`
- `JWT_SECRET`
- `SUPERADMIN_USERNAME`
- `SUPERADMIN_PASSWORD_HASH`
- `SUPERADMIN_VENDEDOR`
- `TOTP_ENCRYPTION_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`

No subir `.env`, `.env.local` ni backups con secretos a repositorios publicos.

## Seguridad Operativa

- Las rutas principales se protegen por `proxy.ts`.
- Los endpoints sensibles deben validar auth tambien en handler usando `requireAuth` o `requireSuperAdmin`.
- Los modulos de proyectos, gastos, inventario, cuentas, usuarios y tokens son solo para `superadmin`.
- El portal cliente usa rol `cliente_final` y rutas `/cliente/*`.
- Los cron jobs deben validar `X-Cron-Secret`.
- Los service tokens deben tener scopes especificos y revocarse cuando ya no se usen.

## Reglas Para No Romper Formulas

- No cambiar `lib/calculator.ts` sin prueba manual de cotizacion.
- No cambiar `lib/control-gastos.ts` sin validar bitacora/gastos.
- No cambiar `lib/pdf-cotizacion.ts` sin revisar visualmente el PDF.
- No cambiar `prisma/schema.prisma` sin migracion y backup.
- Siempre crear backup antes de cambios de produccion.

## Backups

Backups locales recomendados:

```text
C:\Users\Rodrigo\backups-hidrocrm\
```

Para cambios grandes:

1. Backup de codigo local.
2. Backup de codigo en VPS.
3. Backup/dump de base de datos.
4. `npm run predeploy`.
5. Despliegue.
6. Healthcheck.

## Deploy

El deploy actual se maneja por pipeline local a VPS:

1. Build/predeploy local.
2. Empaquetar codigo.
3. Subir al VPS.
4. Instalar/generar/build en servidor.
5. `pm2 reload`.
6. Verificar healthcheck.

## Legacy

El cotizador antiguo Rails debe mantenerse como sub-app aislada si se integra:

- proceso separado,
- base de datos separada,
- ruta o subdominio separado,
- sin mezclar tablas con HidroCRM nuevo.
