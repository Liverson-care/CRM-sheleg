import config from './config.js';

/**
 * Client Odoo minimaliste basé sur le protocole JSON-RPC exposé par Odoo
 * (endpoint /jsonrpc). Compatible Odoo Online / odoo.sh / self-hosted.
 *
 * Deux services sont utilisés :
 *   - "common"  → authenticate(db, login, apiKey, {})  → renvoie un uid
 *   - "object"  → execute_kw(db, uid, apiKey, model, method, args, kwargs)
 *
 * L'uid est mis en cache après la première authentification.
 */

let cachedUid = null;

async function jsonRpc(service, method, args) {
  const response = await fetch(`${config.odoo.url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Math.floor(Math.random() * 1_000_000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    const message =
      data.error?.data?.message || data.error?.message || 'Erreur Odoo inconnue';
    throw new Error(`Odoo: ${message}`);
  }
  return data.result;
}

async function authenticate() {
  if (cachedUid) return cachedUid;
  const uid = await jsonRpc('common', 'authenticate', [
    config.odoo.db,
    config.odoo.username,
    config.odoo.apiKey,
    {},
  ]);
  if (!uid) {
    throw new Error(
      "Authentification Odoo échouée : vérifiez ODOO_DB, ODOO_USERNAME et ODOO_API_KEY."
    );
  }
  cachedUid = uid;
  return uid;
}

/**
 * Appelle une méthode d'un modèle Odoo (execute_kw).
 * @param {string} model  ex: 'res.partner'
 * @param {string} method ex: 'search_read'
 * @param {Array}  args   arguments positionnels
 * @param {Object} kwargs arguments nommés (fields, limit, ...)
 */
async function executeKw(model, method, args = [], kwargs = {}) {
  const uid = await authenticate();
  return jsonRpc('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    model,
    method,
    args,
    kwargs,
  ]);
}

/** Vérifie la connexion (utilisé par /api/health). */
async function ping() {
  const version = await jsonRpc('common', 'version', []);
  await authenticate();
  return version;
}

/** Réinitialise le cache d'uid (utile si la clé API change). */
function resetSession() {
  cachedUid = null;
}

export default { executeKw, authenticate, ping, resetSession };
