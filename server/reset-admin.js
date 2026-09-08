import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db.js';

const email = process.argv[2] || process.env.ADMIN_EMAIL;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Uso: node server/reset-admin.js [email] [nova-senha]');
  console.error('(ou defina ADMIN_EMAIL/ADMIN_PASSWORD no .env e rode sem argumentos)');
  process.exit(1);
}
if (password.length < 8) {
  console.error('A senha deve ter ao menos 8 caracteres.');
  process.exit(1);
}

const normalizedEmail = email.toLowerCase().trim();
const hash = bcrypt.hashSync(password, 12);

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  console.log(`[keyvault] Senha redefinida para ${normalizedEmail}.`);
} else {
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(normalizedEmail, hash);
  console.log(`[keyvault] Usuario ${normalizedEmail} criado.`);
}
