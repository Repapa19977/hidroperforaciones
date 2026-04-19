#!/usr/bin/env bash
# ============================================================================
# test-integration.sh — Tests de integración Bot ↔ HidroCRM
# ----------------------------------------------------------------------------
# Corre los 3 tests críticos antes de activar la integración:
#   1. Webhook ping (VPS → bot): valida HMAC + endpoint receiver
#   2. MCP tools/list (bot → VPS): lista tools disponibles
#   3. MCP tools/call (bot → VPS): ejecuta una tool de ejemplo
#
# USO:
#   HIDRA_WEBHOOK_SECRET=... \
#   HIDROCRM_BASE_URL=https://hidrocrm.com/api/mcp \
#   HIDROCRM_TOKEN_COPILOTO=... \
#   BOT_WEBHOOK_URL=https://hidroperforaciones.com/webhook/hidrocrm \
#   ./test-integration.sh
#
# REQUIERE: node, curl, jq (opcional para output pretty)
# ============================================================================

set -e

# ── Config ────────────────────────────────────────────────────────────────
: "${HIDRA_WEBHOOK_SECRET:?HIDRA_WEBHOOK_SECRET env var requerida}"
: "${HIDROCRM_BASE_URL:=https://hidrocrm.com/api/mcp}"
: "${BOT_WEBHOOK_URL:=https://hidroperforaciones.com/webhook/hidrocrm}"
: "${HIDROCRM_TOKEN_COPILOTO:=}"

# Colors
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC}  $1"; }
fail() { echo -e "${RED}✗ FAIL${NC}  $1"; echo "    $2"; exit 1; }
skip() { echo -e "${YELLOW}⊘ SKIP${NC}  $1"; echo "    $2"; }

echo "════════════════════════════════════════════════════════════════════"
echo "  🧪 Tests de integración Bot ↔ HidroCRM"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# ── Test 1: Webhook ping (VPS → bot) ──────────────────────────────────────
echo "Test 1/3 — Webhook ping (VPS → bot)"
echo "  URL: $BOT_WEBHOOK_URL"

RESPONSE=$(node <<EOF 2>&1
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const SECRET = process.env.HIDRA_WEBHOOK_SECRET;
const URL_STR = process.env.BOT_WEBHOOK_URL;
const url = new URL(URL_STR);
const proto = url.protocol === 'https:' ? https : http;

const ts = Math.floor(Date.now() / 1000);
const body = JSON.stringify({
  id: 'evt_test_integration_' + ts,
  type: 'test.ping',
  created_at: new Date().toISOString(),
  version: 'v1',
  data: { source: 'test-integration.sh' },
});
const sig = crypto.createHmac('sha256', SECRET).update(ts + '.' + body).digest('hex');

const opts = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Hidra-Signature': 'sha256=' + sig,
    'X-Hidra-Timestamp': '' + ts,
    'X-Hidra-Event': 'test.ping',
  },
};

const req = proto.request(opts, (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    console.log('STATUS=' + res.statusCode);
    console.log('BODY=' + data);
  });
});
req.on('error', (e) => {
  console.log('ERROR=' + e.message);
});
req.write(body);
req.end();
EOF
)

STATUS=$(echo "$RESPONSE" | grep '^STATUS=' | cut -d'=' -f2)
BODY=$(echo "$RESPONSE" | grep '^BODY=' | cut -d'=' -f2-)

if [ "$STATUS" = "200" ]; then
  pass "Webhook ping OK (status 200)"
  echo "    body: $BODY"
elif [ "$STATUS" = "401" ]; then
  fail "Webhook ping HMAC mismatch" "El bot rechazó la firma. Verificá HIDRA_WEBHOOK_SECRET."
elif [ "$STATUS" = "503" ]; then
  fail "Webhook bot no tiene secret" "El bot no tiene HIDRA_WEBHOOK_SECRET seteado. Pedíselo a Rodri."
else
  fail "Webhook ping status $STATUS" "$BODY"
fi

echo ""

# ── Test 2: MCP tools/list ────────────────────────────────────────────────
echo "Test 2/3 — MCP tools/list (bot → VPS)"

if [ -z "$HIDROCRM_TOKEN_COPILOTO" ]; then
  skip "tools/list" "HIDROCRM_TOKEN_COPILOTO no seteado — correr generate-tokens.ts primero"
else
  RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "$HIDROCRM_BASE_URL" \
    -H "Authorization: Bearer $HIDROCRM_TOKEN_COPILOTO" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' \
    --max-time 30)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    TOOL_COUNT=$(echo "$BODY" | grep -oE '"name":"[^"]*"' | wc -l | tr -d ' ')
    if [ "$TOOL_COUNT" -gt 0 ]; then
      pass "tools/list OK ($TOOL_COUNT tools disponibles)"
      if command -v jq >/dev/null 2>&1; then
        echo "$BODY" | jq -r '.result.tools[]?.name' 2>/dev/null | head -10 | sed 's/^/    - /'
      fi
    else
      fail "tools/list retornó sin tools" "$BODY"
    fi
  elif [ "$HTTP_CODE" = "401" ]; then
    fail "tools/list 401" "Token inválido o expirado. Regenerá con generate-tokens.ts"
  else
    fail "tools/list HTTP $HTTP_CODE" "$BODY"
  fi
fi

echo ""

# ── Test 3: MCP tools/call (buscar_oportunidad con UUID dummy) ────────────
echo "Test 3/3 — MCP tools/call (bot → VPS)"

if [ -z "$HIDROCRM_TOKEN_COPILOTO" ]; then
  skip "tools/call" "HIDROCRM_TOKEN_COPILOTO no seteado"
else
  DUMMY_UUID="00000000-0000-0000-0000-000000000000"
  RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "$HIDROCRM_BASE_URL" \
    -H "Authorization: Bearer $HIDROCRM_TOKEN_COPILOTO" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":\"2\",\"method\":\"tools/call\",\"params\":{\"name\":\"buscar_oportunidad\",\"arguments\":{\"id\":\"$DUMMY_UUID\"}}}" \
    --max-time 30)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    # Success — la tool respondió (aunque sea con 404 en la lógica, eso es OK)
    if echo "$BODY" | grep -q '"error":\|"code":404'; then
      pass "tools/call flujo OK (404 esperado para UUID dummy)"
    elif echo "$BODY" | grep -q '"result":'; then
      pass "tools/call devolvió resultado (real o mock)"
    else
      fail "tools/call respuesta inesperada" "$BODY"
    fi
  else
    fail "tools/call HTTP $HTTP_CODE" "$BODY"
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  ✅ Tests completados"
echo "════════════════════════════════════════════════════════════════════"
