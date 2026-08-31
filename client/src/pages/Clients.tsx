import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../cart';
import type { Client } from '../types';

export default function Clients() {
  const { client, setClient } = useCart();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api
        .getClients(search)
        .then(setClients)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function choose(c: Client) {
    setClient(c);
    navigate('/catalogue');
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Clients</h2>
        <input
          className="search"
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="muted">Chargement…</div>}

      <div className="list">
        {clients.map((c) => (
          <button
            key={c.id}
            className={`list-row ${client?.id === c.id ? 'selected' : ''}`}
            onClick={() => choose(c)}
          >
            <div className="avatar">{c.name.charAt(0).toUpperCase()}</div>
            <div className="list-main">
              <div className="list-title">{c.name}</div>
              <div className="list-sub">
                {[c.zip, c.city].filter(Boolean).join(' ')}
                {c.phone ? ` · ${c.phone}` : ''}
              </div>
            </div>
            {client?.id === c.id && <span className="pill">Sélectionné</span>}
          </button>
        ))}
        {!loading && clients.length === 0 && (
          <div className="empty">Aucun client trouvé.</div>
        )}
      </div>
    </div>
  );
}
