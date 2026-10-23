// Local / self-hosted entry point. On Vercel, api/index.js serves the same app.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const PORT = Number(process.env.API_PORT) || 3001;

const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
