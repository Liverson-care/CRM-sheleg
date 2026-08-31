import type { Client, Product, OrderSummary, OrderDetail, CreatedOrder } from './types';

const TOKEN_KEY = 'sheleg.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible : on ignore */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    setToken(null);
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  }
  return data as T;
}

export const api = {
  async login(username: string, password: string) {
    return request<{ token: string; user: { name: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getClients(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<Client[]>(`/api/clients${q}`);
  },

  getClient(id: number) {
    return request<Client>(`/api/clients/${id}`);
  },

  getProducts(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<Product[]>(`/api/products${q}`);
  },

  getProduct(id: number) {
    return request<Product>(`/api/products/${id}`);
  },

  getOrders(clientId?: number) {
    const q = clientId ? `?clientId=${clientId}` : '';
    return request<OrderSummary[]>(`/api/orders${q}`);
  },

  getOrder(id: number | string) {
    return request<OrderDetail>(`/api/orders/${id}`);
  },

  createOrder(payload: {
    clientId: number;
    lines: { productId: number; qty: number; price: number; name: string; discount: number; vat: number }[];
    comment?: string;
    deliveryDate?: string;
    globalDiscount?: number;
  }) {
    return request<CreatedOrder>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  health() {
    return request<{ mode: string; odooConnected?: boolean }>('/api/health');
  },
};
