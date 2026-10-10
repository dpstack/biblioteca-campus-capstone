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
  { value: "", label: "Todos" },
  { value: "fiction", label: "Ficción" },
  { value: "science", label: "Ciencia" },
  { value: "history", label: "Historia" },
  { value: "art", label: "Arte" },
  { value: "technology", label: "Tecnología" },
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
        throw new DOMException("Búsqueda cancelada", "AbortError");
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
                : "No se pudo consultar la disponibilidad.",
            );
          }
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar el catálogo.",
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
          <span className="eyebrow">NUESTRO CATÁLOGO</span>
          <h1>Encuentra tu próxima lectura</h1>
          <p>
            Busca entre los metadatos de Open Library por título, autor o tema y
            descubre nuevas ideas.
          </p>
        </div>
      </section>
      <div className="container catalog-layout">
        <aside className="catalog-sidebar" aria-label="Filtros de búsqueda">
          <div className="sidebar-title">
            <ListFilter size={19} />
            <h2>Filtrar por</h2>
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
            <span>Disponibles para préstamo</span>
          </label>
          <p className="availability-help">
            Obras de la biblioteca con ejemplares disponibles.
          </p>
          <h3>Categoría</h3>
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
            <strong>¿Buscas un libro específico?</strong>
            <p>
              Usa la búsqueda por título o autor para resultados más precisos.
            </p>
          </div>
        </aside>
        <div className="catalog-main">
          <form className="catalog-search" onSubmit={onSearch} role="search">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="catalog-query">
              Término de búsqueda
            </label>
            <input
              id="catalog-query"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Buscar libros, autores o palabras clave"
              maxLength={120}
            />
            <label className="sr-only" htmlFor="search-field">
              Buscar por
            </label>
            <select
              id="search-field"
              value={field}
              onChange={(event) =>
                updateParams({ field: event.target.value, page: "" })
              }
            >
              <option value="keyword">Palabra clave</option>
              <option value="title">Título</option>
              <option value="author">Autor</option>
            </select>
            <button type="submit">Buscar</button>
          </form>
          <div className="catalog-toolbar">
            <div>
              <span className="eyebrow">EXPLORAR</span>
              <h2>
                {term
                  ? `Resultados para “${term}”`
                  : category
                    ? categories.find((item) => item.value === category)?.label
                    : "Todos los libros"}
              </h2>
              <p>
                {loading
                  ? "Buscando…"
                  : `${total.toLocaleString("es")} obras encontradas`}
              </p>
            </div>
            <label className="sort-control">
              <SlidersHorizontal size={17} />
              <span>Ordenar:</span>
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
                <option value="relevance">Relevancia</option>
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="author">Autor A–Z (hasta 200 obras)</option>
                <option value="popularity">Más populares</option>
              </select>
            </label>
          </div>
          {sort === "author" && (
            <p className="sort-explainer">
              Autor A–Z ordena toda la búsqueda cuando hay 200 obras o menos.
              Para búsquedas mayores, afina los filtros o elige otro orden.
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
                Reintentar
              </button>
            </div>
          )}
          {inventoryError && !error && (
            <div className="inline-message error" role="alert">
              Catálogo disponible, pero no se pudo consultar el inventario:{" "}
              {inventoryError}
            </div>
          )}
          {loading && (
            <div
              className="book-grid"
              role="status"
              aria-label="Cargando catálogo"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div className="book-skeleton" key={index} />
              ))}
            </div>
          )}
          {!loading && !error && books.length === 0 && (
            <div className="empty-state">
              <BookOpenIcon />
              <h3>Sin resultados por ahora</h3>
              <p>
                {availableOnly
                  ? "No hay obras disponibles que coincidan. Cambia la búsqueda o desactiva el filtro de préstamo."
                  : "Prueba otra palabra clave o selecciona una categoría diferente."}
              </p>
              <button
                className="button button-primary"
                type="button"
                onClick={() => setParams({})}
              >
                Borrar filtros
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
                  <ArrowLeft size={17} /> Anterior
                </button>
                <span>
                  Página {page} de {Math.max(1, Math.ceil(total / 24))}
                </span>
                <button
                  type="button"
                  disabled={page * 24 >= total}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  Siguiente <ArrowRight size={17} />
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
