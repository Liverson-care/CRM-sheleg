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
    // Infos commerciales (présentes seulement sur la fiche détaillée)
    credit: partner.credit ?? null,
    creditLimit: partner.credit_limit ?? partner.creditLimit ?? null,
    paymentTerm: Array.isArray(partner.property_payment_term_id)
      ? partner.property_payment_term_id[1]
      : partner.paymentTerm || '',
    totalInvoiced: partner.total_invoiced ?? partner.totalInvoiced ?? null,
    saleOrderCount: partner.sale_order_count ?? null,
  };
}

function productImage(product) {
  // Odoo renvoie les images en base64 ; on construit une URL de données.
  const raw = product.image_512 || product.image_256 || product.image_128;
  if (typeof raw === 'string' && raw) return `data:image/png;base64,${raw}`;
  return product.image || '';
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
    image: productImage(product),
    description: product.description_sale || product.description || '',
    // Taux de TVA (%) : explicite en démo, sinon taux par défaut (Odoo recalcule).
    vat: product.vat ?? config.defaultVat,
  };
}

// Mappe l'état Odoo d'une commande vers un statut applicatif.
function orderStatus(state) {
  if (state === 'sale' || state === 'done') return 'confirmee';
  if (state === 'cancel') return 'annulee';
  return 'envoyee'; // draft / sent = envoyée à Odoo, en attente de confirmation
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

// Champs commerciaux fournis par les modules Sale / Invoicing.
// Lus « au mieux » : si un module n'est pas installé, on retombe sur la base.
const PARTNER_EXTRA_FIELDS = [
  'credit',
  'credit_limit',
  'property_payment_term_id',
  'total_invoiced',
  'sale_order_count',
];

/** Récupère un client par son identifiant, avec ses infos commerciales. */
export async function getClientById(id) {
  const clientId = Number(id);
  if (!config.odooEnabled) {
    const found = demoClients.find((c) => c.id === clientId);
    return found ? normalizeClient(found) : null;
  }

  let partners;
  try {
    partners = await odoo.executeKw('res.partner', 'read', [[clientId]], {
      fields: [...PARTNER_FIELDS, ...PARTNER_EXTRA_FIELDS],
    });
  } catch {
    // Un champ étendu peut être absent selon les modules installés : repli.
    partners = await odoo.executeKw('res.partner', 'read', [[clientId]], {
      fields: PARTNER_FIELDS,
    });
  }
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
    fields: PRODUCT_LIST_FIELDS,
    limit: 1000,
    order: 'name asc',
  });
  return products.map(normalizeProduct);
}

// Vignette (image_128) pour la liste ; image_512 + description pour la fiche.
const PRODUCT_LIST_FIELDS = [
  'id',
  'name',
  'default_code',
  'barcode',
  'list_price',
  'categ_id',
  'uom_id',
  'qty_available',
  'image_128',
];
const PRODUCT_DETAIL_FIELDS = [
  'id',
  'name',
  'default_code',
  'barcode',
  'list_price',
  'categ_id',
  'uom_id',
  'qty_available',
  'image_512',
  'description_sale',
];

/** Récupère un produit par son identifiant (fiche détaillée). */
export async function getProductById(id) {
  const pid = Number(id);
  if (!config.odooEnabled) {
    const p = demoProducts.find((x) => x.id === pid);
    return p ? normalizeProduct(p) : null;
  }
  let rows;
  try {
    rows = await odoo.executeKw('product.product', 'read', [[pid]], {
      fields: PRODUCT_DETAIL_FIELDS,
    });
  } catch {
    rows = await odoo.executeKw('product.product', 'read', [[pid]], {
      fields: PRODUCT_LIST_FIELDS,
    });
  }
  return rows.length ? normalizeProduct(rows[0]) : null;
}

// ---------- Commandes ----------

/**
 * Combine une remise de ligne et une remise globale en un seul pourcentage.
 * effectif = 1 - (1 - ligne%)(1 - globale%)
 */
function combinedDiscount(lineDiscount = 0, globalDiscount = 0) {
  const d = 1 - (1 - lineDiscount / 100) * (1 - globalDiscount / 100);
  return Math.round(d * 10000) / 100; // % avec 2 décimales
}

/**
 * Crée une commande dans Odoo (à l'envoi d'un devis finalisé).
 * @param {Object} order {
 *   clientId, lines:[{ productId, qty, price, name, discount, vat }],
 *   comment, deliveryDate, globalDiscount, salesperson
 * }
 * @returns {Object} { id, reference }
 */
export async function createOrder(order) {
  const {
    clientId,
    lines,
    comment = '',
    deliveryDate = '',
    globalDiscount = 0,
    salesperson = '',
  } = order;

  if (!clientId) throw new Error('Client manquant');
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('La commande ne contient aucune ligne');
  }

  if (!config.odooEnabled) {
    const id = 9000 + demoOrders.length + 1;
    const reference = `S${String(id).padStart(5, '0')}`;
    const totalHT = lines.reduce((sum, l) => {
      const disc = combinedDiscount(l.discount, globalDiscount) / 100;
      return sum + l.qty * l.price * (1 - disc);
    }, 0);
    const totalTVA = lines.reduce((sum, l) => {
      const disc = combinedDiscount(l.discount, globalDiscount) / 100;
      return sum + l.qty * l.price * (1 - disc) * ((l.vat ?? config.defaultVat) / 100);
    }, 0);
    const record = {
      id,
      reference,
      clientId,
      client: demoClients.find((c) => c.id === clientId)?.name || 'Client',
      lines,
      comment,
      deliveryDate,
      globalDiscount,
      salesperson,
      total: totalHT + totalTVA,
      totalHT,
      totalTVA,
      state: 'draft', // envoyée à Odoo ; le back-office confirmera
      date: new Date().toISOString(),
    };
    demoOrders.unshift(record);
    return { id, reference, status: 'envoyee' };
  }

  // Odoo : création d'un sale.order avec ses lignes et remises.
  const orderLines = lines.map((l) => [
    0,
    0,
    {
      product_id: l.productId,
      product_uom_qty: l.qty,
      price_unit: l.price,
      discount: combinedDiscount(l.discount, globalDiscount),
      ...(l.name ? { name: l.name } : {}),
    },
  ]);

  const values = { partner_id: clientId, order_line: orderLines };
  if (comment) values.note = comment;
  if (deliveryDate) values.commitment_date = deliveryDate; // date de livraison

  const orderId = await odoo.executeKw('sale.order', 'create', [values]);
  const [created] = await odoo.executeKw('sale.order', 'read', [[orderId]], {
    fields: ['name'],
  });
  return { id: orderId, reference: created?.name || String(orderId), status: 'envoyee' };
}

export async function getOrders({ clientId } = {}) {
  const filterId = clientId ? Number(clientId) : null;

  if (!config.odooEnabled) {
    const list = filterId
      ? demoOrders.filter((o) => o.clientId === filterId)
      : demoOrders;
    return list.map((o) => ({ ...o, status: orderStatus(o.state) }));
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
    status: orderStatus(o.state),
    date: o.date_order,
  }));
}
