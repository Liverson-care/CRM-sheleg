import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type {
  Client,
  Product,
  Draft,
  DraftLine,
  CreatedOrder,
  OrderDetail,
} from './types';

const STORAGE_KEY = 'sheleg.devis';

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `d${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
}

function loadDevis(): Draft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

function saveDevis(list: Draft[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible */
  }
}

/** Remise combinée (ligne + globale) en fraction [0..1]. */
function combined(lineDiscount: number, globalDiscount: number) {
  return 1 - (1 - lineDiscount / 100) * (1 - globalDiscount / 100);
}

export interface Totals {
  count: number;
  grossHT: number;
  discount: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

export function computeTotals(draft: Draft | null): Totals {
  const empty = { count: 0, grossHT: 0, discount: 0, totalHT: 0, totalTVA: 0, totalTTC: 0 };
  if (!draft) return empty;
  let count = 0;
  let grossHT = 0;
  let totalHT = 0;
  let totalTVA = 0;
  for (const l of draft.lines) {
    count += l.qty;
    const gross = l.qty * l.product.list_price;
    const net = gross * (1 - combined(l.discount, draft.globalDiscount));
    grossHT += gross;
    totalHT += net;
    totalTVA += net * ((l.product.vat ?? 20) / 100);
  }
  return {
    count,
    grossHT,
    discount: grossHT - totalHT,
    totalHT,
    totalTVA,
    totalTTC: totalHT + totalTVA,
  };
}

interface OrderState {
  draft: Draft | null;
  devisList: Draft[];
  totals: Totals;
  setClient: (c: Client) => void;
  addProduct: (p: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  setLineDiscount: (productId: number, pct: number) => void;
  setGlobalDiscount: (pct: number) => void;
  setDeliveryDate: (d: string) => void;
  setComment: (c: string) => void;
  keepDraft: () => void;
  deleteCurrent: () => void;
  openDevis: (id: string) => void;
  removeDevis: (id: string) => void;
  duplicateToDraft: (order: OrderDetail, client: Client) => void;
  send: () => Promise<CreatedOrder>;
}

const OrderContext = createContext<OrderState | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [devisList, setDevisList] = useState<Draft[]>(() => loadDevis());
  const skipPersist = useRef(false);

  // Persiste la liste des devis à chaque changement.
  useEffect(() => {
    saveDevis(devisList);
  }, [devisList]);

  // Auto-sauvegarde du devis en cours dans la liste (dès qu'il a une ligne).
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    if (!draft) return;
    setDevisList((list) => {
      const exists = list.some((d) => d.id === draft.id);
      if (draft.lines.length === 0) {
        return exists ? list.filter((d) => d.id !== draft.id) : list;
      }
      const updated = { ...draft, updatedAt: Date.now() };
      return exists
        ? list.map((d) => (d.id === draft.id ? updated : d))
        : [updated, ...list];
    });
  }, [draft]);

  function ensureDraft(client?: Client): Draft {
    if (draft) return draft;
    const fresh: Draft = {
      id: newId(),
      client: client ?? null,
      lines: [],
      globalDiscount: 0,
      deliveryDate: '',
      comment: '',
      updatedAt: Date.now(),
    };
    setDraft(fresh);
    return fresh;
  }

  function mutate(fn: (d: Draft) => Draft) {
    setDraft((prev) => {
      const base =
        prev ?? {
          id: newId(),
          client: null,
          lines: [] as DraftLine[],
          globalDiscount: 0,
          deliveryDate: '',
          comment: '',
          updatedAt: Date.now(),
        };
      return fn(base);
    });
  }

  function setClient(c: Client) {
    ensureDraft(c);
    mutate((d) => ({ ...d, client: c }));
  }

  function addProduct(p: Product, qty = 1) {
    mutate((d) => {
      const existing = d.lines.find((l) => l.product.id === p.id);
      const lines = existing
        ? d.lines.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + qty } : l))
        : [...d.lines, { product: p, qty, discount: 0 }];
      return { ...d, lines };
    });
  }

  function setQty(productId: number, qty: number) {
    mutate((d) => ({
      ...d,
      lines:
        qty <= 0
          ? d.lines.filter((l) => l.product.id !== productId)
          : d.lines.map((l) => (l.product.id === productId ? { ...l, qty } : l)),
    }));
  }

  function setLineDiscount(productId: number, pct: number) {
    const clamped = Math.max(0, Math.min(100, pct || 0));
    mutate((d) => ({
      ...d,
      lines: d.lines.map((l) =>
        l.product.id === productId ? { ...l, discount: clamped } : l
      ),
    }));
  }

  function setGlobalDiscount(pct: number) {
    mutate((d) => ({ ...d, globalDiscount: Math.max(0, Math.min(100, pct || 0)) }));
  }

  function setDeliveryDate(dd: string) {
    mutate((d) => ({ ...d, deliveryDate: dd }));
  }

  function setComment(c: string) {
    mutate((d) => ({ ...d, comment: c }));
  }

  function clearCurrent() {
    skipPersist.current = true;
    setDraft(null);
  }

  /** Conserver le devis (déjà en liste) et quitter l'édition. */
  function keepDraft() {
    clearCurrent();
  }

  /** Supprimer le devis en cours. */
  function deleteCurrent() {
    if (draft) {
      const id = draft.id;
      setDevisList((list) => list.filter((d) => d.id !== id));
    }
    clearCurrent();
  }

  function openDevis(id: string) {
    const found = devisList.find((d) => d.id === id);
    if (found) setDraft(found);
  }

  /** Duplique une commande existante vers un nouveau devis pour un autre client. */
  function duplicateToDraft(order: OrderDetail, client: Client) {
    const lines: DraftLine[] = order.lines.map((l) => ({
      product: {
        id: l.productId ?? Math.floor(Math.random() * -1000000),
        name: l.name,
        default_code: '',
        barcode: '',
        list_price: l.price,
        category: '',
        uom: '',
        qty_available: 0,
        vat: l.vat ?? 20,
      },
      qty: l.qty,
      discount: l.discount,
    }));
    setDraft({
      id: newId(),
      client,
      lines,
      globalDiscount: 0,
      deliveryDate: '',
      comment: '',
      updatedAt: Date.now(),
    });
  }

  function removeDevis(id: string) {
    setDevisList((list) => list.filter((d) => d.id !== id));
    if (draft?.id === id) clearCurrent();
  }

  async function send(): Promise<CreatedOrder> {
    if (!draft) throw new Error('Aucun devis en cours');
    if (!draft.client) throw new Error('Veuillez sélectionner un client');
    if (draft.lines.length === 0) throw new Error('Le devis est vide');

    const result = await api.createOrder({
      clientId: draft.client.id,
      comment: draft.comment,
      deliveryDate: draft.deliveryDate,
      globalDiscount: draft.globalDiscount,
      lines: draft.lines.map((l) => ({
        productId: l.product.id,
        qty: l.qty,
        price: l.product.list_price,
        name: l.product.name,
        discount: l.discount,
        vat: l.product.vat ?? 20,
      })),
    });

    // Le devis local est envoyé : on le retire de la liste.
    const id = draft.id;
    setDevisList((list) => list.filter((d) => d.id !== id));
    clearCurrent();
    return result;
  }

  const totals = useMemo(() => computeTotals(draft), [draft]);

  return (
    <OrderContext.Provider
      value={{
        draft,
        devisList,
        totals,
        setClient,
        addProduct,
        setQty,
        setLineDiscount,
        setGlobalDiscount,
        setDeliveryDate,
        setComment,
        keepDraft,
        deleteCurrent,
        openDevis,
        removeDevis,
        duplicateToDraft,
        send,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder doit être utilisé dans OrderProvider');
  return ctx;
}
