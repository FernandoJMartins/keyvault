import { TOTP, Secret } from 'otpauth';

export function getTotpCode(base32Secret) {
  const cleaned = String(base32Secret || '').replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return null;

  const totp = new TOTP({
    issuer: 'KeyVault',
    label: 'account',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(cleaned),
  });

  const code = totp.generate();
  const remaining = totp.period - (Math.floor(Date.now() / 1000) % totp.period);
  return { code, remaining, period: totp.period };
}
