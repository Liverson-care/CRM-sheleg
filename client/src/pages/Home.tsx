import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useOrder } from '../order';
import { formatEuro, formatDate, orderStatusLabel } from '../util';
import ClientPickerModal from '../components/ClientPickerModal';
import type { OrderSummary, Client } from '../types';

export default function Home() {
  const { devisList, beginOrder } = useOrder();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    api.getOrders().then(setOrders).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const by = (s: string) => orders.filter((o) => o.status === s);
    const envoyee = by('envoyee');
    const confirmee = by('confirmee');
    const livree = by('livree');
    const caRealise = [...confirmee, ...livree].reduce((s, o) => s + o.total, 0);
    return {
      devis: devisList.length,
      envoyee: envoyee.length,
      confirmee: confirmee.length,
      livree: livree.length,
      caRealise,
      total: orders.length,
    };
  }, [orders, devisList]);

  const recent = orders.slice(0, 5);

  function startNewOrder(c: Client) {
    beginOrder(c);
    setPickOpen(false);
    navigate('/commande/produits');
  }

  return (
    <div className="page">
      <div className="home-hero">
        <div>
          <div className="home-hello">Bonjour 👋</div>
          <h2>Votre activité</h2>
        </div>
        <button className="btn-primary" onClick={() => setPickOpen(true)}>
          + Nouvelle commande
        </button>
      </div>

      <div className="kpi-grid">
        <button className="kpi kpi-accent" onClick={() => navigate('/commandes')}>
          <div className="kpi-value">{stats.devis}</div>
          <div className="kpi-label">Devis en cours</div>
        </button>
        <div className="kpi">
          <div className="kpi-value">{stats.envoyee}</div>
          <div className="kpi-label">Envoyées</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{stats.confirmee}</div>
          <div className="kpi-label">Confirmées</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{stats.livree}</div>
          <div className="kpi-label">Livrées</div>
        </div>
      </div>

      <div className="ca-card">
        <div>
          <div className="ca-label">Chiffre d'affaires réalisé</div>
          <div className="ca-sub">Commandes confirmées et livrées</div>
        </div>
        <div className="ca-value">{formatEuro(stats.caRealise)}</div>
      </div>

      <h3 className="section-title" style={{ marginTop: 18 }}>Dernières commandes</h3>
      {loading ? (
        <div className="muted">Chargement…</div>
      ) : recent.length === 0 ? (
        <div className="empty">Aucune commande pour le moment.</div>
      ) : (
        <div className="list">
          {recent.map((o) => (
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
      )}

      {pickOpen && (
        <ClientPickerModal
          title="Nouvelle commande — pour quel client ?"
          onPick={startNewOrder}
          onClose={() => setPickOpen(false)}
        />
      )}
    </div>
  );
}
