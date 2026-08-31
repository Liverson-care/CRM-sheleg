import config from './config.js';
import odoo from './odoo.js';
import { demoClients, demoProducts, demoOrders } from './demoData.js';

/**
 * Couche d'accès aux données. Selon la configuration, elle interroge Odoo
 * ou renvoie les données de démonstration. Le frontend reçoit toujours la
 * même structure normalisée, quel que soit le mode.
 */

// ---------- Normalisation ----------

function normalizeClient(partner) {
  return {
    id: partner.id,
    name: partner.name || '',
    email: partner.email || '',
    phone: partner.phone || partner.mobile || '',
    city: partner.city || '',
    street: partner.street || '',
    zip: partner.zip || '',
  };
}

function normalizeProduct(product) {
  return {
    id: product.id,
    name: product.name || '',
    default_code: product.default_code || '',
    barcode: product.barcode || '',
    list_price: product.list_price ?? 0,
    category: Array.isArray(product.categ_id)
      ? product.categ_id[1]
      : product.category || 'Divers',
    uom: Array.isArray(product.uom_id) ? product.uom_id[1] : product.uom || '',
    qty_available: product.qty_available ?? 0,
  };
}

// ---------- Clients ----------

export async function getClients({ search = '' } = {}) {
  if (!config.odooEnabled) {
    const s = search.trim().toLowerCase();
    return demoClients
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s))
      .map(normalizeClient);
  }

  const domain = [['customer_rank', '>', 0]];
  if (search.trim()) {
    domain.push('|', ['name', 'ilike', search], ['email', 'ilike', search]);
  }
  const partners = await odoo.executeKw('res.partner', 'search_read', [domain], {
    fields: PARTNER_FIELDS,
    limit: 500,
    order: 'name asc',
  });
  return partners.map(normalizeClient);
}

const PARTNER_FIELDS = [
  'id',
  'name',
  'email',
  'phone',
  'mobile',
  'city',
  'street',
  'zip',
];

/** Récupère un client par son identifiant. */
export async function getClientById(id) {
  const clientId = Number(id);
  if (!config.odooEnabled) {
    const found = demoClients.find((c) => c.id === clientId);
    return found ? normalizeClient(found) : null;
  }
  const partners = await odoo.executeKw('res.partner', 'read', [[clientId]], {
    fields: PARTNER_FIELDS,
  });
  return partners.length ? normalizeClient(partners[0]) : null;
}

// ---------- Produits ----------

export async function getProducts({ search = '' } = {}) {
  if (!config.odooEnabled) {
    const s = search.trim().toLowerCase();
    return demoProducts
      .filter(
        (p) =>
          !s ||
          p.name.toLowerCase().includes(s) ||
          p.default_code.toLowerCase().includes(s) ||
          p.barcode.includes(s)
      )
      .map(normalizeProduct);
  }

  const domain = [['sale_ok', '=', true]];
  if (search.trim()) {
    domain.push(
      '|',
      '|',
      ['name', 'ilike', search],
      ['default_code', 'ilike', search],
      ['barcode', 'ilike', search]
    );
  }
  const products = await odoo.executeKw('product.product', 'search_read', [domain], {
    fields: [
      'id',
      'name',
      'default_code',
      'barcode',
      'list_price',
      'categ_id',
      'uom_id',
      'qty_available',
    ],
    limit: 1000,
    order: 'name asc',
  });
  return products.map(normalizeProduct);
}

// ---------- Commandes ----------

/**
 * Crée une commande.
 * @param {Object} order  { clientId, lines: [{ productId, qty, price, name }], note, salesperson }
 * @returns {Object} { id, reference }
 */
export async function createOrder(order) {
  const { clientId, lines, note = '', salesperson = '' } = order;

  if (!clientId) throw new Error('Client manquant');
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('La commande ne contient aucune ligne');
  }

  if (!config.odooEnabled) {
    const id = 9000 + demoOrders.length + 1;
    const reference = `DEMO-${String(id)}`;
    const total = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
    const record = {
      id,
      reference,
      clientId,
      client: demoClients.find((c) => c.id === clientId)?.name || 'Client',
      lines,
      note,
      salesperson,
      total,
      state: 'draft',
      date: new Date().toISOString(),
    };
    demoOrders.unshift(record);
    return { id, reference };
  }

  // Odoo : création d'un sale.order avec ses lignes.
  const orderLines = lines.map((l) => [
    0,
    0,
    {
      product_id: l.productId,
      product_uom_qty: l.qty,
      price_unit: l.price,
      ...(l.name ? { name: l.name } : {}),
    },
  ]);

  const values = {
    partner_id: clientId,
    order_line: orderLines,
  };
  if (note) values.note = note;

  const orderId = await odoo.executeKw('sale.order', 'create', [values]);
  const [created] = await odoo.executeKw('sale.order', 'read', [[orderId]], {
    fields: ['name'],
  });
  return { id: orderId, reference: created?.name || String(orderId) };
}

export async function getOrders({ clientId } = {}) {
  const filterId = clientId ? Number(clientId) : null;

  if (!config.odooEnabled) {
    return filterId ? demoOrders.filter((o) => o.clientId === filterId) : demoOrders;
  }

  const domain = filterId ? [['partner_id', '=', filterId]] : [];
  const orders = await odoo.executeKw('sale.order', 'search_read', [domain], {
    fields: ['id', 'name', 'partner_id', 'amount_total', 'state', 'date_order'],
    limit: 100,
    order: 'date_order desc',
  });
  return orders.map((o) => ({
    id: o.id,
    reference: o.name,
    client: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
    total: o.amount_total ?? 0,
    state: o.state,
    date: o.date_order,
  }));
}
