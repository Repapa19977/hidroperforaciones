#!/bin/bash
# Smoke test del MCP. Requiere token real por variable de entorno.
# Uso: HIDROCRM_TOKEN_COPILOTO=<TOKEN> ./smoke-mcp.sh [BASE_URL]
set -e

BASE="${1:-https://<DOMINIO_PUBLICO>/api/mcp}"
TOKEN_COPILOTO="${HIDROCRM_TOKEN_COPILOTO:-}"

if [ -z "$TOKEN_COPILOTO" ]; then
  echo "Falta HIDROCRM_TOKEN_COPILOTO. No hay token default por seguridad."
  exit 2
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
    echo "  OK $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL $name"
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
call "tools/list"                 '"mi_proyecto"' '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
call "ping"                       '"pong":true'   '{"jsonrpc":"2.0","id":"2","method":"ping"}'
call "preview_cotizacion"         '"precio_estimado"' '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"preview_cotizacion","arguments":{"tipo":"pozo_nuevo","municipio":"Jutiapa","uso":"consumo","consumidores":150}}}'
call "historial_cliente"          '"nombre"'      '{"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"historial_cliente","arguments":{"nombre":"Cliente Demo"}}}'
call "metricas_periodo"           '"resumen"'     '{"jsonrpc":"2.0","id":"5","method":"tools/call","params":{"name":"metricas_periodo","arguments":{"desde":"2026-01-01","hasta":"2026-12-31"}}}'

echo ""
echo "=== Resultado: $PASS OK / $FAIL FAIL ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
