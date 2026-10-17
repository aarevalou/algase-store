import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Camera,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { fetchContact } from "../lib/api";
import type { SiteContact } from "../types/db";
import CartDrawer from "./CartDrawer";

const nav = [
  { to: "/catalogo", label: "Catálogo" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/info/preguntas-frecuentes", label: "Ayuda" },
  { to: "/contacto", label: "Contacto" },
];

export function Wordmark() {
  return (
    <span className="brand-mark" aria-label="Algase by Danny">
      <img
        src="/images/logo-solo-1.png"
        alt="Algase"
        className="brand-mark__icon"
      />
      <img
        src="/images/logo-dany.png"
        alt="by Danny"
        className="brand-mark__word"
      />
    </span>
  );
}

function Header() {
  const { user, isAdmin } = useAuth();
  const { count, open } = useCart();
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" aria-label="Algase, inicio">
          <Wordmark />
        </Link>
        <nav aria-label="Principal" className="site-nav site-nav--desktop">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `site-nav__link ${isActive ? "is-active" : ""}`
              }>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-header__actions">
          <Link
            to={user ? "/cuenta" : "/ingresar"}
            className="site-header__account">
            {user ? "Mi cuenta" : "Ingresar"}
          </Link>
          {user && isAdmin && (
            <Link to="/admin" className="site-header__admin">
              Gestión de tienda
            </Link>
          )}
          <button
            type="button"
            onClick={open}
            className="btn btn--primary btn--compact"
            aria-label={`Abrir carrito, ${count} productos`}>
            Carrito ({count})
          </button>
        </div>
      </div>
      <nav aria-label="Principal móvil" className="site-nav site-nav--mobile">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className="site-nav__link site-nav__link--mobile">
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  const [c, setC] = useState<SiteContact | null>(null);
  useEffect(() => {
    fetchContact()
      .then(setC)
      .catch(() => undefined);
  }, []);
  const wa = c?.whatsapp
    ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`
    : null;
  return (
    <footer className="site-footer">
      <div className="alg-brand-band" aria-hidden="true" />
      <div className="site-footer__main">
        <div className="site-footer__grid">
          <section className="site-footer__brand" aria-label="Algase">
            <Link
              to="/"
              aria-label="Algase by Danny, inicio"
              className="site-footer__logo">
              <img src="/images/logo-solo-2.png" alt="Algase by Danny" />
            </Link>
            <p>
              Confecciones y estampados para llevar tus ideas a prendas y
              accesorios únicos.
            </p>
            <div className="site-footer__socials" aria-label="Redes sociales">
              {c?.instagram && (
                <a
                  href={c.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram de Algase">
                  <Camera size={19} />
                </a>
              )}
              {c?.facebook && (
                <a
                  href={c.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook de Algase">
                  <UsersRound size={19} />
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp de Algase">
                  <img
                    src="/images/whatsapp.png"
                    alt=""
                    className="whatsapp-icon"
                    aria-hidden="true"
                  />
                </a>
              )}
            </div>
          </section>

          <section
            className="site-footer__column site-footer__visit"
            aria-labelledby="footer-contact-title">
            <p className="site-footer__eyebrow">Taller y retiro</p>
            <h2 id="footer-contact-title" className="site-footer__visit-title">
              Visítanos en Puente Alto
            </h2>
            <a
              className="site-footer__address"
              href="https://www.google.com/maps/search/?api=1&query=Las+Cruces+2179+Local+34+Puente+Alto+Santiago"
              target="_blank"
              rel="noopener noreferrer">
              <MapPin size={20} aria-hidden="true" />
              <span>
                Las Cruces 2179
                <small>Puente Alto, Santiago</small>
              </span>
            </a>
            <p className="site-footer__hours">
              <Clock3 size={16} aria-hidden="true" />
              Lunes a viernes · 10:00 a 18:00 hrs.
            </p>
            <div className="site-footer__contact-links">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <img
                    src="/images/whatsapp.png"
                    alt=""
                    className="whatsapp-icon whatsapp-icon--inline"
                    aria-hidden="true"
                  />
                  WhatsApp
                </a>
              )}
              {c?.email && (
                <a href={`mailto:${c.email}`}>
                  <Mail size={17} aria-hidden="true" />
                  {c.email}
                </a>
              )}
            </div>
          </section>

          <section
            className="site-footer__column site-footer__purchase"
            aria-labelledby="footer-purchase-title">
            <h2 id="footer-purchase-title">Compra con orientación</h2>
            <div className="site-footer__payment-note">
              <CreditCard size={22} aria-hidden="true" />
              <p>
                Disponibilidad, entrega y pago se coordinan directamente con
                Algase.
              </p>
            </div>
            <Link className="site-footer__cta" to="/contacto">
              Cotizar un pedido <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link className="site-footer__secondary" to="/catalogo">
              Explorar catálogo
            </Link>
          </section>
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Algase by Danny</p>
        <p>Confección · Estampado · Hecho en Chile</p>
      </div>
    </footer>
  );
}

function WhatsAppFloat() {
  const [contact, setContact] = useState<SiteContact | null>(null);
  useEffect(() => {
    fetchContact()
      .then(setContact)
      .catch(() => undefined);
  }, []);
  const number = contact?.whatsapp?.replace(/\D/g, "");
  if (!number) return null;
  return (
    <a
      className="whatsapp-float"
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp">
      <img
        src="/images/whatsapp.png"
        alt=""
        className="whatsapp-icon whatsapp-icon--float"
        aria-hidden="true"
      />
    </a>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const usesFooterBackground =
    pathname === "/nosotros" ||
    pathname === "/contacto" ||
    pathname === "/catalogo" ||
    pathname === "/info/preguntas-frecuentes" ||
    pathname.startsWith("/producto/");

  return (
    <>
      <a
        href="#main"
        className="alg-sr-only alg-focus-3a-not-sr-only alg-focus-3a-absolute alg-focus-3a-z-50 alg-focus-3a-bg-brand alg-focus-3a-p-3">
        Saltar al contenido
      </a>
      <Header />
      <main
        id="main"
        className={`alg-mx-auto alg-min-h--5b-60vh-5d alg-max-w-6xl alg-px-4 alg-py-8${usesFooterBackground ? " main--footer-gray" : ""}`}>
        <Outlet />
      </main>
      <CartDrawer />
      <WhatsAppFloat />
      <Footer />
    </>
  );
}
