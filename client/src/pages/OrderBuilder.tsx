import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useOrder } from '../order';
import { formatEuro, stockLevel } from '../util';
import ProductImage from '../components/ProductImage';
import type { Product } from '../types';

export default function OrderBuilder() {
  const { draft, totals, addProduct, setQty } = useOrder();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Une commande se construit uniquement pour un client.
  useEffect(() => {
    if (!draft?.client) navigate('/commandes', { replace: true });
  }, [draft?.client, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api
        .getProducts(search)
        .then(setProducts)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['Tous', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(
    () => (category === 'Tous' ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  function qty(id: number) {
    return draft?.lines.find((l) => l.product.id === id)?.qty ?? 0;
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Nouvelle commande</h2>
        <input
          className="search"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="client-banner">
        <span className="muted">Commande pour</span>
        <strong>{draft?.client?.name}</strong>
        <Link to="/commandes" className="link">Changer</Link>
      </div>

      <div className="chips">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="muted">Chargement…</div>}

      <div className="product-list">
        {filtered.map((p) => {
          const q = qty(p.id);
          const st = stockLevel(p.qty_available);
          return (
            <div key={p.id} className={`product-row ${q > 0 ? 'in-cart' : ''}`}>
              <button
                className="product-row-tap"
                onClick={() => navigate(`/produit/${p.id}`)}
                aria-label={`Voir ${p.name}`}
              >
                <ProductImage product={p} size="thumb" />
                <div className="product-row-main">
                  <div className="product-name">{p.name}</div>
                  <div className="list-sub">
                    {formatEuro(p.list_price)} / colis
                    {p.default_code ? ` · ${p.default_code}` : ''}
                  </div>
                  <span className={`stock-pill stock-${st.cls}`}>{st.label}</span>
                </div>
              </button>
              <div className="order-add">
                {q === 0 ? (
                  <button className="btn-add-round" onClick={() => addProduct(p)} aria-label="Ajouter un colis">
                    +
                  </button>
                ) : (
                  <div className="stepper">
                    <button onClick={() => setQty(p.id, q - 1)}>−</button>
                    <span>{q}</span>
                    <button onClick={() => setQty(p.id, q + 1)}>+</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="empty">Aucun produit trouvé.</div>
        )}
      </div>

      {totals.count > 0 && (
        <button className="draft-bar" onClick={() => navigate('/devis')}>
          <span className="draft-bar-count">{totals.count}</span>
          <span className="draft-bar-label">{totals.count > 1 ? 'colis' : 'colis'} au devis</span>
          <span className="draft-bar-total">{formatEuro(totals.totalTTC)} TTC</span>
          <span className="draft-bar-go">Voir le devis →</span>
        </button>
      )}
    </div>
  );
}
