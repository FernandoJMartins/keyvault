import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const dataDir = process.env.DATA_DIR || './data';
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'keyvault.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const credentialColumns = db.prepare('PRAGMA table_info(credentials)').all().map((c) => c.name);
if (!credentialColumns.includes('status')) {
  db.exec("ALTER TABLE credentials ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo'");
}

function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      '[keyvault] Nenhum usuario cadastrado e ADMIN_EMAIL/ADMIN_PASSWORD nao definidos no .env. ' +
        'Defina-os e reinicie para criar o primeiro usuario.'
    );
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase().trim(), hash);
  console.log(`[keyvault] Usuario administrador criado: ${email}`);
}

seedAdmin();

export default db;
