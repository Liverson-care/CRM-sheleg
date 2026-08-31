export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  street: string;
  zip: string;
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
}

export interface CartLine {
  product: Product;
  qty: number;
}

export interface OrderSummary {
  id: number;
  reference: string;
  client: string;
  total: number;
  state: string;
  date: string;
}

export interface CreatedOrder {
  id: number;
  reference: string;
}
