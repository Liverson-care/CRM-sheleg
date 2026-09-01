import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useOrder, computeTotals } from '../order';
import { formatEuro, formatDate, orderStatusLabel } from '../util';
import type { OrderSummary, OrderStatus, Client } from '../types';

type FilterKey = 'tous' | OrderStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'tous', label: 'Toutes' },
  { key: 'devis', label: 'Devis' },
  { key: 'envoyee', label: 'Envoyées' },
  { key: 'confirmee', label: 'Confirmées' },
  { key: 'livree', label: 'Livrées' },
];

export default function Orders() {
  const { devisList, openDevis, removeDevis, setClient } = useOrder();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('tous');

  const [pickOpen, setPickOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    api
      .getOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pickOpen && clients.length === 0) {
      api.getClients().then(setClients).catch(() => {});
    }
  }, [pickOpen, clients.length]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    return s ? clients.filter((c) => c.name.toLowerCase().includes(s)) : clients;
  }, [clients, clientSearch]);

  function startNewOrder(c: Client) {
    setClient(c);
    setPickOpen(false);
    navigate('/commande/produits');
  }

  function reopen(id: string) {
    openDevis(id);
    navigate('/devis');
  }

  // Devis locaux normalisés comme des entrées de liste.
  const devisRows = useMemo(
    () =>
      devisList.map((d) => {
        const t = computeTotals(d);
        return {
          id: d.id,
          reference: 'Devis',
          client: d.client ? d.client.name : 'Client non défini',
          total: t.totalTTC,
          status: 'devis' as OrderStatus,
          date: new Date(d.updatedAt).toISOString(),
          count: t.count,
        };
      }),
    [devisList]
  );

  const showDevis = filter === 'tous' || filter === 'devis';
  const visibleOrders = orders.filter((o) => filter === 'tous' || o.status === filter);
  const visibleDevis = showDevis ? devisRows : [];

  const empty = !loading && visibleDevis.length === 0 && visibleOrders.length === 0;

  return (
    <div className="page">
      <div className="page-head">
        <h2>Commandes</h2>
        <button className="btn-primary btn-new-order" onClick={() => setPickOpen(true)}>
          + Nouvelle commande
        </button>
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="list">
        {/* Devis (brouillons locaux) */}
        {visibleDevis.map((d) => (
          <div key={d.id} className="list-row">
            <button className="list-main list-open" onClick={() => reopen(d.id)}>
              <div className="list-title">{d.client}</div>
              <div className="list-sub">
                {d.count} article{d.count > 1 ? 's' : ''} · brouillon
              </div>
            </button>
            <div className="order-right">
              <div className="order-total">{formatEuro(d.total)}</div>
              <span className="state state-devis">Devis</span>
            </div>
            <button
              className="icon-remove"
              onClick={() => removeDevis(d.id)}
              aria-label="Supprimer le devis"
            >
              ×
            </button>
          </div>
        ))}

        {/* Commandes envoyées / confirmées / livrées */}
        {visibleOrders.map((o) => (
          <button
            key={o.id}
            className="list-row list-open-row"
            onClick={() => navigate(`/commande/${o.id}`)}
          >
            <div className="list-main">
              <div className="list-title">{o.reference} · {o.client}</div>
              <div className="list-sub">{formatDate(o.date)}</div>
            </div>
            <div className="order-right">
              <div className="order-total">{formatEuro(o.total)}</div>
              <span className={`state state-${o.status}`}>{orderStatusLabel(o.status)}</span>
            </div>
          </button>
        ))}
      </div>

      {loading && <div className="muted">Chargement…</div>}
      {empty && (
        <div className="empty">
          Aucune commande dans ce filtre.{' '}
          <button className="link" onClick={() => setPickOpen(true)}>Nouvelle commande</button>
        </div>
      )}

      {pickOpen && (
        <div className="modal-overlay" onClick={() => setPickOpen(false)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <h3>Nouvelle commande — pour quel client ?</h3>
            <input
              className="search"
              style={{ maxWidth: 'none', width: '100%', marginBottom: 10 }}
              placeholder="Rechercher un client…"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              autoFocus
            />
            <div className="pick-list">
              {filteredClients.map((c) => (
                <button key={c.id} className="pick-row" onClick={() => startNewOrder(c)}>
                  <div className="avatar">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="list-main">
                    <div className="list-title">{c.name}</div>
                    <div className="list-sub">{[c.zip, c.city].filter(Boolean).join(' ')}</div>
                  </div>
                </button>
              ))}
              {filteredClients.length === 0 && <div className="muted">Aucun client.</div>}
            </div>
            <button className="btn-ghost btn-block" onClick={() => setPickOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
