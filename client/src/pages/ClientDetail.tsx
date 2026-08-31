import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../cart';
import { formatEuro, formatDate, orderStateLabel } from '../util';
import type { Client, OrderSummary } from '../types';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setClient } = useCart();

  const [client, setLocalClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([api.getClient(Number(id)), api.getOrders(Number(id))])
      .then(([c, o]) => {
        setLocalClient(c);
        setOrders(o);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function startOrder() {
    if (!client) return;
    setClient(client);
    navigate('/catalogue');
  }

  if (loading) return <div className="page"><div className="muted">Chargement…</div></div>;
  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!client) return <div className="page"><div className="empty">Client introuvable.</div></div>;

  const addressLines = [
    client.street,
    [client.zip, client.city].filter(Boolean).join(' '),
  ].filter(Boolean);

  return (
    <div className="page">
      <div className="detail-back">
        <Link to="/clients" className="link">← Clients</Link>
      </div>

      {/* En-tête client */}
      <div className="detail-head">
        <div className="avatar avatar-lg">{client.name.charAt(0).toUpperCase()}</div>
        <div>
          <h2>{client.name}</h2>
          <div className="list-sub">
            {[client.zip, client.city].filter(Boolean).join(' ') || 'Adresse non renseignée'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="detail-actions">
        <button className="action action-primary" onClick={startOrder}>
          <ActionIcon name="order" />
          <span>Passer commande</span>
        </button>
        <a
          className={`action ${client.email ? '' : 'action-disabled'}`}
          href={client.email ? `mailto:${client.email}` : undefined}
        >
          <ActionIcon name="mail" />
          <span>Envoyer un mail</span>
        </a>
        <a
          className={`action ${client.phone ? '' : 'action-disabled'}`}
          href={client.phone ? `tel:${client.phone.replace(/\s+/g, '')}` : undefined}
        >
          <ActionIcon name="phone" />
          <span>Appeler</span>
        </a>
        <a className="action" href="#historique">
          <ActionIcon name="history" />
          <span>Historique</span>
        </a>
      </div>

      {/* Coordonnées */}
      <div className="detail-card">
        <h3 className="detail-card-title">Coordonnées</h3>
        <InfoRow label="Adresse" value={addressLines.length ? addressLines.join(', ') : '—'} />
        <InfoRow
          label="E-mail"
          value={
            client.email ? (
              <a className="link" href={`mailto:${client.email}`}>{client.email}</a>
            ) : (
              '—'
            )
          }
        />
        <InfoRow
          label="Téléphone"
          value={
            client.phone ? (
              <a className="link" href={`tel:${client.phone.replace(/\s+/g, '')}`}>{client.phone}</a>
            ) : (
              '—'
            )
          }
        />
        <InfoRow label="Réf. Odoo" value={`#${client.id}`} />
      </div>

      {/* Historique de ses commandes */}
      <div className="detail-card" id="historique">
        <h3 className="detail-card-title">
          Historique des commandes
          <span className="count-badge">{orders.length}</span>
        </h3>
        {orders.length === 0 ? (
          <div className="muted" style={{ padding: '6px 2px' }}>
            Aucune commande pour ce client.
          </div>
        ) : (
          <div className="list">
            {orders.map((o) => (
              <div key={o.id} className="list-row static">
                <div className="list-main">
                  <div className="list-title">{o.reference}</div>
                  <div className="list-sub">{formatDate(o.date)}</div>
                </div>
                <div className="order-right">
                  <div className="order-total">{formatEuro(o.total)}</div>
                  <span className={`state state-${o.state}`}>{orderStateLabel(o.state)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn-primary btn-block detail-cta" onClick={startOrder}>
        Passer une commande pour {client.name}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

function ActionIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'order':
      return (
        <svg {...common}>
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
          <path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L21 7H6" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 4v4h4M12 8v4l3 2" />
        </svg>
      );
    default:
      return null;
  }
}
