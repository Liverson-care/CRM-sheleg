import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import OrderBuilder from './pages/OrderBuilder';
import DevisEditor from './pages/DevisEditor';
import Confirmation from './pages/Confirmation';
import Orders from './pages/Orders';
import OrderDetailPage from './pages/OrderDetail';
import Admin from './pages/Admin';

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <div className="boot-screen">Chargement…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/accueil" replace />} />
        <Route path="/accueil" element={<Home />} />
        {user.role === 'admin' && <Route path="/admin" element={<Admin />} />}
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/catalogue" element={<Catalog />} />
        <Route path="/produit/:id" element={<ProductDetail />} />
        <Route path="/commande/produits" element={<OrderBuilder />} />
        <Route path="/devis" element={<DevisEditor />} />
        <Route path="/devis/confirmation" element={<Confirmation />} />
        <Route path="/commandes" element={<Orders />} />
        <Route path="/commande/:id" element={<OrderDetailPage />} />
        <Route path="*" element={<Navigate to="/accueil" replace />} />
      </Route>
    </Routes>
  );
}
