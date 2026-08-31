import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Clients from './pages/Clients';
import Catalog from './pages/Catalog';
import Cart from './pages/Cart';
import Orders from './pages/Orders';

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
        <Route path="/catalogue" element={<Catalog />} />
        <Route path="/panier" element={<Cart />} />
        <Route path="/commandes" element={<Orders />} />
        <Route path="*" element={<Navigate to="/catalogue" replace />} />
      </Route>
    </Routes>
  );
}
