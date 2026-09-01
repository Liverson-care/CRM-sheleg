import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatEuro, stockLevel, unitPrice, packSize } from '../util';
import ProductImage from '../components/ProductImage';
import type { Product } from '../types';

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <div className="page"><div className="muted">Chargement…</div></div>;
  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!product) return <div className="page"><div className="empty">Produit introuvable.</div></div>;

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
            <InfoRow label="Conditionnement" value={`${packSize(product)} pièces / colis`} />
            <InfoRow label="Prix du colis" value={formatEuro(product.list_price)} />
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
