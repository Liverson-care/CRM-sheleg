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
    // Conditionnement : list_price est le prix du COLIS, unitPrice le prix/pièce.
    packSize: product.packSize ?? 1,
    unitPrice: (product.list_price ?? 0) / (product.packSize ?? 1),
  };
}

// Mappe l'état Odoo (+ statut de livraison) vers un statut applicatif.
function orderStatus(state, deliveryStatus) {
  if (state === 'cancel') return 'annulee';
  if ((state === 'sale' || state === 'done') && deliveryStatus === 'full') return 'livree';
  if (state === 'sale' || state === 'done') return 'confirmee';
  return 'envoyee'; // draft / sent = envoyée à Odoo, en attente de confirmation
}

/** Combine remise ligne + globale (fraction 0..1). */
function combinedFrac(lineDiscount = 0, globalDiscount = 0) {
  return 1 - (1 - lineDiscount / 100) * (1 - globalDiscount / 100);
}

/** Totaux HT / TVA / TTC à partir de lignes { qty, price, discount, vat }. */
function orderTotals(lines = [], globalDiscount = 0) {
  let ht = 0;
  let tva = 0;
  for (const l of lines) {
    const net = l.qty * l.price * (1 - combinedFrac(l.discount, globalDiscount));
    ht += net;
    tva += net * ((l.vat ?? config.defaultVat) / 100);
  }
  return { ht, tva, ttc: ht + tva };
}

// ---------- Clients ----------

export async function getClients({ search = '' } = {}) {
  if (!config.odooEnabled) {
    const s = search.trim().toLowerCase();
    return demoClients
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s))
      .map(normalizeClient)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  // Un contact est proposé comme client s'il est déjà client (customer_rank)
  // ou si c'est une société (utile tant que les clients ne sont pas encore
  // marqués comme tels dans Odoo). Filtrage complémentaire par recherche.
  const customerClause = ['|', ['customer_rank', '>', 0], ['is_company', '=', true]];
  const domain = search.trim()
    ? ['&', ...customerClause, '|', ['name', 'ilike', search], ['email', 'ilike', search]]
    : customerClause;
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
    return list.map((o) => {
      const t = orderTotals(o.lines, o.globalDiscount || 0);
      return {
        id: o.id,
        reference: o.reference,
        client: o.client,
        clientId: o.clientId,
        total: t.ttc,
        status: orderStatus(o.state, o.deliveryStatus),
        date: o.date,
      };
    });
  }

  const domain = filterId ? [['partner_id', '=', filterId]] : [];
  const orders = await odoo.executeKw('sale.order', 'search_read', [domain], {
    fields: ['id', 'name', 'partner_id', 'amount_total', 'state', 'date_order', ...DELIVERY_FIELD],
    limit: 100,
    order: 'date_order desc',
  });
  return orders.map((o) => ({
    id: o.id,
    reference: o.name,
    client: Array.isArray(o.partner_id) ? o.partner_id[1] : '',
    total: o.amount_total ?? 0,
    status: orderStatus(o.state, o.delivery_status),
    date: o.date_order,
  }));
}

// delivery_status existe sur sale.order (Odoo 16+ avec le module Stock).
const DELIVERY_FIELD = ['delivery_status'];

/** Détail complet d'une commande (lignes + totaux) pour la revue et le PDF. */
export async function getOrderById(id) {
  if (!config.odooEnabled) {
    const o = demoOrders.find((x) => String(x.id) === String(id));
    if (!o) return null;
    const t = orderTotals(o.lines, o.globalDiscount || 0);
    return {
      id: o.id,
      reference: o.reference,
      client: o.client,
      clientId: o.clientId,
      status: orderStatus(o.state, o.deliveryStatus),
      deliveryDate: o.deliveryDate || '',
      comment: o.comment || '',
      globalDiscount: o.globalDiscount || 0,
      date: o.date,
      lines: o.lines.map((l) => {
        const pack = demoProducts.find((p) => p.id === l.productId)?.packSize ?? 1;
        return {
          name: l.name,
          productId: l.productId,
          qty: l.qty,
          price: l.price,
          packSize: pack,
          unitPrice: l.price / pack,
          discount: l.discount || 0,
          vat: l.vat ?? config.defaultVat,
          totalHT: l.qty * l.price * (1 - combinedFrac(l.discount, o.globalDiscount || 0)),
        };
      }),
      totalHT: t.ht,
      totalTVA: t.tva,
      totalTTC: t.ttc,
    };
  }

  // Odoo : lecture de la commande puis de ses lignes.
  let head;
  try {
    [head] = await odoo.executeKw('sale.order', 'read', [[Number(id)]], {
      fields: [
        'name', 'partner_id', 'commitment_date', 'note', 'state',
        'amount_untaxed', 'amount_tax', 'amount_total', 'order_line', 'date_order',
        ...DELIVERY_FIELD,
      ],
    });
  } catch {
    [head] = await odoo.executeKw('sale.order', 'read', [[Number(id)]], {
      fields: [
        'name', 'partner_id', 'commitment_date', 'note', 'state',
        'amount_untaxed', 'amount_tax', 'amount_total', 'order_line', 'date_order',
      ],
    });
  }
  if (!head) return null;

  const lineRows = head.order_line?.length
    ? await odoo.executeKw('sale.order.line', 'read', [head.order_line], {
        fields: ['name', 'product_id', 'product_uom_qty', 'price_unit', 'discount', 'price_subtotal'],
      })
    : [];

  return {
    id: Number(id),
    reference: head.name,
    client: Array.isArray(head.partner_id) ? head.partner_id[1] : '',
    clientId: Array.isArray(head.partner_id) ? head.partner_id[0] : null,
    status: orderStatus(head.state, head.delivery_status),
    deliveryDate: head.commitment_date || '',
    comment: head.note || '',
    date: head.date_order,
    lines: lineRows.map((l) => ({
      name: l.name,
      productId: Array.isArray(l.product_id) ? l.product_id[0] : undefined,
      qty: l.product_uom_qty,
      price: l.price_unit,
      packSize: 1,
      unitPrice: l.price_unit,
      discount: l.discount || 0,
      totalHT: l.price_subtotal ?? 0,
    })),
    totalHT: head.amount_untaxed ?? 0,
    totalTVA: head.amount_tax ?? 0,
    totalTTC: head.amount_total ?? 0,
  };
}
