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
  author: (book.authors.join(", ") || "Unknown author").slice(0, 250),
  cover_id: book.coverId,
});
export default function AdminPage() {
  const { session, isLoading } = useAuth();
  return isLoading ? (
    <div className="page-status" role="status">
      Checking session…
    </div>
  ) : !session ? (
    <Navigate to="/login" replace />
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
      setError(
        cause instanceof Error
          ? cause.message
          : "Search could not be completed.",
      );
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
        cause instanceof Error
          ? cause.message
          : "The work could not be loaded.",
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
      setMessage("Inventory saved.");
      setData(await getAdminDashboard());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="container admin-page">
      <header className="admin-intro">
        <span className="eyebrow">LIBRARY MANAGEMENT</span>
        <h1>Administration</h1>
        <p>Manage copies in the collection and review circulation.</p>
        <Link to="/my-library">Back to my library</Link>
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
              Retry access
            </button>
          ) : (
            <p role="status">Checking permissions…</p>
          )}
        </div>
      ) : (
        <>
          <div className="account-stats">
            <div>
              <strong>{data.books.length}</strong>
              <small>Registered works</small>
            </div>
            <div>
              <strong>{data.loans.length}</strong>
              <small>Active loans</small>
            </div>
            <div>
              <strong>{data.reservations.length}</strong>
              <small>Pending reservations</small>
            </div>
          </div>
          <section className="admin-section" aria-labelledby="add-heading">
            <h2 id="add-heading">Add from Open Library</h2>
            <form className="admin-search" onSubmit={search}>
              <label htmlFor="admin-query">Title, author, or keyword</label>
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
                {searching ? "Searching…" : "Search books"}
              </button>
            </form>
            <ul className="admin-list">
              {results.map((book) => (
                <li key={book.id}>
                  <div>
                    <strong>{book.title}</strong>
                    <p>{book.authors.join(", ") || "Unknown author"}</p>
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
                    Manage {book.id}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {editing && (
            <section className="admin-section" aria-labelledby="edit-heading">
              <h2 id="edit-heading">Edit copies: {editing.title}</h2>
              <form className="admin-editor" onSubmit={save}>
                <p>
                  {editing.author} · {editing.work_id}
                </p>
                <label htmlFor="admin-copies">Total copies</label>
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
                  Retire from new loans and reservations
                </label>
                <p>
                  Existing loans and history are preserved. You cannot retire a
                  work with pending reservations.
                </p>
                <div className="admin-actions">
                  <button className="button button-primary" disabled={pending}>
                    {pending ? "Saving…" : "Save inventory"}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={pending}
                    onClick={() => setEditing(null)}
                  >
                    Cancel editing
                  </button>
                </div>
              </form>
            </section>
          )}
          <section
            className="admin-section"
            aria-labelledby="collection-heading"
          >
            <h2 id="collection-heading">Collection</h2>
            <ul className="admin-list">
              {data.books.map((book) => (
                <li key={book.work_id}>
                  <div>
                    <Link to={`/books/${book.work_id}`}>
                      <strong>{book.title || book.work_id}</strong>
                    </Link>
                    <p>
                      {book.available_copies} available out of{" "}
                      {book.total_copies} ·{" "}
                      {book.retired ? "Retired" : "Active"}
                    </p>
                  </div>
                  <button
                    className="button"
                    disabled={pending}
                    onClick={() => void choose(book)}
                  >
                    Edit {book.work_id}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="admin-section" aria-labelledby="loans-heading">
            <h2 id="loans-heading">Active loans</h2>
            {data.loans.length === 0 ? (
              <p>No active loans.</p>
            ) : (
              <ul className="admin-list">
                {data.loans.map((loan) => (
                  <li key={loan.id}>
                    <div>
                      <strong>{loan.title}</strong>
                      <p>{loan.email}</p>
                      <p>
                        Due: {new Date(loan.due_at).toLocaleDateString("en")}
                        {new Date(loan.due_at).getTime() < openedAt
                          ? " · Overdue"
                          : ""}
                      </p>
                    </div>
                    <Link to={`/books/${loan.work_id}`}>View work</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section
            className="admin-section"
            aria-labelledby="reservations-heading"
          >
            <h2 id="reservations-heading">Pending reservations</h2>
            {data.reservations.length === 0 ? (
              <p>No pending reservations.</p>
            ) : (
              <ol className="admin-list">
                {data.reservations.map((reservation) => (
                  <li key={reservation.id}>
                    <div>
                      <strong>{reservation.title}</strong>
                      <p>
                        {reservation.email} · Position{" "}
                        {data.reservations
                          .filter(
                            (item) => item.work_id === reservation.work_id,
                          )
                          .findIndex((item) => item.id === reservation.id) + 1}
                      </p>
                      <p>
                        {new Date(reservation.created_at).toLocaleDateString(
                          "en",
                        )}
                      </p>
                    </div>
                    <Link to={`/books/${reservation.work_id}`}>View work</Link>
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
