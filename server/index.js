import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js'; // inicializa o banco e cria o usuario admin se necessario
import authRoutes from './routes/auth.routes.js';
import credentialsRoutes from './routes/credentials.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/credentials', credentialsRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`[keyvault] servidor rodando na porta ${port}`);
});
