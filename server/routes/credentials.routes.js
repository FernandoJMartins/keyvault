import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { encryptJSON, decryptJSON } from '../crypto.js';
import { getTotpCode } from '../totp.js';

const router = Router();
router.use(requireAuth);

const STATUS_VALUES = ['ativo', 'restrita', 'banida', 'suspensa', 'deletada'];

function rowToCredential(row) {
  let fields = {};
  try {
    fields = decryptJSON(row.data);
  } catch (err) {
    console.error(`[keyvault] falha ao decifrar credencial ${row.id}:`, err.message);
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    status: row.status || 'ativo',
    fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM credentials WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user.sub);
  res.json(rows.map(rowToCredential));
});

router.get('/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM credentials WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'nao encontrado' });
  res.json(rowToCredential(row));
});

router.post('/', (req, res) => {
  const { type, name, status, fields } = req.body || {};
  if (!type || !name) {
    return res.status(400).json({ error: 'tipo e nome sao obrigatorios' });
  }
  if (status && !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: 'status invalido' });
  }
  const encrypted = encryptJSON(fields || {});
  const result = db
    .prepare('INSERT INTO credentials (user_id, type, name, status, data) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.sub, String(type), String(name), status || 'ativo', encrypted);
  const row = db.prepare('SELECT * FROM credentials WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(rowToCredential(row));
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM credentials WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!existing) return res.status(404).json({ error: 'nao encontrado' });

  const { type, name, status, fields } = req.body || {};
  if (!type || !name) {
    return res.status(400).json({ error: 'tipo e nome sao obrigatorios' });
  }
  if (status && !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: 'status invalido' });
  }
  const encrypted = encryptJSON(fields || {});
  db.prepare(
    "UPDATE credentials SET type = ?, name = ?, status = ?, data = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(String(type), String(name), status || 'ativo', encrypted, existing.id);

  const row = db.prepare('SELECT * FROM credentials WHERE id = ?').get(existing.id);
  res.json(rowToCredential(row));
});

router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM credentials WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.sub);
  if (result.changes === 0) return res.status(404).json({ error: 'nao encontrado' });
  res.json({ ok: true });
});

router.get('/:id/totp', (req, res) => {
  const row = db
    .prepare('SELECT * FROM credentials WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'nao encontrado' });

  const { fields } = rowToCredential(row);
  const secret = fields?.totpSecret;
  if (!secret) return res.status(404).json({ error: 'nenhum segredo 2FA cadastrado para esta credencial' });

  try {
    res.json(getTotpCode(secret));
  } catch (err) {
    res.status(400).json({ error: 'segredo 2FA invalido: ' + err.message });
  }
});

export default router;
