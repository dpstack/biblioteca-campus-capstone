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
import { AdminLink } from "./AdminLink";
import { ThemeToggle } from "./ThemeToggle";

const navLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/catalog", label: "Explore catalog", end: false },
  { to: "/my-library", label: "My library", end: false },
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
      <a className="skip-link" href="#main-content">
        Skip to content
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
            aria-label="Campus Library, home"
          >
            <span className="brand-mark">
              <LibraryBig size={22} strokeWidth={2.2} />
            </span>
            <span>
              <strong>Library</strong>
              <small>DIGITAL CAMPUS</small>
            </span>
          </Link>
          <button
            ref={menuButton}
            className="mobile-menu-toggle"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
          <nav
            id="main-navigation"
            className={`main-nav ${menuOpen ? "is-open" : ""}`}
            aria-label="Main navigation"
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
            <AdminLink onNavigate={() => setMenuOpen(false)} />
            <Link
              to={session ? "/my-library" : "/login"}
              className="header-account"
              onClick={() => setMenuOpen(false)}
            >
              <UserRound size={17} /> {session ? "My account" : "Sign in"}
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      {!isSupabaseConfigured && (
        <div className="setup-banner" role="status">
          Catalog mode: connect Supabase to enable accounts, loans, and
          reservations.{" "}
          <Link to="/login">
            View details <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      <main id="main-content" ref={main} tabIndex={-1}>
        <Suspense
          fallback={
            <div className="page-status" role="status">
              Loading page…
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
                <strong>Library</strong>
                <small>DIGITAL CAMPUS</small>
              </span>
            </Link>
            <p>A better way to discover, read, and share knowledge.</p>
          </div>
          <div className="footer-links">
            <Link to="/catalog">
              <Search size={15} /> Explore books
            </Link>
            <Link to="/my-library">
              <UserRound size={15} /> My library
            </Link>
            <a href="https://openlibrary.org" target="_blank" rel="noreferrer">
              Open Library data <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>Capstone Project · Web Development</span>
          <span>Metadata and images: Open Library</span>
        </div>
      </footer>
    </div>
  );
}
