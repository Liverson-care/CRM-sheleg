export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  street: string;
  zip: string;
  // Infos commerciales (fiche détaillée uniquement)
  credit?: number | null;
  creditLimit?: number | null;
  paymentTerm?: string;
  totalInvoiced?: number | null;
  saleOrderCount?: number | null;
}

export interface Product {
  id: number;
  name: string;
  default_code: string;
  barcode: string;
  list_price: number;
  category: string;
  uom: string;
  qty_available: number;
  image?: string;
  description?: string;
  vat?: number; // taux de TVA en %
}

/** Ligne d'un devis en cours d'édition. */
export interface DraftLine {
  product: Product;
  qty: number;
  discount: number; // remise ligne en %
}

/** Devis (brouillon local, non envoyé à Odoo). */
export interface Draft {
  id: string;
  client: Client | null;
  lines: DraftLine[];
  globalDiscount: number; // remise globale en %
  deliveryDate: string; // AAAA-MM-JJ
  comment: string;
  updatedAt: number;
}

export type OrderStatus = 'devis' | 'envoyee' | 'confirmee' | 'annulee';

export interface OrderSummary {
  id: number | string;
  reference: string;
  client: string;
  total: number;
  state?: string;
  status: OrderStatus;
  date: string;
}

export interface CreatedOrder {
  id: number;
  reference: string;
  status: OrderStatus;
}
