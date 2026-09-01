import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useOrder } from '../order';
import { formatEuro, formatDate, orderStatusLabel } from '../util';
import type { OrderDetail, Client } from '../types';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { duplicateToDraft } = useOrder();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);

  const [pickOpen, setPickOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getOrder(id)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (pickOpen && clients.length === 0) {
      api.getClients().then(setClients).catch(() => {});
    }
  }, [pickOpen, clients.length]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    return s ? clients.filter((c) => c.name.toLowerCase().includes(s)) : clients;
  }, [clients, clientSearch]);

  async function emailPdf() {
    if (!order) return;
    setSharing(true);
    try {
      // Pré-remplit l'e-mail du client pour le repli mailto.
      let clientEmails: string[] = [];
      if (order.clientId) {
        try {
          const c = await api.getClient(order.clientId);
          clientEmails = c.email ? [c.email] : [];
        } catch {
          clientEmails = [];
        }
      }
      const { shareOrderPDF } = await import('../export');
      await shareOrderPDF(order, clientEmails);
    } finally {
      setSharing(false);
    }
  }

  function duplicate(client: Client) {
    if (!order) return;
    duplicateToDraft(order, client);
    setPickOpen(false);
    navigate('/devis');
  }

  if (loading) return <div className="page"><div className="muted">Chargement…</div></div>;
  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!order) return <div className="page"><div className="empty">Commande introuvable.</div></div>;

  return (
    <div className="page">
      <div className="detail-back">
        <Link to="/commandes" className="link">← Commandes</Link>
      </div>

      <div className="page-head">
        <h2>{order.reference}</h2>
        <span className={`state state-${order.status}`}>{orderStatusLabel(order.status)}</span>
      </div>

      <div className="detail-card">
        <InfoRow label="Client" value={order.client} />
        <InfoRow label="Date" value={formatDate(order.date)} />
        {order.deliveryDate && <InfoRow label="Livraison" value={order.deliveryDate} />}
        {order.comment && <InfoRow label="Commentaire" value={order.comment} />}
      </div>

      <div className="detail-card">
        <h3 className="detail-card-title">Lignes</h3>
        <div className="conf-lines">
          {order.lines.map((l, i) => (
            <div key={i} className="conf-line">
              <div className="conf-line-main">
                <div className="list-title">{l.name}</div>
                <div className="list-sub">
                  {formatEuro(l.unitPrice ?? l.price / (l.packSize || 1))} / pièce
                  {l.packSize && l.packSize > 1 ? ` · ${l.packSize} pcs/colis` : ''}
                  {l.discount ? ` · remise ${l.discount}%` : ''}
                </div>
                <div className="list-sub">
                  {l.qty} colis{l.packSize && l.packSize > 1 ? ` = ${l.qty * l.packSize} pièces` : ''}
                </div>
              </div>
              <div className="cart-line-total">{formatEuro(l.totalHT)}</div>
            </div>
          ))}
        </div>
        <div className="totals" style={{ marginTop: 12 }}>
          <div className="totals-row"><span>Total HT</span><span>{formatEuro(order.totalHT)}</span></div>
          <div className="totals-row"><span>TVA</span><span>{formatEuro(order.totalTVA)}</span></div>
          <div className="totals-row totals-ttc"><span>Total TTC</span><span>{formatEuro(order.totalTTC)}</span></div>
        </div>
      </div>

      <div className="order-actions">
        <button className="btn-primary btn-block" onClick={emailPdf} disabled={sharing}>
          {sharing ? 'Préparation du PDF…' : 'Envoyer au client (PDF)'}
        </button>
        <button className="btn-ghost btn-block" onClick={() => setPickOpen(true)}>
          Dupliquer sur un autre client
        </button>
      </div>

      {pickOpen && (
        <div className="modal-overlay" onClick={() => setPickOpen(false)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <h3>Dupliquer vers…</h3>
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
                <button key={c.id} className="pick-row" onClick={() => duplicate(c)}>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}
