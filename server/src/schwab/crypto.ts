import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { HttpError } from '../middleware/error.js';

function key() {
  if (!env.SCHWAB_TOKEN_ENCRYPTION_KEY) throw new HttpError(503, 'Falta SCHWAB_TOKEN_ENCRYPTION_KEY en el servidor.');
  return createHash('sha256').update(env.SCHWAB_TOKEN_ENCRYPTION_KEY).digest();
}

export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const contenido = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), contenido].map((x) => x.toString('base64url')).join('.');
}

export function descifrar(valor: string) {
  try {
    const [ivRaw, tagRaw, contenidoRaw] = valor.split('.');
    if (!ivRaw || !tagRaw || !contenidoRaw) throw new Error('Formato inválido');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(contenidoRaw, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new HttpError(500, 'No se pudo descifrar la sesión de Schwab. Reconecta la cuenta.');
  }
}
