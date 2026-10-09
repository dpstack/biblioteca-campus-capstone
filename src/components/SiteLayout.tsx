import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  LibraryBig,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/auth-context";
import { isSupabaseConfigured } from "../lib/config";

const navLinks = [
  { to: "/", label: "Inicio", end: true },
  { to: "/catalogo", label: "Explorar catálogo", end: false },
  { to: "/mi-biblioteca", label: "Mi biblioteca", end: false },
];

export function SiteLayout() {
  const { session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) main.current?.focus();
    previousPath.current = pathname;
  }, [pathname]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header
        className="site-header"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className="container header-inner">
          <Link
            className="brand"
            to="/"
            onClick={() => setMenuOpen(false)}
            aria-label="Biblioteca Campus, inicio"
          >
            <span className="brand-mark">
              <LibraryBig size={22} strokeWidth={2.2} />
            </span>
            <span>
              <strong>Biblioteca</strong>
              <small>CAMPUS DIGITAL</small>
            </span>
          </Link>
          <button
            ref={menuButton}
            className="mobile-menu-toggle"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
          <nav
            id="main-navigation"
            className={`main-nav ${menuOpen ? "is-open" : ""}`}
            aria-label="Navegación principal"
          >
            {navLinks.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {label}
              </NavLink>
            ))}
            <Link
              to={session ? "/mi-biblioteca" : "/acceso"}
              className="header-account"
              onClick={() => setMenuOpen(false)}
            >
              <UserRound size={17} /> {session ? "Mi cuenta" : "Iniciar sesión"}
            </Link>
          </nav>
        </div>
      </header>
      {!isSupabaseConfigured && (
        <div className="setup-banner" role="status">
          Modo catálogo: conecta Supabase para activar cuentas, préstamos y
          reservas.{" "}
          <Link to="/acceso">
            Ver detalles <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      <main id="contenido" ref={main} tabIndex={-1}>
        <Suspense
          fallback={
            <div className="page-status" role="status">
              Cargando página…
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <Link className="brand footer-brand" to="/">
              <span className="brand-mark">
                <BookOpen size={21} />
              </span>
              <span>
                <strong>Biblioteca</strong>
                <small>CAMPUS DIGITAL</small>
              </span>
            </Link>
            <p>Una mejor manera de descubrir, leer y compartir conocimiento.</p>
          </div>
          <div className="footer-links">
            <Link to="/catalogo">
              <Search size={15} /> Explorar libros
            </Link>
            <Link to="/mi-biblioteca">
              <UserRound size={15} /> Mi biblioteca
            </Link>
            <a href="https://openlibrary.org" target="_blank" rel="noreferrer">
              Datos de Open Library <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>Proyecto Capstone · Desarrollo Web</span>
          <span>Metadatos e imágenes: Open Library</span>
        </div>
      </footer>
    </div>
  );
}
