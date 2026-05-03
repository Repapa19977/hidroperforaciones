import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TOTP_STEP_SECONDS = 30
const TOTP_DIGITS = 6
const SECRET_PREFIX = 'totp:v1'

function encryptionKey(): Buffer {
  const material = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'hidrocrm-dev-key'
  return createHash('sha256').update(material).digest()
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [SECRET_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptTotpSecret(value: string): string {
  if (!value.startsWith(`${SECRET_PREFIX}:`)) return value
  const [, , ivB64, tagB64, encryptedB64] = value.split(':')
  if (!ivB64 || !tagB64 || !encryptedB64) throw new Error('Invalid TOTP secret')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function totpUri(params: { issuer?: string; account: string; secret: string }): string {
  const issuer = params.issuer || 'HidroCRM'
  const label = `${issuer}:${params.account}`
  const q = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${q.toString()}`
}

export function verifyTotp(code: string | undefined | null, encryptedOrPlainSecret: string | undefined | null): boolean {
  const normalized = normalizeTotpCode(code)
  if (!normalized || !encryptedOrPlainSecret) return false

  let secret: string
  try {
    secret = decryptTotpSecret(encryptedOrPlainSecret)
  } catch {
    return false
  }

  const nowCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS)
  for (let offset = -1; offset <= 1; offset++) {
    if (safeEqualCode(normalized, generateTotpCode(secret, nowCounter + offset))) return true
  }
  return false
}

export function normalizeTotpCode(code: string | undefined | null): string {
  return (code ?? '').replace(/\s+/g, '').trim()
}

function generateTotpCode(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0')
}

function safeEqualCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function base32Encode(input: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of input) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) throw new Error('Invalid base32 secret')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}
