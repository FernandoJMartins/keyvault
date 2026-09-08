import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'keyvault_token';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET invalido: defina uma string aleatoria longa no .env.');
  }
  return secret;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, getSecret(), { expiresIn: '12h' });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'nao autenticado' });
  try {
    req.user = jwt.verify(token, getSecret());
    next();
  } catch {
    res.status(401).json({ error: 'sessao invalida ou expirada' });
  }
}
