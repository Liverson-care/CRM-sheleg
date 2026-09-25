import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Magasin d'utilisateurs de l'application (commerciaux + admin).
 * Persisté dans server/data/users.json (exclu de Git). Mots de passe hachés
 * avec scrypt (jamais stockés en clair).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const FILE = path.join(DATA_DIR, 'users.json');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let users = [];

function load() {
  try {
    users = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    users = [];
  }
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

function newId() {
  return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
}

/** Crée les comptes par défaut si le magasin est vide. */
function seedIfEmpty() {
  if (users.length) return;
  const seed = [
    { name: 'Admin', username: 'admin', role: 'admin', password: 'Sheleg2655', odooCommercial: '' },
    { name: 'Yona H', username: 'yona', role: 'commercial', password: 'Yona2655', odooCommercial: 'Yona Halimi' },
    { name: 'Laurent B', username: 'laurent', role: 'commercial', password: 'Laurent2655', odooCommercial: 'Laurent B' },
  ];
  users = seed.map((u) => {
    const { salt, hash } = hashPassword(u.password);
    return {
      id: newId(),
      name: u.name,
      username: u.username,
      role: u.role,
      odooCommercial: u.odooCommercial,
      active: true,
      salt,
      hash,
    };
  });
  persist();
}

load();
seedIfEmpty();

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    odooCommercial: u.odooCommercial || '',
    active: u.active !== false,
  };
}

/** Vérifie login (username OU nom, insensible à la casse) + mot de passe. */
export function verifyLogin(login, password) {
  const l = String(login || '').trim().toLowerCase();
  const u = users.find(
    (x) =>
      x.active !== false &&
      (x.username.toLowerCase() === l || x.name.toLowerCase() === l)
  );
  if (!u) return null;
  if (!verifyPassword(password || '', u.salt, u.hash)) return null;
  return publicUser(u);
}

export function listUsers() {
  return users.map(publicUser);
}

export function createUser({ name, username, password, role = 'commercial', odooCommercial = '' }) {
  if (!name || !username || !password) throw new Error('Nom, identifiant et mot de passe requis');
  const uname = String(username).trim().toLowerCase();
  if (users.some((u) => u.username.toLowerCase() === uname)) {
    throw new Error('Cet identifiant existe déjà');
  }
  const { salt, hash } = hashPassword(password);
  const u = {
    id: newId(),
    name: name.trim(),
    username: uname,
    role: role === 'admin' ? 'admin' : 'commercial',
    odooCommercial: odooCommercial || '',
    active: true,
    salt,
    hash,
  };
  users.push(u);
  persist();
  return publicUser(u);
}

export function updateUser(id, changes = {}) {
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error('Utilisateur introuvable');
  if (changes.name != null) u.name = String(changes.name).trim();
  if (changes.role != null) u.role = changes.role === 'admin' ? 'admin' : 'commercial';
  if (changes.odooCommercial != null) u.odooCommercial = changes.odooCommercial;
  if (changes.active != null) u.active = Boolean(changes.active);
  if (changes.password) {
    const { salt, hash } = hashPassword(changes.password);
    u.salt = salt;
    u.hash = hash;
  }
  persist();
  return publicUser(u);
}

export function deleteUser(id) {
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error('Utilisateur introuvable');
  if (u.role === 'admin' && users.filter((x) => x.role === 'admin').length <= 1) {
    throw new Error('Impossible de supprimer le dernier administrateur');
  }
  users = users.filter((x) => x.id !== id);
  persist();
}

/** Retourne l'utilisateur (public) par identifiant technique. */
export function getUser(id) {
  const u = users.find((x) => x.id === id);
  return u ? publicUser(u) : null;
}
