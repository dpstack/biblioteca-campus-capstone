import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Clock3,
  Search,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { searchBooks } from "../lib/openLibrary";
import type { Book } from "../types";

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    searchBooks({ term: "design", field: "keyword" }, controller.signal)
      .then((result) =>
        setBooks(result.books.filter((book) => book.coverId).slice(0, 4)),
      )
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los libros.",
          );
      });
    return () => controller.abort();
  }, []);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (term) navigate(`/catalogo?q=${encodeURIComponent(term)}`);
    else navigate("/catalogo");
  };

  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="eyebrow light">
              <Sparkles size={14} /> CONOCIMIENTO SIN LÍMITES
            </span>
            <h1>
              Tu próxima gran idea comienza <em>aquí.</em>
            </h1>
            <p>
              Explora miles de obras, encuentra nuevas perspectivas y lleva tus
              lecturas contigo. La biblioteca universitaria, ahora a un clic.
            </p>
            <form className="hero-search" onSubmit={onSearch} role="search">
              <Search size={20} aria-hidden="true" />
              <label className="sr-only" htmlFor="home-search">
                Buscar libros, autores o temas
              </label>
              <input
                id="home-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca libros, autores o temas..."
                maxLength={120}
              />
              <button type="submit">
                Buscar <ArrowRight size={17} />
              </button>
            </form>
            <div className="hero-chips">
              <span>Explora por tema:</span>
              <Link to="/catalogo?category=science">Ciencia</Link>
              <Link to="/catalogo?category=history">Historia</Link>
              <Link to="/catalogo?category=art">Arte</Link>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-circle" />
            <div className="visual-book book-back">
              <img
                src="https://covers.openlibrary.org/b/id/14650867-L.jpg?default=false"
                alt=""
              />
            </div>
            <div className="visual-book book-front">
              <img
                src="https://covers.openlibrary.org/b/id/8228691-L.jpg?default=false"
                alt=""
              />
            </div>
            <div className="visual-note">
              <BookOpen size={19} />
              <span>
                Un mundo de historias
                <br />
                <strong>por descubrir</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="hero-bottom-line" />
      </section>

      <section
        className="benefits-section"
        aria-label="Beneficios de la biblioteca"
      >
        <div className="container benefits-grid">
          <div>
            <span className="benefit-icon">
              <BookOpen size={22} />
            </span>
            <div>
              <strong>Explora sin límites</strong>
              <p>Descubre libros por título, autor o tema.</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon">
              <BookMarked size={22} />
            </span>
            <div>
              <strong>Organiza tus lecturas</strong>
              <p>Guarda lo que lees y lo que te inspira.</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon">
              <Clock3 size={22} />
            </span>
            <div>
              <strong>Préstamos sencillos</strong>
              <p>Consulta disponibilidad y fechas de entrega.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SELECCIÓN PARA TI</span>
            <h2>Ideas que vale la pena explorar</h2>
            <p>Una muestra del catálogo para empezar tu búsqueda.</p>
          </div>
          <Link className="text-link" to="/catalogo">
            Ver todo el catálogo <ArrowRight size={17} />
          </Link>
        </div>
        {error && (
          <div className="inline-message error" role="alert">
            {error} <Link to="/catalogo">Ir al catálogo</Link>
          </div>
        )}
        {!error && books.length === 0 && (
          <div
            className="book-grid"
            role="status"
            aria-label="Cargando libros destacados"
          >
            {[0, 1, 2, 3].map((index) => (
              <div className="book-skeleton" key={index} />
            ))}
          </div>
        )}
        {books.length > 0 && (
          <div className="book-grid">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>

      <section className="container discover-banner">
        <div>
          <span className="eyebrow light">LA LECTURA CONTINÚA</span>
          <h2>Cada libro abre una nueva puerta.</h2>
          <p>
            Encuentra el próximo capítulo de tu recorrido académico y personal.
          </p>
          <Link className="button button-cream" to="/catalogo">
            Explorar ahora <ArrowRight size={17} />
          </Link>
        </div>
        <div className="discover-ornament" aria-hidden="true">
          “
        </div>
      </section>
    </>
  );
}
