import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useOrder } from '../order';
import Logo from './Logo';

export default function Layout() {
  const { logout, user } = useAuth();
  const { devisList } = useOrder();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <span className="brand-name">Sheleg</span>
          <span className="brand-sub">CRM</span>
        </div>
        <button className="btn-ghost" onClick={handleLogout}>
          Déconnexion
        </button>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="tabbar">
        <NavLink to="/accueil" className="tab">
          <TabIcon name="home" />
          <span>Accueil</span>
        </NavLink>
        <NavLink to="/clients" className="tab">
          <TabIcon name="client" />
          <span>Clients</span>
        </NavLink>
        <NavLink to="/catalogue" className="tab">
          <TabIcon name="catalog" />
          <span>Catalogue</span>
        </NavLink>
        <NavLink to="/commandes" className="tab">
          <span className="tab-badge-wrap">
            <TabIcon name="orders" />
            {devisList.length > 0 && <span className="badge">{devisList.length}</span>}
          </span>
          <span>Commandes</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className="tab">
            <TabIcon name="admin" />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}

function TabIcon({ name }: { name: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
        </svg>
      );
    case 'client':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      );
    case 'catalog':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="9" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
          <path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L21 7H6" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...common}>
          <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v6h6M9 13h6M9 17h6" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.6C8 19.3 5 15.4 5 11V6l7-3z" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </svg>
      );
    default:
      return null;
  }
}
