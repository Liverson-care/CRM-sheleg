import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Client, Product, CartLine } from './types';

interface CartState {
  client: Client | null;
  lines: CartLine[];
  note: string;
  setClient: (c: Client | null) => void;
  setNote: (n: string) => void;
  addProduct: (p: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  removeProduct: (productId: number) => void;
  clear: () => void;
  count: number;
  total: number;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [note, setNote] = useState('');

  function addProduct(product: Product, qty = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { product, qty }];
    });
  }

  function setQty(productId: number, qty: number) {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, qty } : l))
    );
  }

  function removeProduct(productId: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function clear() {
    setLines([]);
    setClient(null);
    setNote('');
  }

  const count = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const total = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.product.list_price, 0),
    [lines]
  );

  return (
    <CartContext.Provider
      value={{
        client,
        lines,
        note,
        setClient,
        setNote,
        addProduct,
        setQty,
        removeProduct,
        clear,
        count,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé dans CartProvider');
  return ctx;
}
