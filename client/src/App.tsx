import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import OrderBuilder from './pages/OrderBuilder';
import DevisEditor from './pages/DevisEditor';
import Confirmation from './pages/Confirmation';
import Orders from './pages/Orders';
import OrderDetailPage from './pages/OrderDetail';

export default function App() {
  const { user } = useAuth();

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
        <Route path="/" element={<Navigate to="/catalogue" replace />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/catalogue" element={<Catalog />} />
        <Route path="/produit/:id" element={<ProductDetail />} />
        <Route path="/commande/produits" element={<OrderBuilder />} />
        <Route path="/devis" element={<DevisEditor />} />
        <Route path="/devis/confirmation" element={<Confirmation />} />
        <Route path="/commandes" element={<Orders />} />
        <Route path="/commande/:id" element={<OrderDetailPage />} />
        <Route path="*" element={<Navigate to="/catalogue" replace />} />
      </Route>
    </Routes>
  );
}
