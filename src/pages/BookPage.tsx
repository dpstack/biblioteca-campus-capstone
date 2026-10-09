import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LibraryBig,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { borrowBook, getInventory, reserveBook } from "../lib/library";
import { ReadingControl } from "../components/ReadingControl";
import { coverUrl, getWork } from "../lib/openLibrary";
import { isSupabaseConfigured } from "../lib/supabase";
import type { InventoryItem, WorkDetail } from "../types";

export function BookPage() {
  const { workId = "" } = useParams();
  return <BookDetail key={workId} workId={workId} />;
}

function BookDetail({ workId }: { workId: string }) {
  const { session } = useAuth();
  const [book, setBook] = useState<WorkDetail | null>(null);
  const [inventory, setInventory] = useState<InventoryItem | null>(null);
  const [inventoryError, setInventoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getWork(workId, controller.signal)
      .then(async (work) => {
        if (controller.signal.aborted) return;
        setBook(work);
        try {
          const records = await getInventory([workId]);
          if (!controller.signal.aborted) setInventory(records[0] ?? null);
        } catch (cause) {
          if (!controller.signal.aborted)
            setInventoryError(
              cause instanceof Error
                ? cause.message
                : "No se pudo consultar el inventario.",
            );
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar este libro.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [workId]);

  const act = async (action: "borrow" | "reserve") => {
    if (!book) return;
    setActionPending(true);
    setMessage("");
    setActionError("");
    const snapshot = {
      work_id: book.id,
      title: book.title,
      author: book.authors.join(", ") || "Autor no indicado",
      cover_id: book.coverId,
    };
    try {
      if (action === "borrow") {
        await borrowBook(snapshot);
        setMessage(
          "Préstamo registrado. Consulta la fecha de entrega en Mi biblioteca.",
        );
      } else if (action === "reserve") {
        await reserveBook(snapshot);
        setMessage("Reserva registrada. Tu turno aparecerá en Mi biblioteca.");
      }
      const records = await getInventory([book.id]);
      setInventory(records[0] ?? null);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setActionPending(false);
    }
  };

  if (loading)
    return (
      <div className="container page-status" role="status">
        Cargando detalles de la obra…
      </div>
    );
  if (error || !book)
    return (
      <div className="container page-status">
        <p role="alert">{error || "No encontramos este libro."}</p>
        <Link to="/catalogo">Volver al catálogo</Link>
      </div>
    );

  const cover = coverUrl(book.coverId, "L");
  const descriptionIsLong = book.description.length > 1100;
  const description =
    descriptionIsLong && !showFullDescription
      ? `${book.description.slice(0, 1100).replace(/\s+\S*$/, "")}…`
      : book.description;
  return (
    <div className="container book-detail-page">
      <Link className="back-link" to="/catalogo">
        <ArrowLeft size={17} /> Volver al catálogo
      </Link>
      <div className="book-detail-grid">
        <div className="detail-cover-wrap">
          <div className="detail-cover">
            {cover && !coverFailed ? (
              <img
                src={cover}
                alt={`Portada de ${book.title}`}
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <BookOpen size={80} aria-hidden="true" />
            )}
          </div>
          <a
            href={`https://openlibrary.org/works/${book.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver ficha en Open Library <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="detail-main">
          <span className="eyebrow">DETALLES DEL LIBRO</span>
          <h1>{book.title}</h1>
          <p className="detail-author">
            por{" "}
            <strong>{book.authors.join(", ") || "Autor no indicado"}</strong>
          </p>
          <div className="detail-meta">
            <span>
              <CalendarDays size={17} />{" "}
              {book.firstPublishDate ?? "Fecha no indicada"}
            </span>
            <span>
              <LibraryBig size={17} /> Obra {book.id}
            </span>
          </div>
          <div className="detail-divider" />
          <h2>Acerca de este libro</h2>
          <p className="book-description">{description}</p>
          {descriptionIsLong && (
            <button
              className="read-more-button"
              type="button"
              onClick={() => setShowFullDescription((value) => !value)}
            >
              {showFullDescription
                ? "Mostrar menos"
                : "Leer descripción completa"}
            </button>
          )}
          {book.subjects.length > 0 && (
            <>
              <h2>Temas</h2>
              <div className="subject-tags">
                {book.subjects.map((subject) => (
                  <span key={subject}>{subject}</span>
                ))}
              </div>
            </>
          )}
        </div>
        <aside
          className="book-action-panel"
          aria-label="Disponibilidad y acciones"
        >
          <span className="eyebrow">EN LA BIBLIOTECA CAMPUS</span>
          <h2>Tu próxima lectura</h2>
          {!isSupabaseConfigured ? (
            <div className="stock-message">
              <Clock3 size={20} />
              <div>
                <strong>Préstamos aún sin conectar</strong>
                <p>
                  El catálogo funciona; configura Supabase para consultar
                  ejemplares y usar tu cuenta.
                </p>
              </div>
            </div>
          ) : inventoryError ? (
            <div className="stock-message" role="alert">
              <Clock3 size={20} />
              <div>
                <strong>Inventario no disponible</strong>
                <p>
                  Revisa la conexión o la migración de Supabase:{" "}
                  {inventoryError}
                </p>
              </div>
            </div>
          ) : inventory?.retired ? (
            <div className="stock-message">
              <span className="stock-dot" />
              <div>
                <strong>Retirada de la colección activa</strong>
                <p>
                  Esta obra no admite nuevos préstamos ni reservas. Los
                  préstamos existentes pueden devolverse desde Mi biblioteca.
                </p>
              </div>
            </div>
          ) : inventory ? (
            <div
              className={`stock-message ${inventory.available_copies > 0 ? "in-stock" : ""}`}
            >
              <span className="stock-dot" />
              <div>
                <strong>
                  {inventory.available_copies > 0
                    ? "Disponible para préstamo"
                    : "Todos los ejemplares prestados"}
                </strong>
                <p>
                  {inventory.available_copies} de {inventory.total_copies}{" "}
                  ejemplares disponibles
                </p>
              </div>
            </div>
          ) : (
            <div className="stock-message">
              <Clock3 size={20} />
              <div>
                <strong>Fuera de la colección</strong>
                <p>
                  Esta obra aparece en Open Library, pero aún no tiene
                  ejemplares registrados en la biblioteca.
                </p>
              </div>
            </div>
          )}
          {session && inventory && !inventory.retired && !inventoryError && (
            <button
              className="button button-primary action-button"
              type="button"
              disabled={actionPending}
              onClick={() =>
                void act(inventory.available_copies > 0 ? "borrow" : "reserve")
              }
            >
              {inventory.available_copies > 0 ? (
                <BookOpen size={18} />
              ) : (
                <Bookmark size={18} />
              )}
              {actionPending
                ? "Procesando…"
                : inventory.available_copies > 0
                  ? "Solicitar préstamo"
                  : "Reservar libro"}
            </button>
          )}
          {!session && isSupabaseConfigured && (
            <Link className="button button-primary action-button" to="/acceso">
              Inicia sesión para continuar
            </Link>
          )}
          {session && (
            <ReadingControl
              key={`${session.user.id}:${book.id}`}
              book={{
                work_id: book.id,
                title: book.title,
                author: book.authors.join(", ") || "Autor no indicado",
                cover_id: book.coverId,
              }}
            />
          )}
          {message && (
            <p className="action-feedback success" role="status">
              <CheckCircle2 size={17} /> {message}
            </p>
          )}
          {actionError && (
            <p className="action-feedback error" role="alert">
              {actionError}
            </p>
          )}
          <p className="panel-fineprint">
            Los metadatos proceden de Open Library. La disponibilidad
            corresponde únicamente al inventario de Biblioteca Campus.
          </p>
        </aside>
      </div>
    </div>
  );
}
