import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../cart';
import { formatEuro } from '../util';
import type { Product } from '../types';

export default function Catalog() {
  const { client, lines, addProduct, setQty } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  function qtyInCart(id: number) {
    return lines.find((l) => l.product.id === id)?.qty ?? 0;
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Catalogue</h2>
        <input
          className="search"
          placeholder="Rechercher (nom, code, code-barres)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="client-banner">
        {client ? (
          <>
            <span className="muted">Commande pour</span>
            <strong>{client.name}</strong>
            <Link to="/clients" className="link">
              Changer
            </Link>
          </>
        ) : (
          <>
            <span className="muted">Aucun client sélectionné.</span>
            <Link to="/clients" className="link">
              Choisir un client
            </Link>
          </>
        )}
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

      <div className="product-grid">
        {filtered.map((p) => {
          const q = qtyInCart(p.id);
          return (
            <div key={p.id} className={`product-card ${q > 0 ? 'in-cart' : ''}`}>
              <div className="product-cat">{p.category}</div>
              <div className="product-name">{p.name}</div>
              <div className="product-meta">
                {p.default_code && <span className="code">{p.default_code}</span>}
              </div>
              <div className="product-foot">
                <div className="price">{formatEuro(p.list_price)}</div>
                {q === 0 ? (
                  <button className="btn-primary btn-add" onClick={() => addProduct(p)}>
                    Ajouter
                  </button>
                ) : (
                  <div className="stepper">
                    <button onClick={() => setQty(p.id, q - 1)} aria-label="Retirer un">
                      −
                    </button>
                    <span>{q}</span>
                    <button onClick={() => setQty(p.id, q + 1)} aria-label="Ajouter un">
                      +
                    </button>
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
    </div>
  );
}
