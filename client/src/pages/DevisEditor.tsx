import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrder } from '../order';
import { formatEuro, unitPrice, packSize } from '../util';
import ClientPickerModal from '../components/ClientPickerModal';

export default function DevisEditor() {
  const { draft, totals, setQty, setClient, keepDraft, deleteCurrent } = useOrder();
  const navigate = useNavigate();
  const [askLeave, setAskLeave] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  const lines = draft?.lines ?? [];

  if (lines.length === 0) {
    return (
      <div className="page">
        <div className="page-head"><h2>Devis en cours</h2></div>
        <div className="empty">
          Aucun devis en cours.{' '}
          <Link to="/commandes" className="link">Créer une commande</Link>
        </div>
      </div>
    );
  }

  function keep() {
    setAskLeave(false);
    keepDraft();
    navigate('/commandes');
  }

  function drop() {
    setAskLeave(false);
    deleteCurrent();
    navigate('/commandes');
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Devis en cours</h2>
        <button className="btn-ghost" onClick={() => setAskLeave(true)}>Quitter</button>
      </div>

      <div className="client-banner">
        {draft?.client ? (
          <>
            <span className="muted">Client</span>
            <strong>{draft.client.name}</strong>
            <button className="link" onClick={() => setPickOpen(true)}>Changer</button>
          </>
        ) : (
          <button className="link" onClick={() => setPickOpen(true)}>Sélectionner un client</button>
        )}
      </div>

      <div className="cart-list">
        {lines.map((l) => (
          <div key={l.product.id} className="cart-line">
            <div className="cart-line-main">
              <div className="list-title">{l.product.name}</div>
              <div className="list-sub">
                {formatEuro(unitPrice(l.product))} / pièce · {packSize(l.product)} pcs/colis
              </div>
              <div className="list-sub">
                {l.qty} colis = {l.qty * packSize(l.product)} pièces
              </div>
            </div>
            <div className="stepper">
              <button onClick={() => setQty(l.product.id, l.qty - 1)}>−</button>
              <span>{l.qty}</span>
              <button onClick={() => setQty(l.product.id, l.qty + 1)}>+</button>
            </div>
            <div className="cart-line-total">
              {formatEuro(l.qty * l.product.list_price)}
              <span className="ht-tag">HT</span>
            </div>
            <button
              className="icon-remove"
              onClick={() => setQty(l.product.id, 0)}
              aria-label="Supprimer"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        className="btn-ghost btn-block btn-add-products"
        onClick={() => navigate('/commande/produits')}
      >
        + Ajouter des produits
      </button>

      <div className="cart-footer">
        <div className="cart-total">
          <span>Total HT</span>
          <strong>{formatEuro(totals.totalHT)}</strong>
        </div>
        <button
          className="btn-primary btn-block"
          onClick={() => navigate('/devis/confirmation')}
        >
          Confirmer la commande
        </button>
      </div>

      {askLeave && (
        <div className="modal-overlay" onClick={() => setAskLeave(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Que faire de ce devis ?</h3>
            <p className="muted">
              Vous pouvez le conserver pour y revenir plus tard (onglet Commandes),
              ou le supprimer.
            </p>
            <div className="modal-actions">
              <button className="btn-primary btn-block" onClick={keep}>
                Garder en devis
              </button>
              <button className="btn-danger btn-block" onClick={drop}>
                Supprimer le devis
              </button>
              <button className="btn-ghost btn-block" onClick={() => setAskLeave(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {pickOpen && (
        <ClientPickerModal
          title="Changer le client du devis"
          onPick={(c) => {
            setClient(c);
            setPickOpen(false);
          }}
          onClose={() => setPickOpen(false)}
        />
      )}
    </div>
  );
}
