import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AppUser } from '../types';

const EMPTY = { name: '', username: '', password: '', role: 'commercial' as const, odooCommercial: '' };

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [edit, setEdit] = useState<AppUser | null>(null);
  const [newPass, setNewPass] = useState('');

  function reload() {
    setLoading(true);
    api.getUsers().then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function submitCreate() {
    setError('');
    try {
      await api.createUser(form);
      setForm({ ...EMPTY });
      setCreateOpen(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setError('');
    try {
      await api.updateUser(edit.id, {
        name: edit.name,
        role: edit.role,
        odooCommercial: edit.odooCommercial || '',
        active: edit.active,
        ...(newPass ? { password: newPass } : {}),
      });
      setEdit(null);
      setNewPass('');
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function remove(u: AppUser) {
    if (!confirm(`Supprimer l'utilisateur ${u.name} ?`)) return;
    setError('');
    try {
      await api.deleteUser(u.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Administration</h2>
        <button className="btn-primary btn-new-order" onClick={() => setCreateOpen(true)}>
          + Nouvel utilisateur
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 14 }}>
        Connecté en tant que <strong>{user?.name}</strong> (administrateur). Gérez ici les
        comptes, rôles et mots de passe des commerciaux.
      </p>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="muted">Chargement…</div>}

      <div className="list">
        {users.map((u) => (
          <div key={u.id} className={`list-row ${u.active === false ? 'row-inactive' : ''}`}>
            <div className="avatar">{u.name.charAt(0).toUpperCase()}</div>
            <div className="list-main">
              <div className="list-title">
                {u.name}{' '}
                <span className={`role-tag role-${u.role}`}>
                  {u.role === 'admin' ? 'Admin' : 'Commercial'}
                </span>
                {u.active === false && <span className="role-tag role-off">Désactivé</span>}
              </div>
              <div className="list-sub">
                identifiant : {u.username}
                {u.odooCommercial ? ` · Odoo : ${u.odooCommercial}` : ''}
              </div>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => { setEdit({ ...u }); setNewPass(''); }}>
              Modifier
            </button>
            <button className="icon-remove" onClick={() => remove(u)} aria-label="Supprimer">×</button>
          </div>
        ))}
      </div>

      {/* Création */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nouvel utilisateur</h3>
            <label className="field">Nom affiché
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. David L" />
            </label>
            <label className="field">Identifiant de connexion
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ex. david" />
            </label>
            <label className="field">Mot de passe
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <label className="field">Rôle
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'commercial' })}>
                <option value="commercial">Commercial</option>
                <option value="admin">Administrateur</option>
              </select>
            </label>
            <label className="field">Commercial Odoo (facultatif)
              <input value={form.odooCommercial} onChange={(e) => setForm({ ...form, odooCommercial: e.target.value })} placeholder="ex. Yona Halimi" />
            </label>
            <div className="modal-actions">
              <button className="btn-primary btn-block" onClick={submitCreate}>Créer</button>
              <button className="btn-ghost btn-block" onClick={() => setCreateOpen(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Édition */}
      {edit && (
        <div className="modal-overlay" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier {edit.name}</h3>
            <label className="field">Nom affiché
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="field">Rôle
              <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as 'commercial' | 'admin' })}>
                <option value="commercial">Commercial</option>
                <option value="admin">Administrateur</option>
              </select>
            </label>
            <label className="field">Commercial Odoo
              <input value={edit.odooCommercial || ''} onChange={(e) => setEdit({ ...edit, odooCommercial: e.target.value })} placeholder="ex. Yona Halimi" />
            </label>
            <label className="field">Nouveau mot de passe (laisser vide pour ne pas changer)
              <input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </label>
            <label className="check-line">
              <input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Compte actif
            </label>
            <div className="modal-actions">
              <button className="btn-primary btn-block" onClick={saveEdit}>Enregistrer</button>
              <button className="btn-ghost btn-block" onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
