import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY || '';
  if (keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY invalida: defina uma chave hex de 64 caracteres (32 bytes) no .env. ' +
        'Gere uma com: openssl rand -hex 32'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptJSON(plainObj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(plainObj ?? {});
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptJSON(payload) {
  const key = getKey();
  const [ivB64, tagB64, ctB64] = String(payload).split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('payload cifrado invalido');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
