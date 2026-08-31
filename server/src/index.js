import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import config from './config.js';
import odoo from './odoo.js';
import { requireAuth } from './middleware/auth.js';
import {
  getClients,
  getProducts,
  createOrder,
  getOrders,
} from './repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// --- Santé / diagnostic ----------------------------------------------------

app.get('/api/health', async (req, res) => {
  const info = { status: 'ok', mode: config.odooEnabled ? 'odoo' : 'demo' };
  if (config.odooEnabled) {
    try {
      info.odoo = await odoo.ping();
      info.odooConnected = true;
    } catch (err) {
      info.odooConnected = false;
      info.odooError = err.message;
    }
  }
  res.json(info);
});

// --- Authentification de l'application -------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  // En mode démo, on valide contre DEMO_USER/DEMO_PASSWORD.
  // En mode Odoo, on peut réutiliser les mêmes identifiants applicatifs
  // (l'accès Odoo lui-même passe par la clé API côté serveur).
  const okUser = (username || '').trim().toLowerCase() === config.demo.user.toLowerCase();
  const okPass = (password || '') === config.demo.password;

  if (!okUser || !okPass) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  const token = jwt.sign({ sub: username, name: username }, config.jwtSecret, {
    expiresIn: '12h',
  });
  res.json({ token, user: { name: username } });
});

// --- Ressources métier -----------------------------------------------------

app.get('/api/clients', requireAuth, async (req, res) => {
  try {
    const clients = await getClients({ search: req.query.search || '' });
    res.json(clients);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const products = await getProducts({ search: req.query.search || '' });
    res.json(products);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await getOrders();
    res.json(orders);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const result = await createOrder({
      ...req.body,
      salesperson: req.user?.name || '',
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Service du client buildé (production) ---------------------------------

const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(config.port, () => {
  const mode = config.odooEnabled ? 'ODOO' : 'DÉMO';
  console.log(`Sheleg CRM — serveur démarré sur le port ${config.port} [mode ${mode}]`);
  if (!config.odooEnabled) {
    console.log(
      `  → Odoo non configuré : données de démo. Login app : ${config.demo.user} / ${config.demo.password}`
    );
  }
});
