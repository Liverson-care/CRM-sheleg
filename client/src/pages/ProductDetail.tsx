import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useOrder } from '../order';
import { formatEuro, stockLevel } from '../util';
import ProductImage from '../components/ProductImage';
import type { Product } from '../types';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { draft, addProduct, setQty } = useOrder();
  const lines = draft?.lines ?? [];

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

  const qty = lines.find((l) => l.product.id === product.id)?.qty ?? 0;

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
          <div className="price price-lg">{formatEuro(product.list_price)}</div>

          {product.description && (
            <p className="product-desc">{product.description}</p>
          )}

          <div className="detail-card" style={{ marginTop: 4 }}>
            <InfoRow label="Référence" value={product.default_code || '—'} />
            <InfoRow label="Code-barres" value={product.barcode || '—'} />
            <InfoRow label="Unité de vente" value={product.uom || '—'} />
            <div className="info-row">
              <span className="info-label">Stock disponible</span>
              <span className="info-value">
                <span className={`stock-pill stock-${stockLevel(product.qty_available).cls}`}>
                  {stockLevel(product.qty_available).label}
                </span>
              </span>
            </div>
          </div>

          {qty === 0 ? (
            <button className="btn-primary btn-block" onClick={() => addProduct(product)}>
              Ajouter au devis
            </button>
          ) : (
            <div className="detail-cart-row">
              <div className="stepper stepper-lg">
                <button onClick={() => setQty(product.id, qty - 1)}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty(product.id, qty + 1)}>+</button>
              </div>
              <button className="btn-ghost" onClick={() => navigate('/devis')}>
                Voir le devis
              </button>
            </div>
          )}
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
