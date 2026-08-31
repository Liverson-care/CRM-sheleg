import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useOrder } from '../order';
import { formatEuro } from '../util';
import ProductImage from '../components/ProductImage';
import type { Product } from '../types';

export default function Catalog() {
  const { draft, totals } = useOrder();
  const client = draft?.client ?? null;
  const lines = draft?.lines ?? [];
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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

  async function runExport(kind: 'pdf' | 'excel', withPrices: boolean) {
    setMenuOpen(false);
    const mod = await import('../export');
    if (kind === 'pdf') mod.exportPDF(filtered, { withPrices });
    else mod.exportExcel(filtered, { withPrices });
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Catalogue</h2>
        <div className="head-tools">
          <input
            className="search"
            placeholder="Rechercher (nom, code, code-barres)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="export-wrap" ref={menuRef}>
            <button className="btn-ghost btn-export" onClick={() => setMenuOpen((o) => !o)}>
              <ExportIcon /> Exporter
            </button>
            {menuOpen && (
              <div className="export-menu">
                <div className="export-menu-head">Format PDF</div>
                <button onClick={() => runExport('pdf', true)}>PDF · avec prix</button>
                <button onClick={() => runExport('pdf', false)}>PDF · sans prix</button>
                <div className="export-menu-head">Format Excel</div>
                <button onClick={() => runExport('excel', true)}>Excel · avec prix</button>
                <button onClick={() => runExport('excel', false)}>Excel · sans prix</button>
              </div>
            )}
          </div>
        </div>
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
            <button
              key={p.id}
              className={`product-card ${q > 0 ? 'in-cart' : ''}`}
              onClick={() => navigate(`/produit/${p.id}`)}
            >
              {q > 0 && <span className="cart-flag">×{q}</span>}
              <ProductImage product={p} size="card" />
              <div className="product-cat">{p.category}</div>
              <div className="product-name">{p.name}</div>
              {p.default_code && <span className="code">{p.default_code}</span>}
              <div className="price">{formatEuro(p.list_price)}</div>
            </button>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="empty">Aucun produit trouvé.</div>
        )}
      </div>

      {totals.count > 0 && (
        <button className="draft-bar" onClick={() => navigate('/devis')}>
          <span className="draft-bar-count">{totals.count}</span>
          <span className="draft-bar-label">Devis en cours</span>
          <span className="draft-bar-total">{formatEuro(totals.totalTTC)} TTC</span>
          <span className="draft-bar-go">Voir le devis →</span>
        </button>
      )}
    </div>
  );
}

function ExportIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M5 21h14" />
    </svg>
  );
}
