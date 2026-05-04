# MCP Operaciones Bot

Contrato para el bot Telegram/OpenClaw operativo. Este modo debe usar un token
limitado `hidra-operaciones` con scope unico `bot:ops`.

## Variables del bot

```env
HIDROCRM_MCP_URL=https://hidrocrm.com/api/mcp
HIDROCRM_MCP_TOKEN=<JWT_GENERADO_EN_CONFIGURACION>
```

El token correcto empieza con `eyJ`. No usar tokens viejos `hcrm_`.

## Permisos

Con `hidra-operaciones` el bot solo puede:

- Leer proyectos activos.
- Consultar alertas de bitacora pendiente.
- Registrar entradas de bitacora.
- Registrar compras/gastos en Control de Gastos.

No puede borrar, editar cotizaciones, registrar pagos, cambiar estados, tocar
usuarios, inventario ni configuracion.

## Tools disponibles

### listar_proyectos_activos

Busca proyectos activos para resolver el `proyecto_id` correcto.

```json
{
  "buscar": "cliente o correlativo opcional",
  "limit": 25
}
```

### alertas_bitacora_pendiente

Devuelve proyectos activos sin bitacora registrada en la fecha indicada.

```json
{
  "fecha": "2026-05-04",
  "turnos_esperados": ["dia"]
}
```

Si `fecha` no se envia, HidroCRM usa la fecha de Guatemala.

### registrar_entrada_bitacora

Crea una entrada diaria de bitacora. Requiere `Idempotency-Key` cuando el bot
pueda reintentar mensajes.

```json
{
  "proyecto_id": "PROY-001 o cuid",
  "fecha": "2026-05-04",
  "turno": "dia",
  "tipo": "perforacion",
  "perforacion_dia": 20,
  "ampliacion1_dia": 0,
  "ampliacion2_dia": 0,
  "horas_perforacion": 8,
  "horas_limpieza": 0,
  "horas_aforo": 0,
  "bentonita_sacos": 5,
  "pipas": 2,
  "dia_activo": true,
  "formacion_geologica": "arcilla",
  "circulacion_pct": 80,
  "nota_cliente": "",
  "nota_interna": "registrado desde Telegram"
}
```

### registrar_gasto_control

Crea una compra/gasto en Control de Gastos de un proyecto activo. No registra
pagos recibidos y no edita gastos existentes.

```json
{
  "proyecto_id": "PROY-001 o cuid",
  "producto": "Diesel",
  "descripcion": "Compra para maquinaria",
  "rubro": "combustible",
  "cantidad": 10,
  "unidad": "Galon",
  "costo_unitario": 35,
  "valor_unitario": 0,
  "fecha": "2026-05-04",
  "dias_credito": 0,
  "pagado": true,
  "proveedor": "Proveedor",
  "nota": "registrado desde Telegram"
}
```

Alternativa: enviar `monto_total` en vez de `costo_unitario`; HidroCRM calcula
el costo unitario usando `monto_total / cantidad`.

## Flujo recomendado del bot

1. Si el usuario pide registrar algo, pedir datos faltantes antes de llamar MCP.
2. Resolver proyecto con `listar_proyectos_activos`.
3. Confirmar al usuario el resumen: proyecto, fecha, monto/avance y notas.
4. Llamar la tool de escritura con `Idempotency-Key`.
5. Responder con el ID creado y resumen en quetzales.

El bot nunca debe inventar datos operativos. Si falta proyecto, fecha, producto,
monto o avance, debe preguntar antes de registrar.
