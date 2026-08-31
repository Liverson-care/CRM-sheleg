import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatEuro, formatDate, orderStateLabel } from '../util';
import type { OrderSummary } from '../types';

export default function Orders() {
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

  return (
    <div className="page">
      <div className="page-head">
        <h2>Commandes</h2>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="muted">Chargement…</div>}

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
              <span className={`state state-${o.state}`}>
                {orderStateLabel(o.state)}
              </span>
            </div>
          </div>
        ))}
        {!loading && orders.length === 0 && (
          <div className="empty">
            Aucune commande.{' '}
            <Link to="/catalogue" className="link">
              Créer une commande
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
