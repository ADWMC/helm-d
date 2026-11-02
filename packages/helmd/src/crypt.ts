// Profile-catalog sealing: built-in key (operator ruling 2026-10-20 — no
// anti-bypass, so the crypto target is npm/静态扫描, not extraction). The key
// lives here by design; anyone with the package can decrypt — that is accepted.
import crypto from 'node:crypto'

const SECRET = 'helm-d/profiles/v1::6f4d2a0c-9e17-4b8e-a3f2-c81d54e7b930'
const SALT = 'helm-d/profiles/v1::salt-v1'

let cached: Buffer | undefined

function key(): Buffer {
  if (cached === undefined) cached = crypto.scryptSync(SECRET, SALT, 32)
  return cached
}

/** Seal plaintext → "iv.tag.ciphertext" (base64url parts, dot-joined). */
export function seal(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const b64u = (b: Buffer): string => b.toString('base64url')
  return [b64u(iv), b64u(tag), b64u(enc)].join('.')
}

/** Unseal a value produced by {@link seal}. Throws on tamper. */
export function unseal(sealed: string): string {
  const [ivB64, tagB64, dataB64] = sealed.split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8')
}
