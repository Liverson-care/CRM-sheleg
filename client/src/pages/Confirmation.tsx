import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrder, computeTotals } from '../order';
import { formatEuro } from '../util';
import type { Draft } from '../types';

export default function Confirmation() {
  const {
    draft,
    totals,
    setLineDiscount,
    setGlobalDiscount,
    setDeliveryDate,
    setComment,
    send,
  } = useOrder();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ ref: string; snapshot: Draft } | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  if (!draft || draft.lines.length === 0) {
    return (
      <div className="page">
        <div className="page-head"><h2>Confirmation</h2></div>
        <div className="empty">
          Aucun devis à confirmer.{' '}
          <Link to="/catalogue" className="link">Retour au catalogue</Link>
        </div>
      </div>
    );
  }

  async function submit() {
    if (!draft) return;
    if (!draft.client) {
      setError('Veuillez sélectionner un client avant d’envoyer.');
      return;
    }
    setSubmitting(true);
    setError('');
    const snapshot = draft; // capture avant l'envoi (send() vide le devis)
    try {
      const res = await send();
      setSent({ ref: res.reference, snapshot });
      setSelectedEmails(snapshot.client?.email ? [snapshot.client.email] : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Écran de succès + envoi e-mail depuis la tablette -----
  if (sent) {
    const t = computeTotals(sent.snapshot);
    const emails = Array.from(
      new Set([sent.snapshot.client?.email].filter(Boolean) as string[])
    );

    function toggleEmail(e: string) {
      setSelectedEmails((cur) =>
        cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]
      );
    }

    function mailtoHref() {
      const s = sent!.snapshot;
      const subject = `Commande Sheleg ${sent!.ref}`;
      const body = [
        'Bonjour,',
        '',
        `Veuillez trouver le récapitulatif de votre commande ${sent!.ref} :`,
        '',
        ...s.lines.map(
          (l) => `- ${l.qty} x ${l.product.name} — ${formatEuro(l.product.list_price)}`
        ),
        '',
        `Total HT : ${formatEuro(t.totalHT)}`,
        `TVA : ${formatEuro(t.totalTVA)}`,
        `Total TTC : ${formatEuro(t.totalTTC)}`,
        s.deliveryDate ? `Livraison souhaitée : ${s.deliveryDate}` : '',
        s.comment ? `Commentaire : ${s.comment}` : '',
        '',
        'Cordialement,',
        'Sheleg',
      ]
        .filter((line) => line !== null)
        .join('\n');
      return `mailto:${selectedEmails.join(',')}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
    }

    return (
      <div className="page">
        <div className="success-card">
          <div className="success-check">✓</div>
          <h2>Commande envoyée à Odoo</h2>
          <p className="muted">
            Référence : <strong style={{ color: 'var(--sheleg-900)' }}>{sent.ref}</strong> ·{' '}
            {formatEuro(t.totalTTC)} TTC
          </p>
          <p className="muted" style={{ marginTop: 4 }}>
            Statut : <span className="state state-envoyee">Envoyée</span> — passera en
            « Confirmée » une fois validée dans Odoo.
          </p>
        </div>

        <div className="detail-card" style={{ marginTop: 14 }}>
          <h3 className="detail-card-title">Envoyer par e-mail au client</h3>
          {emails.length === 0 ? (
            <div className="muted">Aucune adresse e-mail connue pour ce client.</div>
          ) : (
            <>
              <div className="email-list">
                {emails.map((e) => (
                  <label key={e} className="email-item">
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(e)}
                      onChange={() => toggleEmail(e)}
                    />
                    <span>{e}</span>
                  </label>
                ))}
              </div>
              <a
                className={`btn-primary btn-block ${
                  selectedEmails.length === 0 ? 'btn-disabled' : ''
                }`}
                href={selectedEmails.length ? mailtoHref() : undefined}
              >
                Ouvrir l’e-mail sur la tablette
              </a>
            </>
          )}
        </div>

        <div className="success-actions" style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={() => navigate('/catalogue')}>
            Nouvelle commande
          </button>
          <button className="btn-ghost" onClick={() => navigate('/commandes')}>
            Voir les commandes
          </button>
        </div>
      </div>
    );
  }

  // ----- Formulaire de confirmation -----
  function lineNet(price: number, qty: number, lineDiscount: number) {
    const combined = 1 - (1 - lineDiscount / 100) * (1 - draft!.globalDiscount / 100);
    return qty * price * (1 - combined);
  }

  return (
    <div className="page">
      <div className="detail-back">
        <Link to="/devis" className="link">← Devis</Link>
      </div>
      <div className="page-head"><h2>Confirmer la commande</h2></div>

      <div className="client-banner">
        {draft.client ? (
          <>
            <span className="muted">Client</span>
            <strong>{draft.client.name}</strong>
            <Link to="/clients" className="link">Changer</Link>
          </>
        ) : (
          <Link to="/clients" className="link">Sélectionner un client</Link>
        )}
      </div>

      {/* Livraison + commentaire */}
      <div className="detail-card">
        <h3 className="detail-card-title">Livraison</h3>
        <label className="field">
          Date de livraison souhaitée
          <input
            type="date"
            value={draft.deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          Commentaire (facultatif)
          <textarea
            rows={2}
            value={draft.comment}
            placeholder="Instruction de livraison, remarque…"
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
      </div>

      {/* Remises par produit */}
      <div className="detail-card">
        <h3 className="detail-card-title">Remises par produit</h3>
        <div className="conf-lines">
          {draft.lines.map((l) => (
            <div key={l.product.id} className="conf-line">
              <div className="conf-line-main">
                <div className="list-title">{l.product.name}</div>
                <div className="list-sub">
                  {l.qty} × {formatEuro(l.product.list_price)} · TVA {l.product.vat ?? 20}%
                </div>
              </div>
              <div className="conf-remise">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={l.discount || ''}
                  placeholder="0"
                  onChange={(e) => setLineDiscount(l.product.id, Number(e.target.value))}
                />
                <span>%</span>
              </div>
              <div className="cart-line-total">
                {formatEuro(lineNet(l.product.list_price, l.qty, l.discount))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Remise globale + totaux */}
      <div className="detail-card">
        <div className="conf-global">
          <span>Remise globale sur la commande</span>
          <div className="conf-remise">
            <input
              type="number"
              min={0}
              max={100}
              value={draft.globalDiscount || ''}
              placeholder="0"
              onChange={(e) => setGlobalDiscount(Number(e.target.value))}
            />
            <span>%</span>
          </div>
        </div>

        <div className="totals">
          <div className="totals-row">
            <span>Total brut HT</span>
            <span>{formatEuro(totals.grossHT)}</span>
          </div>
          {totals.discount > 0.001 && (
            <div className="totals-row totals-discount">
              <span>Remises</span>
              <span>− {formatEuro(totals.discount)}</span>
            </div>
          )}
          <div className="totals-row">
            <span>Total HT</span>
            <span>{formatEuro(totals.totalHT)}</span>
          </div>
          <div className="totals-row">
            <span>TVA</span>
            <span>{formatEuro(totals.totalTVA)}</span>
          </div>
          <div className="totals-row totals-ttc">
            <span>Total TTC</span>
            <span>{formatEuro(totals.totalTTC)}</span>
          </div>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="btn-primary btn-block btn-send"
        onClick={submit}
        disabled={submitting}
      >
        {submitting ? 'Envoi à Odoo…' : 'Envoyer la commande'}
      </button>
    </div>
  );
}
