import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatEuro, stockLevel, unitPrice, packSize } from '../util';
import ProductImage from '../components/ProductImage';
import ClientPickerModal from '../components/ClientPickerModal';
import type { Product, Client } from '../types';

const VIEW_KEY = 'sheleg.catalogView';

export default function Catalog() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [withPrices, setWithPrices] = useState(true);
  const [emailPickOpen, setEmailPickOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as 'grid' | 'list') || 'grid';
    } catch {
      return 'grid';
    }
  });

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

  function chooseView(v: 'grid' | 'list') {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['Tous', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(
    () => (category === 'Tous' ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  async function saveCatalogue(kind: 'pdf' | 'excel') {
    const mod = await import('../export');
    if (kind === 'pdf') mod.exportPDF(filtered, { withPrices });
    else mod.exportExcel(filtered, { withPrices });
  }

  async function sendCatalogue(client: Client) {
    setEmailPickOpen(false);
    setPreviewOpen(false);
    const mod = await import('../export');
    await mod.shareCataloguePDF(filtered, { withPrices }, client.email ? [client.email] : []);
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
          <div className="view-toggle" role="group" aria-label="Affichage">
            <button
              className={view === 'grid' ? 'on' : ''}
              onClick={() => chooseView('grid')}
              aria-label="Grille"
              title="Grille"
            >
              <GridIcon />
            </button>
            <button
              className={view === 'list' ? 'on' : ''}
              onClick={() => chooseView('list')}
              aria-label="Liste"
              title="Liste"
            >
              <ListIcon />
            </button>
          </div>
          <button className="btn-ghost btn-export" onClick={() => setPreviewOpen(true)}>
            <ExportIcon /> Catalogue
          </button>
        </div>
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

      {view === 'grid' ? (
        <div className="product-grid">
          {filtered.map((p) => {
            const st = stockLevel(p.qty_available);
            return (
              <button
                key={p.id}
                className="product-card"
                onClick={() => navigate(`/produit/${p.id}`)}
              >
                <ProductImage product={p} size="card" />
                <div className="product-cat">{p.category}</div>
                <div className="product-name">{p.name}</div>
                {p.default_code && <span className="code">{p.default_code}</span>}
                <div className="product-foot-row">
                  <div className="price">{formatEuro(unitPrice(p))}<span className="price-unit"> /pièce</span></div>
                  <span className={`stock-dot stock-${st.cls}`} title={st.label} />
                </div>
              </button>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="empty">Aucun produit trouvé.</div>
          )}
        </div>
      ) : (
        <div className="product-list">
          {filtered.map((p) => {
            const st = stockLevel(p.qty_available);
            return (
              <button
                key={p.id}
                className="product-row"
                onClick={() => navigate(`/produit/${p.id}`)}
              >
                <ProductImage product={p} size="thumb" />
                <div className="product-row-main">
                  <div className="product-name">{p.name}</div>
                  <div className="list-sub">
                    {p.category}
                    {p.default_code ? ` · ${p.default_code}` : ''}
                  </div>
                  <span className={`stock-pill stock-${st.cls}`}>{st.label}</span>
                </div>
                <div className="product-row-right">
                  <div className="price">{formatEuro(unitPrice(p))}<span className="price-unit"> /pièce</span></div>
                  <span className="code">{packSize(p)} pcs/colis</span>
                </div>
              </button>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="empty">Aucun produit trouvé.</div>
          )}
        </div>
      )}

      {previewOpen && (
        <div className="modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="modal modal-preview" onClick={(e) => e.stopPropagation()}>
            <div className="preview-head">
              <h3>Aperçu du catalogue</h3>
              <label className="toggle-prices">
                <input
                  type="checkbox"
                  checked={withPrices}
                  onChange={(e) => setWithPrices(e.target.checked)}
                />
                Afficher les prix
              </label>
            </div>

            <div className="preview-body">
              {filtered.map((p) => (
                <div key={p.id} className="preview-row">
                  <ProductImage product={p} size="thumb" />
                  <div className="preview-row-main">
                    <div className="product-name">{p.name}</div>
                    <div className="list-sub">
                      {p.default_code} · {packSize(p)} pcs/colis
                    </div>
                  </div>
                  {withPrices && (
                    <div className="preview-price">{formatEuro(unitPrice(p))}<span> /pièce</span></div>
                  )}
                </div>
              ))}
            </div>

            <div className="preview-actions">
              <button className="btn-primary" onClick={() => setEmailPickOpen(true)}>
                Envoyer par e-mail
              </button>
              <button className="btn-ghost" onClick={() => saveCatalogue('pdf')}>
                Enregistrer PDF
              </button>
              <button className="btn-ghost" onClick={() => saveCatalogue('excel')}>
                Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {emailPickOpen && (
        <ClientPickerModal
          title="Envoyer le catalogue à…"
          onPick={sendCatalogue}
          onClose={() => setEmailPickOpen(false)}
        />
      )}
    </div>
  );
}

function ExportIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M5 21h14" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
