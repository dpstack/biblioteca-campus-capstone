import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import {
  getAdminDashboard,
  saveAdminBook,
  type AdminBook,
  type AdminDashboard,
} from "../lib/admin";
import { getWork, searchBooks } from "../lib/openLibrary";
import type { Book, BookSnapshot } from "../types";

const snapshot = (book: Book): BookSnapshot => ({
  work_id: book.id,
  title: book.title.slice(0, 250),
  author: (book.authors.join(", ") || "Autor no indicado").slice(0, 250),
  cover_id: book.coverId,
});
export default function AdminPage() {
  const { session, isLoading } = useAuth();
  return isLoading ? (
    <div className="page-status" role="status">
      Comprobando sesión…
    </div>
  ) : !session ? (
    <Navigate to="/acceso" replace />
  ) : (
    <AdminWorkspace key={session.user.id} />
  );
}
function AdminWorkspace() {
  const [openedAt] = useState(() => Date.now());
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<
    (BookSnapshot & { total: number; retired: boolean }) | null
  >(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getAdminDashboard()
      .then((value) => {
        if (active) {
          setData(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setError("");
    setMessage("");
    try {
      const result = await searchBooks({
        term: query,
        field: "keyword",
        page: 1,
        sort: "relevance",
        category: "",
      });
      setResults(result.books);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo buscar.");
    } finally {
      setSearching(false);
    }
  };
  const choose = async (book: AdminBook) => {
    setPending(true);
    setError("");
    try {
      const details =
        book.title && book.author
          ? {
              work_id: book.work_id,
              title: book.title,
              author: book.author,
              cover_id: book.cover_id,
            }
          : snapshot(await getWork(book.work_id));
      setEditing({
        ...details,
        total: book.total_copies,
        retired: book.retired,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cargar la obra.",
      );
    } finally {
      setPending(false);
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await saveAdminBook(editing, editing.total, editing.retired);
      setEditing(null);
      setMessage("Inventario guardado.");
      setData(await getAdminDashboard());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="container admin-page">
      <header className="admin-intro">
        <span className="eyebrow">GESTIÓN DE LA BIBLIOTECA</span>
        <h1>Administración</h1>
        <p>
          Gestiona los ejemplares de la colección y consulta su circulación.
        </p>
        <Link to="/mi-biblioteca">Volver a mi biblioteca</Link>
      </header>
      {error && (
        <div className="form-feedback error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-feedback success" role="status">
          {message}
        </div>
      )}
      {!data ? (
        <div className="page-status">
          {error ? (
            <button
              className="button button-primary"
              onClick={() => setRetry((v) => v + 1)}
            >
              Reintentar acceso
            </button>
          ) : (
            <p role="status">Comprobando permisos…</p>
          )}
        </div>
      ) : (
        <>
          <div className="account-stats">
            <div>
              <strong>{data.books.length}</strong>
              <small>Obras registradas</small>
            </div>
            <div>
              <strong>{data.loans.length}</strong>
              <small>Préstamos activos</small>
            </div>
            <div>
              <strong>{data.reservations.length}</strong>
              <small>Reservas pendientes</small>
            </div>
          </div>
          <section className="admin-section" aria-labelledby="add-heading">
            <h2 id="add-heading">Añadir desde Open Library</h2>
            <form className="admin-search" onSubmit={search}>
              <label htmlFor="admin-query">Título, autor o palabra clave</label>
              <input
                id="admin-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                required
                minLength={2}
                maxLength={200}
              />
              <button
                className="button button-primary"
                disabled={searching || pending}
              >
                {searching ? "Buscando…" : "Buscar libros"}
              </button>
            </form>
            <ul className="admin-list">
              {results.map((book) => (
                <li key={book.id}>
                  <div>
                    <strong>{book.title}</strong>
                    <p>{book.authors.join(", ") || "Autor no indicado"}</p>
                  </div>
                  <button
                    className="button"
                    disabled={pending}
                    onClick={() => {
                      const existing = data.books.find(
                        (item) => item.work_id === book.id,
                      );
                      setEditing({
                        ...snapshot(book),
                        total: existing?.total_copies ?? 1,
                        retired: existing?.retired ?? false,
                      });
                      setMessage("");
                    }}
                  >
                    Gestionar {book.id}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {editing && (
            <section className="admin-section" aria-labelledby="edit-heading">
              <h2 id="edit-heading">Editar ejemplares: {editing.title}</h2>
              <form className="admin-editor" onSubmit={save}>
                <p>
                  {editing.author} · {editing.work_id}
                </p>
                <label htmlFor="admin-copies">Total de ejemplares</label>
                <input
                  id="admin-copies"
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={editing.total}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      total: Number(event.target.value),
                    })
                  }
                />
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={editing.retired}
                    onChange={(event) =>
                      setEditing({ ...editing, retired: event.target.checked })
                    }
                  />
                  Retirar de nuevos préstamos y reservas
                </label>
                <p>
                  Los ejemplares prestados y el historial se conservan. No
                  puedes retirar una obra con reservas pendientes.
                </p>
                <div className="admin-actions">
                  <button className="button button-primary" disabled={pending}>
                    {pending ? "Guardando…" : "Guardar inventario"}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={pending}
                    onClick={() => setEditing(null)}
                  >
                    Cancelar edición
                  </button>
                </div>
              </form>
            </section>
          )}
          <section
            className="admin-section"
            aria-labelledby="collection-heading"
          >
            <h2 id="collection-heading">Colección</h2>
            <ul className="admin-list">
              {data.books.map((book) => (
                <li key={book.work_id}>
                  <div>
                    <Link to={`/libro/${book.work_id}`}>
                      <strong>{book.title || book.work_id}</strong>
                    </Link>
                    <p>
                      {book.available_copies} disponibles de {book.total_copies}{" "}
                      · {book.retired ? "Retirada" : "Activa"}
                    </p>
                  </div>
                  <button
                    className="button"
                    disabled={pending}
                    onClick={() => void choose(book)}
                  >
                    Editar {book.work_id}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="admin-section" aria-labelledby="loans-heading">
            <h2 id="loans-heading">Préstamos activos</h2>
            {data.loans.length === 0 ? (
              <p>No hay préstamos activos.</p>
            ) : (
              <ul className="admin-list">
                {data.loans.map((loan) => (
                  <li key={loan.id}>
                    <div>
                      <strong>{loan.title}</strong>
                      <p>{loan.email}</p>
                      <p>
                        Entrega:{" "}
                        {new Date(loan.due_at).toLocaleDateString("es")}
                        {new Date(loan.due_at).getTime() < openedAt
                          ? " · Vencido"
                          : ""}
                      </p>
                    </div>
                    <Link to={`/libro/${loan.work_id}`}>Ver obra</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section
            className="admin-section"
            aria-labelledby="reservations-heading"
          >
            <h2 id="reservations-heading">Reservas pendientes</h2>
            {data.reservations.length === 0 ? (
              <p>No hay reservas pendientes.</p>
            ) : (
              <ol className="admin-list">
                {data.reservations.map((reservation) => (
                  <li key={reservation.id}>
                    <div>
                      <strong>{reservation.title}</strong>
                      <p>
                        {reservation.email} · Turno{" "}
                        {data.reservations
                          .filter(
                            (item) => item.work_id === reservation.work_id,
                          )
                          .findIndex((item) => item.id === reservation.id) + 1}
                      </p>
                      <p>
                        {new Date(reservation.created_at).toLocaleDateString(
                          "es",
                        )}
                      </p>
                    </div>
                    <Link to={`/libro/${reservation.work_id}`}>Ver obra</Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
