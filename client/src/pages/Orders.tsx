import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useOrder, computeTotals } from '../order';
import { formatEuro, formatDate, orderStatusLabel } from '../util';
import type { OrderSummary } from '../types';

export default function Orders() {
  const { devisList, openDevis, removeDevis } = useOrder();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function reopen(id: string) {
    openDevis(id);
    navigate('/devis');
  }

  const empty = !loading && devisList.length === 0 && orders.length === 0;

  return (
    <div className="page">
      <div className="page-head"><h2>Commandes</h2></div>

      {error && <div className="form-error">{error}</div>}

      {/* Devis (brouillons locaux, non envoyés à Odoo) */}
      {devisList.length > 0 && (
        <>
          <h3 className="section-title">
            Devis en attente <span className="count-badge">{devisList.length}</span>
          </h3>
          <div className="list">
            {devisList.map((d) => {
              const t = computeTotals(d);
              return (
                <div key={d.id} className="list-row">
                  <button className="list-main list-open" onClick={() => reopen(d.id)}>
                    <div className="list-title">
                      {d.client ? d.client.name : 'Client non défini'}
                    </div>
                    <div className="list-sub">
                      {t.count} article{t.count > 1 ? 's' : ''} · modifié le{' '}
                      {formatDate(new Date(d.updatedAt).toISOString())}
                    </div>
                  </button>
                  <div className="order-right">
                    <div className="order-total">{formatEuro(t.totalTTC)}</div>
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
              );
            })}
          </div>
        </>
      )}

      {/* Commandes envoyées / confirmées (Odoo) */}
      {orders.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: devisList.length ? 18 : 0 }}>
            Commandes envoyées
          </h3>
          <div className="list">
            {orders.map((o) => (
              <div key={o.id} className="list-row static">
                <div className="list-main">
                  <div className="list-title">
                    {o.reference} · {o.client}
                  </div>
                  <div className="list-sub">{formatDate(o.date)}</div>
                </div>
                <div className="order-right">
                  <div className="order-total">{formatEuro(o.total)}</div>
                  <span className={`state state-${o.status}`}>
                    {orderStatusLabel(o.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {loading && <div className="muted">Chargement…</div>}
      {empty && (
        <div className="empty">
          Aucune commande.{' '}
          <Link to="/catalogue" className="link">Créer une commande</Link>
        </div>
      )}
    </div>
  );
}
