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
                : "Inventory could not be retrieved.",
            );
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "This book could not be loaded.",
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
      author: book.authors.join(", ") || "Unknown author",
      cover_id: book.coverId,
    };
    try {
      if (action === "borrow") {
        await borrowBook(snapshot);
        setMessage("Loan registered. Check the due date in My library.");
      } else if (action === "reserve") {
        await reserveBook(snapshot);
        setMessage(
          "Reservation registered. Your position will appear in My library.",
        );
      }
      const records = await getInventory([book.id]);
      setInventory(records[0] ?? null);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "The operation could not be completed.",
      );
    } finally {
      setActionPending(false);
    }
  };

  if (loading)
    return (
      <div className="container page-status" role="status">
        Loading book details…
      </div>
    );
  if (error || !book)
    return (
      <div className="container page-status">
        <p role="alert">{error || "We could not find this book."}</p>
        <Link to="/catalog">Back to catalog</Link>
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
      <Link className="back-link" to="/catalog">
        <ArrowLeft size={17} /> Back to catalog
      </Link>
      <div className="book-detail-grid">
        <div className="detail-cover-wrap">
          <div className="detail-cover">
            {cover && !coverFailed ? (
              <img
                src={cover}
                alt={`Cover of ${book.title}`}
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
            View on Open Library <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="detail-main">
          <span className="eyebrow">BOOK DETAILS</span>
          <h1>{book.title}</h1>
          <p className="detail-author">
            by <strong>{book.authors.join(", ") || "Unknown author"}</strong>
          </p>
          <div className="detail-meta">
            <span>
              <CalendarDays size={17} />{" "}
              {book.firstPublishDate ?? "Date unavailable"}
            </span>
            <span>
              <LibraryBig size={17} /> Work {book.id}
            </span>
          </div>
          <div className="detail-divider" />
          <h2>About this book</h2>
          <p className="book-description">{description}</p>
          {descriptionIsLong && (
            <button
              className="read-more-button"
              type="button"
              onClick={() => setShowFullDescription((value) => !value)}
            >
              {showFullDescription ? "Show less" : "Read full description"}
            </button>
          )}
          {book.subjects.length > 0 && (
            <>
              <h2>Subjects</h2>
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
          aria-label="Availability and actions"
        >
          <span className="eyebrow">IN THE CAMPUS LIBRARY</span>
          <h2>Your next read</h2>
          {!isSupabaseConfigured ? (
            <div className="stock-message">
              <Clock3 size={20} />
              <div>
                <strong>Loans are not connected yet</strong>
                <p>
                  The catalog is available. Configure Supabase to check copies
                  and use your account.
                </p>
              </div>
            </div>
          ) : inventoryError ? (
            <div className="stock-message" role="alert">
              <Clock3 size={20} />
              <div>
                <strong>Inventory unavailable</strong>
                <p>
                  Check your connection or Supabase migrations: {inventoryError}
                </p>
              </div>
            </div>
          ) : inventory?.retired ? (
            <div className="stock-message">
              <span className="stock-dot" />
              <div>
                <strong>Retired from the active collection</strong>
                <p>
                  This work is closed to new loans and reservations. Existing
                  loans can be returned from My library.
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
                    ? "Available to borrow"
                    : "All copies are on loan"}
                </strong>
                <p>
                  {inventory.available_copies} of {inventory.total_copies}{" "}
                  copies available
                </p>
              </div>
            </div>
          ) : (
            <div className="stock-message">
              <Clock3 size={20} />
              <div>
                <strong>Outside the collection</strong>
                <p>
                  This work appears in Open Library, but no copies have been
                  added to this library yet.
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
                ? "Processing…"
                : inventory.available_copies > 0
                  ? "Borrow book"
                  : "Reserve book"}
            </button>
          )}
          {!session && isSupabaseConfigured && (
            <Link className="button button-primary action-button" to="/login">
              Sign in to continue
            </Link>
          )}
          {session && (
            <ReadingControl
              key={`${session.user.id}:${book.id}`}
              book={{
                work_id: book.id,
                title: book.title,
                author: book.authors.join(", ") || "Unknown author",
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
            Metadata comes from Open Library. Availability refers only to Campus
            Library's own inventory.
          </p>
        </aside>
      </div>
    </div>
  );
}
