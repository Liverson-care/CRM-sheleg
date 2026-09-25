import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  odoo: {
    url: (process.env.ODOO_URL || '').replace(/\/+$/, ''),
    db: process.env.ODOO_DB || '',
    username: process.env.ODOO_USERNAME || '',
    apiKey: process.env.ODOO_API_KEY || '',
  },
  demo: {
    user: process.env.DEMO_USER || 'sheleg',
    password: process.env.DEMO_PASSWORD || 'sheleg',
  },
  // Taux de TVA par défaut (%) appliqué aux produits Odoo sans taux explicite.
  defaultVat: Number(process.env.DEFAULT_VAT_RATE || 5.5),
  // Champ Odoo (sale.order) recevant le nom du commercial qui envoie la commande.
  commercialField: process.env.ODOO_COMMERCIAL_FIELD || 'x_studio_commercial',
};

/**
 * Odoo est considéré comme configuré uniquement si toutes les variables
 * nécessaires sont présentes. Sinon l'application bascule en mode démo.
 */
config.odooEnabled = Boolean(
  config.odoo.url &&
    config.odoo.db &&
    config.odoo.username &&
    config.odoo.apiKey
);

export default config;
