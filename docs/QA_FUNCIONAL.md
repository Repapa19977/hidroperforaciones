# QA Funcional HidroCRM

Objetivo: reducir errores antes de cambios grandes o deploys. Esta lista se usa despues de `npm run qa:local`.

## Compuerta Automatica

```bash
npm run qa:local
```

Debe pasar completo antes de deployar:

- higiene del repo,
- lint,
- Prisma validate/generate,
- TypeScript,
- build de produccion,
- smoke de rutas publicas y privadas sin sesion.

## Checklist Manual Critico

### Login y Seguridad

- Login admin correcto.
- Login invalido no entra.
- Cerrar sesion funciona.
- Usuario sin permisos no ve configuracion/usuarios.
- Portal cliente no entra sin password.

### Dashboard

- KPIs cargan.
- Filtros no rompen totales.
- Cotizaciones confirmadas/enviadas/canceladas coinciden con listado.
- Conversion tiene sentido con el historial.

### Contactos

- Crear contacto nuevo.
- Intentar crear contacto duplicado por nombre/persona/empresa y confirmar bloqueo.
- Editar contacto sin duplicarlo.
- Abrir expediente de contacto.

### Cotizador

- Crear cotizacion de perforacion.
- Crear cotizacion de limpieza.
- Verificar costos base y margen por rubro.
- Verificar tuberia: costo propio, porcentaje y precio cliente.
- Generar PDF y revisar fecha dia/mes/ano, correo y totales.

### Proyectos y Bitacora

- Confirmar cotizacion y abrir proyecto.
- Crear entrada diaria.
- Dia inactivo no suma perforacion.
- Dia adverso se marca segun regla esperada.
- KPIs muestran pies, bentonita, pipas y avance de dias.
- Generar PDF de bitacora.

### Gastos, Balance y Cancelacion

- Registrar gasto real.
- Confirmar que balance compara gastos reales contra pagos/cliente.
- Ver liquidacion/cancelacion separada del balance.
- Cancelar proyecto y confirmar que queda guardado en el proyecto.

### Pagos y Cuentas

- Registrar pago de proyecto.
- Ver cuentas por cobrar.
- Ver cuentas por pagar.
- Exportar si aplica.

### Inventario

- Ver inventario.
- Registrar movimiento.
- Confirmar alertas de consumo de bentonita.

### Responsive

- iPhone/Android Chrome: abrir menu.
- Menu permite llegar a todos los modulos.
- Cerrar sesion visible en movil.
- Modo claro/oscuro visible en movil.
- No hay texto cortado en cards/botones principales.

## Regla De Cierre

Una version se considera lista cuando:

1. `npm run qa:local` pasa.
2. Este checklist manual no encuentra bloqueadores.
3. Hay backup local.
4. Hay rollback claro para VPS.
