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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    searchBooks({ term: "design", field: "keyword" }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setBooks(result.books.filter((book) => book.coverId).slice(0, 4));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Books could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (term) navigate(`/catalog?q=${encodeURIComponent(term)}`);
    else navigate("/catalog");
  };

  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="eyebrow light">
              <Sparkles size={14} /> KNOWLEDGE WITHOUT LIMITS
            </span>
            <h1>
              Your next great idea starts <em>here.</em>
            </h1>
            <p>
              Explore thousands of works, find new perspectives, and keep your
              reading with you. Your university library is one click away.
            </p>
            <form className="hero-search" onSubmit={onSearch} role="search">
              <Search size={20} aria-hidden="true" />
              <label className="sr-only" htmlFor="home-search">
                Search books, authors, or subjects
              </label>
              <input
                id="home-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search books, authors, or subjects..."
                maxLength={120}
              />
              <button type="submit">
                Search <ArrowRight size={17} />
              </button>
            </form>
            <div className="hero-chips">
              <span>Explore by subject:</span>
              <Link to="/catalog?category=science">Science</Link>
              <Link to="/catalog?category=history">History</Link>
              <Link to="/catalog?category=art">Art</Link>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-circle" />
            <div className="visual-book book-back">
              <img
                src="https://covers.openlibrary.org/b/id/14650867-M.jpg?default=false"
                fetchPriority="high"
                decoding="async"
                alt=""
              />
            </div>
            <div className="visual-book book-front">
              <img
                src="https://covers.openlibrary.org/b/id/8228691-M.jpg?default=false"
                decoding="async"
                alt=""
              />
            </div>
            <div className="visual-note">
              <BookOpen size={19} />
              <span>
                A world of stories
                <br />
                <strong>to discover</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="hero-bottom-line" />
      </section>

      <section className="benefits-section" aria-label="Library benefits">
        <div className="container benefits-grid">
          <div>
            <span className="benefit-icon">
              <BookOpen size={22} />
            </span>
            <div>
              <strong>Explore without limits</strong>
              <p>Discover books by title, author, or subject.</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon">
              <BookMarked size={22} />
            </span>
            <div>
              <strong>Organize your reading</strong>
              <p>Keep track of what you read and what inspires you.</p>
            </div>
          </div>
          <div>
            <span className="benefit-icon">
              <Clock3 size={22} />
            </span>
            <div>
              <strong>Easy borrowing</strong>
              <p>Check availability and due dates.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SELECTED FOR YOU</span>
            <h2>Ideas worth exploring</h2>
            <p>A selection from the catalog to start your search.</p>
          </div>
          <Link className="text-link" to="/catalog">
            View the full catalog <ArrowRight size={17} />
          </Link>
        </div>
        {error && (
          <div className="inline-message error" role="alert">
            {error} <Link to="/catalog">Go to catalog</Link>
          </div>
        )}
        {loading && (
          <div
            className="book-grid"
            role="status"
            aria-label="Loading featured books"
          >
            {[0, 1, 2, 3].map((index) => (
              <div className="book-skeleton" key={index} />
            ))}
          </div>
        )}
        {!loading && !error && books.length === 0 && (
          <div className="inline-message" role="status">
            No featured books are available right now.{" "}
            <Link to="/catalog">Explore the catalog</Link>
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
          <span className="eyebrow light">THE READING CONTINUES</span>
          <h2>Every book opens a new door.</h2>
          <p>Find the next chapter in your academic and personal journey.</p>
          <Link className="button button-cream" to="/catalog">
            Explore now <ArrowRight size={17} />
          </Link>
        </div>
        <div className="discover-ornament" aria-hidden="true">
          “
        </div>
      </section>
    </>
  );
}
