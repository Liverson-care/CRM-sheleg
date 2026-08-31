import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../cart';
import { formatEuro } from '../util';

export default function Cart() {
  const { client, lines, note, setNote, setQty, removeProduct, total, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ reference: string } | null>(null);

  async function submit() {
    if (!client) {
      setError('Veuillez sélectionner un client avant de valider.');
      return;
    }
    if (lines.length === 0) {
      setError('Le panier est vide.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.createOrder({
        clientId: client.id,
        note,
        lines: lines.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          price: l.product.list_price,
          name: l.product.name,
        })),
      });
      setSuccess({ reference: res.reference });
      clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="page">
        <div className="success-card">
          <div className="success-check">✓</div>
          <h2>Commande envoyée à Odoo</h2>
          <p>
            Référence : <strong>{success.reference}</strong>
          </p>
          <div className="success-actions">
            <button className="btn-primary" onClick={() => navigate('/catalogue')}>
              Nouvelle commande
            </button>
            <button className="btn-ghost" onClick={() => navigate('/commandes')}>
              Voir les commandes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Panier</h2>
      </div>

      <div className="client-banner">
        {client ? (
          <>
            <span className="muted">Client</span>
            <strong>{client.name}</strong>
            <Link to="/clients" className="link">
              Changer
            </Link>
          </>
        ) : (
          <Link to="/clients" className="link">
            Sélectionner un client
          </Link>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="empty">
          Votre panier est vide.{' '}
          <Link to="/catalogue" className="link">
            Ajouter des produits
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-list">
            {lines.map((l) => (
              <div key={l.product.id} className="cart-line">
                <div className="cart-line-main">
                  <div className="list-title">{l.product.name}</div>
                  <div className="list-sub">
                    {formatEuro(l.product.list_price)} · {l.product.default_code}
                  </div>
                </div>
                <div className="stepper">
                  <button onClick={() => setQty(l.product.id, l.qty - 1)}>−</button>
                  <span>{l.qty}</span>
                  <button onClick={() => setQty(l.product.id, l.qty + 1)}>+</button>
                </div>
                <div className="cart-line-total">
                  {formatEuro(l.qty * l.product.list_price)}
                </div>
                <button
                  className="icon-remove"
                  onClick={() => removeProduct(l.product.id)}
                  aria-label="Supprimer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <label className="note-field">
            Note (facultatif)
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Instruction de livraison, remarque…"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="cart-footer">
            <div className="cart-total">
              <span>Total</span>
              <strong>{formatEuro(total)}</strong>
            </div>
            <button
              className="btn-primary btn-block"
              onClick={submit}
              disabled={submitting || !client}
            >
              {submitting ? 'Envoi à Odoo…' : 'Valider la commande'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
