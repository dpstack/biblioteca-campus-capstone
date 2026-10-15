import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ListFilter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { searchBooks } from "../lib/openLibrary";
import type { Book, InventoryItem } from "../types";

const categories = [
  { value: "", label: "All" },
  { value: "fiction", label: "Fiction" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "art", label: "Art" },
  { value: "technology", label: "Technology" },
];

type SortOrder = "relevance" | "newest" | "oldest" | "author" | "popularity";

export function CatalogPage() {
  const [params] = useSearchParams();
  return <CatalogContent key={params.toString()} />;
}

function CatalogContent() {
  const [params, setParams] = useSearchParams();
  const term = params.get("q") ?? "";
  const availableOnly = params.get("available") === "1";
  const field =
    params.get("field") === "title" || params.get("field") === "author"
      ? (params.get("field") as "title" | "author")
      : "keyword";
  const category = categories.some(
    (item) => item.value === params.get("category"),
  )
    ? (params.get("category") ?? "")
    : "";
  const requestedPage = Number(params.get("page"));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const requestedSort = params.get("sort");
  const sort: SortOrder =
    requestedSort === "newest" ||
    requestedSort === "oldest" ||
    requestedSort === "author" ||
    requestedSort === "popularity"
      ? requestedSort
      : "relevance";
  const [draft, setDraft] = useState(term);
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!availableOnly)
        return searchBooks(
          { term, field, category, page, sort },
          controller.signal,
        );
      const { getAvailableInventory } = await import("../lib/library");
      const stock = await getAvailableInventory(controller.signal);
      if (controller.signal.aborted)
        throw new DOMException("Search canceled", "AbortError");
      setInventory(
        Object.fromEntries(stock.map((item) => [item.work_id, item])),
      );
      return searchBooks(
        {
          term,
          field,
          category,
          page,
          sort,
          workIds: stock.map((item) => item.work_id),
        },
        controller.signal,
      );
    };
    load()
      .then(async (result) => {
        if (controller.signal.aborted) return;
        setBooks(result.books);
        setTotal(result.total);
        setLoading(false);
        if (availableOnly) return;
        try {
          const { getInventory } = await import("../lib/library");
          const stock = await getInventory(result.books.map((book) => book.id));
          if (!controller.signal.aborted)
            setInventory(
              Object.fromEntries(stock.map((item) => [item.work_id, item])),
            );
        } catch (cause) {
          if (!controller.signal.aborted) {
            setInventory({});
            setInventoryError(
              cause instanceof Error
                ? cause.message
                : "Availability could not be retrieved.",
            );
          }
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "The catalog could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [term, field, category, page, sort, retry, availableOnly]);

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setParams(next);
  };

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateParams({ q: draft.trim().slice(0, 120), page: "" });
  };

  return (
    <div className="catalog-page">
      <section className="page-intro">
        <div className="container">
          <span className="eyebrow">OUR CATALOG</span>
          <h1>Find your next read</h1>
          <p>
            Search Open Library by title, author, or subject and discover new
            ideas.
          </p>
        </div>
      </section>
      <div className="container catalog-layout">
        <aside className="catalog-sidebar" aria-label="Search filters">
          <div className="sidebar-title">
            <ListFilter size={19} />
            <h2>Filter by</h2>
          </div>
          <label className="availability-filter">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) =>
                updateParams({
                  available: event.target.checked ? "1" : "",
                  page: "",
                })
              }
            />
            <span>Available to borrow</span>
          </label>
          <p className="availability-help">
            Library works with copies available to borrow.
          </p>
          <h3>Category</h3>
          <div className="category-list">
            {categories.map((item) => (
              <button
                key={item.value}
                className={category === item.value ? "selected" : ""}
                type="button"
                onClick={() => updateParams({ category: item.value, page: "" })}
              >
                {item.label}
                <span>{category === item.value ? "●" : "○"}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-note">
            <strong>Looking for a specific book?</strong>
            <p>Search by title or author for more precise results.</p>
          </div>
        </aside>
        <div className="catalog-main">
          <form className="catalog-search" onSubmit={onSearch} role="search">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="catalog-query">
              Search term
            </label>
            <input
              id="catalog-query"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search books, authors, or keywords"
              maxLength={120}
            />
            <label className="sr-only" htmlFor="search-field">
              Search by
            </label>
            <select
              id="search-field"
              value={field}
              onChange={(event) =>
                updateParams({ field: event.target.value, page: "" })
              }
            >
              <option value="keyword">Keyword</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
            </select>
            <button type="submit">Search</button>
          </form>
          <div className="catalog-toolbar">
            <div>
              <span className="eyebrow">EXPLORE</span>
              <h2>
                {term
                  ? `Results for “${term}”`
                  : category
                    ? categories.find((item) => item.value === category)?.label
                    : "All books"}
              </h2>
              <p>
                {loading
                  ? "Searching…"
                  : `${total.toLocaleString("en")} works found`}
              </p>
            </div>
            <label className="sort-control">
              <SlidersHorizontal size={17} />
              <span>Sort by:</span>
              <select
                value={sort}
                onChange={(event) =>
                  updateParams({
                    sort:
                      event.target.value === "relevance"
                        ? ""
                        : event.target.value,
                    page: "",
                  })
                }
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="author">Author A–Z (up to 200 works)</option>
                <option value="popularity">Most popular</option>
              </select>
            </label>
          </div>
          {sort === "author" && (
            <p className="sort-explainer">
              Author A–Z sorts the full search when it contains 200 works or
              fewer. For larger searches, refine your filters or choose another
              sort order.
            </p>
          )}
          {error && (
            <div className="inline-message error" role="alert">
              {error}{" "}
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setInventoryError("");
                  setRetry((value) => value + 1);
                }}
              >
                Retry
              </button>
            </div>
          )}
          {inventoryError && !error && (
            <div className="inline-message error" role="alert">
              The catalog is available, but inventory could not be retrieved:{" "}
              {inventoryError}
            </div>
          )}
          {loading && (
            <div
              className="book-grid"
              role="status"
              aria-label="Loading catalog"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div className="book-skeleton" key={index} />
              ))}
            </div>
          )}
          {!loading && !error && books.length === 0 && (
            <div className="empty-state">
              <BookOpenIcon />
              <h3>No results yet</h3>
              <p>
                {availableOnly
                  ? "No available works match your search. Change your search or turn off the borrowing filter."
                  : "Try another keyword or select a different category."}
              </p>
              <button
                className="button button-primary"
                type="button"
                onClick={() => setParams({})}
              >
                Clear filters
              </button>
            </div>
          )}
          {!loading && !error && books.length > 0 && (
            <>
              <div className="book-grid">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    inventory={inventory[book.id]}
                  />
                ))}
              </div>
              <div className="pagination">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  <ArrowLeft size={17} /> Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, Math.ceil(total / 24))}
                </span>
                <button
                  type="button"
                  disabled={page * 24 >= total}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  Next <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BookOpenIcon() {
  return (
    <span className="empty-icon">
      <Search size={30} />
    </span>
  );
}
