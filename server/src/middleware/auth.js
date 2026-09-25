import jwt from 'jsonwebtoken';
import config from '../config.js';

/** Middleware exigeant un jeton de session valide (Bearer). */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée ou invalide' });
  }
}

/** Middleware exigeant un utilisateur avec le rôle admin. */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé à l’administrateur' });
    }
    next();
  });
}
