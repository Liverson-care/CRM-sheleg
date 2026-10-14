import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatEuro, stockLevel, unitPrice, packSize } from '../util';
import ProductImage from '../components/ProductImage';
import type { Product } from '../types';

/** Formate un nombre en grammes (virgule française), ou '—'. */
function grams(n?: number | null): string {
  if (n == null) return '—';
  return `${String(n).replace('.', ',')} g`;
}

/** Dimensions du colis « l × H × P » en cm, ou '' si aucune renseignée. */
function formatDims(log?: Product['logistics']): string {
  if (!log) return '';
  const { largeurCm, hauteurCm, profondeurCm } = log;
  if (largeurCm == null && hauteurCm == null && profondeurCm == null) return '';
  const v = (x?: number | null) => (x == null ? '—' : String(x).replace('.', ','));
  return `${v(largeurCm)} × ${v(hauteurCm)} × ${v(profondeurCm)} cm`;
}

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api
      .getProduct(Number(id))
      .then(setProduct)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function exportPdf() {
    if (!product) return;
    setExporting(true);
    try {
      const { downloadProductPDF } = await import('../export');
      await downloadProductPDF(product);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="page"><div className="muted">Chargement…</div></div>;
  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!product) return <div className="page"><div className="empty">Produit introuvable.</div></div>;

  const n = product.nutrition;
  const lab = product.labeling;
  const log = product.logistics;
  const dims = formatDims(log);
  const hasLogistics =
    lab?.poidsNetGr != null ||
    lab?.poidsBrutGr != null ||
    !!dims ||
    log?.colisParPalette != null ||
    !!log?.hsCode;

  return (
    <div className="page">
      <div className="detail-back">
        <Link to="/catalogue" className="link">← Catalogue</Link>
      </div>

      <div className="product-detail">
        <ProductImage product={product} size="detail" />

        <div className="product-detail-info">
          <div className="product-cat">{product.category}</div>
          <h2>{product.name}</h2>
          <div className="price price-lg">
            {formatEuro(unitPrice(product))}<span className="price-unit"> / pièce</span>
          </div>

          {product.description && (
            <p className="product-desc">{product.description}</p>
          )}

          <div className="detail-card" style={{ marginTop: 4 }}>
            <InfoRow label="Référence" value={product.default_code || '—'} />
            <InfoRow label="Code-barres" value={product.barcode || '—'} />
            {lab?.marque && <InfoRow label="Marque" value={lab.marque} />}
            <InfoRow label="Conditionnement" value={`${packSize(product)} pièces / colis`} />
            <InfoRow label="Prix du colis" value={formatEuro(product.list_price)} />
            {product.vat != null && (
              <InfoRow label="TVA" value={`${String(product.vat).replace('.', ',')} %`} />
            )}
            {lab?.kosher && (
              <InfoRow
                label="Cacher"
                value={lab.kosher + (lab.kosherPassover ? ' · Pessah' : '')}
              />
            )}
            <div className="info-row">
              <span className="info-label">Stock disponible</span>
              <span className="info-value">
                <span className={`stock-pill stock-${stockLevel(product.qty_available).cls}`}>
                  {stockLevel(product.qty_available).label}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {hasLogistics && (
        <div className="detail-card">
          <h3 className="detail-card-title">Informations logistiques</h3>
          {lab?.poidsNetGr != null && <InfoRow label="Poids net" value={`${lab.poidsNetGr} g`} />}
          {lab?.poidsBrutGr != null && <InfoRow label="Poids brut" value={`${lab.poidsBrutGr} g`} />}
          {dims && <InfoRow label="Dimensions du colis (l × H × P)" value={dims} />}
          {log?.colisParPalette != null && (
            <InfoRow label="Colis par palette" value={String(log.colisParPalette)} />
          )}
          {log?.hsCode && <InfoRow label="Code SH" value={log.hsCode} />}
        </div>
      )}

      {lab?.ingredients && (
        <div className="detail-card">
          <h3 className="detail-card-title">Ingrédients</h3>
          <p className="product-desc" style={{ margin: 0 }}>{lab.ingredients}</p>
        </div>
      )}

      {lab?.allergenes && (
        <div className="detail-card">
          <h3 className="detail-card-title">Allergènes</h3>
          <p className="product-desc" style={{ margin: 0 }}>{lab.allergenes}</p>
        </div>
      )}

      {product.hasNutrition && n && (
        <div className="detail-card">
          <h3 className="detail-card-title">Valeurs nutritionnelles <span className="muted-inline">(pour 100 g)</span></h3>
          <table className="nutri-table">
            <tbody>
              <tr>
                <th>Énergie</th>
                <td>
                  {n.energieKj != null ? `${String(n.energieKj).replace('.', ',')} kJ` : '—'}
                  {n.energieKcal != null ? ` / ${String(n.energieKcal).replace('.', ',')} kcal` : ''}
                </td>
              </tr>
              <tr><th>Matières grasses</th><td>{grams(n.matieresGrasses)}</td></tr>
              <tr className="nutri-sub"><th>dont acides gras saturés</th><td>{grams(n.acidesGrasSsatures)}</td></tr>
              <tr><th>Glucides</th><td>{grams(n.glucides)}</td></tr>
              <tr className="nutri-sub"><th>dont sucres</th><td>{grams(n.sucres)}</td></tr>
              <tr><th>Protéines</th><td>{grams(n.proteines)}</td></tr>
              <tr><th>Sel</th><td>{grams(n.sel)}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="order-actions">
        <button className="btn-primary btn-block" onClick={exportPdf} disabled={exporting}>
          {exporting ? 'Préparation du PDF…' : 'Exporter la fiche produit (PDF)'}
        </button>
      </div>
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
