/**
 * generate-tokens.ts — Emite los 2 service tokens JWT para el bot Hidroperforaciones.
 *
 * UBICACION EN EL VPS:  scripts/admin/generate-tokens.ts  (o donde prefieras en tu Next.js project)
 * CORRER CON:           pnpm tsx scripts/admin/generate-tokens.ts
 *
 * Requiere:
 *   - Variable de entorno `JWT_SECRET` (si no existe, lo genera al vuelo y lo imprime)
 *   - Dep `jose` (si no la tenés: `pnpm add jose`)
 *
 * OUTPUT: imprime los 2 tokens en stdout + ejemplo de .env.
 * El secret NUNCA se imprime junto a los tokens — vos lo guardás aparte en el .env del VPS.
 *
 * Recomendación: este script lo corrés UNA vez al desplegar, guardás los 2 tokens en un
 * password manager, los rotás a los 90 días (o cuando sospeches filtración).
 */

import { SignJWT } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';

const EXP = process.env.JWT_EXP || '90d';
const AUDIENCE = 'hidrocrm-mcp';
const ISSUER = 'hidrocrm';

async function main() {
  // 1. Verificar/generar secret
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    console.log('\n⚠️  JWT_SECRET no estaba seteado. GENERADO uno nuevo:\n');
    console.log(`   JWT_SECRET=${secret}\n`);
    console.log('   ⇒ Guardá esto en tu .env del VPS y NO en git.\n');
  } else {
    console.log('✓ JWT_SECRET encontrado en env (usando el existente)\n');
  }

  const secretBuf = new TextEncoder().encode(secret);

  // 2. Token Copiloto (asesores + 5 agents internos)
  const jtiCopiloto = randomUUID();
  const tokenCopiloto = await new SignJWT({
    scopes: [
      'bot:read',
      'bot:calc',
      'bot:write',
      'bot:analytics',
      'bot:finance',
      'bot:field',
      'bot:geology',
    ],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('hidra-copiloto')
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXP)
    .setJti(jtiCopiloto)
    .sign(secretBuf);

  // 3. Token Cliente (portal cliente — scope mínimo)
  const jtiCliente = randomUUID();
  const tokenCliente = await new SignJWT({
    scopes: ['cliente:read', 'cliente:solicitud'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('hidra-cliente')
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXP)
    .setJti(jtiCliente)
    .sign(secretBuf);

  // 4. Imprimir
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  🎫 TOKENS GENERADOS — pasale estos 2 a Rodri (canal seguro)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  console.log(`HIDROCRM_TOKEN_COPILOTO=${tokenCopiloto}\n`);
  console.log(`HIDROCRM_TOKEN_CLIENTE=${tokenCliente}\n`);

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  📋 METADATOS (guardá estos JTIs para poder revocar individualmente)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  console.log(`JTI Copiloto:  ${jtiCopiloto}`);
  console.log(`JTI Cliente:   ${jtiCliente}`);
  console.log(`Expiración:    ${EXP} (rotar ~7 días antes)\n`);

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  🔐 .env del VPS (no commitear)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  console.log(`JWT_SECRET=${secret}`);
  console.log(`# HIDRA_WEBHOOK_SECRET=<pedíselo a Rodri, distinto al JWT_SECRET>\n`);

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  💡 Para REVOCAR un token antes del exp:');
  console.log('════════════════════════════════════════════════════════════════════\n');

  console.log('  En tu Redis:');
  console.log(`    SADD revoked_jtis ${jtiCopiloto}\n`);
  console.log('  Y en tu MCP route handler, antes de procesar:');
  console.log('    if (await redis.sismember("revoked_jtis", payload.jti))');
  console.log('        return jsonRpcError(id, 401, "token revoked");\n');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
