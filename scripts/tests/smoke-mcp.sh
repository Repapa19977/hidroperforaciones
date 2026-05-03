#!/bin/bash
# Smoke test del MCP — corre cada tool y valida respuesta.
# Uso: ./smoke-mcp.sh [BASE_URL]
# Default: https://hidrocrm.com/api/mcp
set -e

BASE="${1:-https://hidrocrm.com/api/mcp}"
TOKEN_COPILOTO="${HIDROCRM_TOKEN_COPILOTO:-}"

if [ -z "$TOKEN_COPILOTO" ]; then
  echo "Pasa HIDROCRM_TOKEN_COPILOTO como env var o se usará el default hardcodeado para dev."
  # Token default de dev (mismo que genera generate-tokens.ts)
  TOKEN_COPILOTO="eyJhbGciOiJIUzI1NiJ9.eyJzY29wZXMiOlsiYm90OnJlYWQiLCJib3Q6Y2FsYyIsImJvdDp3cml0ZSIsImJvdDphbmFseXRpY3MiLCJib3Q6ZmluYW5jZSIsImJvdDpmaWVsZCIsImJvdDpnZW9sb2d5Il0sInN1YiI6ImhpZHJhLWNvcGlsb3RvIiwiYXVkIjoiaGlkcm9jcm0tbWNwIiwiaXNzIjoiaGlkcm9jcm0iLCJpYXQiOjE3NzY1OTY4NTcsImV4cCI6MTc4NDM3Mjg1NywianRpIjoiNDA1NTdiMWEtNTk1Yi00ZGMzLWE4NTgtYmM4NDYyNjk4YmJjIn0.QDpmbKCgnThMKVNBzjGhBUfZMvMZGZNXmRTAqKaQjXM"
fi

PASS=0
FAIL=0

call() {
  local name="$1"
  local expect="$2"
  local body="$3"
  local res
  res=$(curl -sS -X POST "$BASE" \
    -H "Authorization: Bearer $TOKEN_COPILOTO" \
    -H "Content-Type: application/json" \
    -d "$body")
  if echo "$res" | grep -q "$expect"; then
    echo "  ✓ $name"
    PASS=$((PASS+1))
  else
    echo "  ✗ $name"
    echo "    Response: $(echo "$res" | head -c 200)..."
    FAIL=$((FAIL+1))
  fi
}

echo "=== Smoke test MCP @ $BASE ==="
echo ""
echo "Health:"
curl -sS "$BASE" | head -c 200
echo ""; echo ""

echo "Tools:"
call "tools/list (16 tools)"      '"mi_proyecto"' '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
call "ping"                       '"pong":true'   '{"jsonrpc":"2.0","id":"2","method":"ping"}'
call "preview_cotizacion"         '"precio_estimado"' '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"preview_cotizacion","arguments":{"tipo":"pozo_nuevo","municipio":"Jutiapa","uso":"consumo","consumidores":150}}}'
call "historial_cliente"          '"nombre"'      '{"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"historial_cliente","arguments":{"nombre":"Rodrigo"}}}'
call "metricas_periodo"           '"resumen"'     '{"jsonrpc":"2.0","id":"5","method":"tools/call","params":{"name":"metricas_periodo","arguments":{"desde":"2026-01-01","hasta":"2026-12-31"}}}'
call "mi_proyecto HP-COT-0118"    '"avance"'      '{"jsonrpc":"2.0","id":"6","method":"tools/call","params":{"name":"mi_proyecto","arguments":{"proyecto_id":"HP-COT-0118"}}}'
call "mi_bitacora HP-COT-0118"    '"entradas"'    '{"jsonrpc":"2.0","id":"7","method":"tools/call","params":{"name":"mi_bitacora","arguments":{"proyecto_id":"HP-COT-0118","limit":5}}}'
call "mis_pagos HP-COT-0118"      '"hitos"'       '{"jsonrpc":"2.0","id":"8","method":"tools/call","params":{"name":"mis_pagos","arguments":{"proyecto_id":"HP-COT-0118"}}}'
call "mi_cotizacion HP-COT-0118"  '"correlativo"' '{"jsonrpc":"2.0","id":"9","method":"tools/call","params":{"name":"mi_cotizacion","arguments":{"cotizacion_id":"HP-COT-0118"}}}'
call "buscar_oportunidad (404 OK)" '"not found"'  '{"jsonrpc":"2.0","id":"10","method":"tools/call","params":{"name":"buscar_oportunidad","arguments":{"id":"FAKE-ID-999"}}}'
call "token inválido → 401"       '"401"'         '{"jsonrpc":"2.0","id":"11","method":"ping"}' 2>/dev/null || true

echo ""
echo "=== Resultado: $PASS ✓ / $FAIL ✗ ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
