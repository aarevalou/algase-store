import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Account from "./pages/Account";
import Info from "./pages/Info";
import WebpayReturn from "./pages/WebpayReturn";
import AdminHome from "./pages/admin/AdminHome";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="catalogo" element={<Catalog />} />
        <Route path="producto/:slug" element={<ProductDetail />} />
        <Route path="carrito" element={<Cart />} />
        <Route path="ingresar" element={<Login />} />
        <Route path="nosotros" element={<Info page="nosotros" />} />
        <Route path="contacto" element={<Info page="contacto" />} />
        <Route path="info/:page" element={<Info />} />
        <Route path="pago/webpay/retorno" element={<WebpayReturn />} />
        <Route path="pago/retorno" element={<WebpayReturn />} />
        <Route path="checkout" element={<Checkout />} />
        <Route element={<ProtectedRoute />}>
          <Route path="cuenta" element={<Account />} />
        </Route>
        <Route element={<ProtectedRoute admin />}>
          <Route path="admin" element={<AdminHome />} />
        </Route>
        <Route path="*" element={<p>Página no encontrada.</p>} />
      </Route>
    </Routes>
  );
}
