import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Client } from '../types';

/** Modale de sélection d'un client (recherche incluse). */
export default function ClientPickerModal({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (client: Client) => void;
  onClose: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getClients().then(setClients).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? clients.filter((c) => c.name.toLowerCase().includes(s)) : clients;
  }, [clients, search]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <input
          className="search"
          style={{ maxWidth: 'none', width: '100%', marginBottom: 10 }}
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="pick-list">
          {filtered.map((c) => (
            <button key={c.id} className="pick-row" onClick={() => onPick(c)}>
              <div className="avatar">{c.name.charAt(0).toUpperCase()}</div>
              <div className="list-main">
                <div className="list-title">{c.name}</div>
                <div className="list-sub">{[c.zip, c.city].filter(Boolean).join(' ')}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="muted">Aucun client.</div>}
        </div>
        <button className="btn-ghost btn-block" onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}
