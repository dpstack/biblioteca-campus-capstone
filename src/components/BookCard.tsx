import { ArrowUpRight, BookOpen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { coverUrl } from "../lib/openLibrary";
import type { Book, InventoryItem } from "../types";
import styles from "./BookCard.module.css";

export function BookCard({
  book,
  inventory,
}: {
  book: Book;
  inventory?: InventoryItem;
}) {
  const cover = coverUrl(book.coverId);
  const [coverFailed, setCoverFailed] = useState(false);
  return (
    <article className={styles.card}>
      <Link
        className={styles.coverLink}
        to={`/books/${book.id}`}
        aria-label={`View details of ${book.title}`}
      >
        <div className={styles.cover}>
          {cover && !coverFailed ? (
            <img
              src={cover}
              alt={`Cover of ${book.title}`}
              loading="lazy"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <BookOpen size={42} aria-hidden="true" />
          )}
          {inventory && (
            <span
              className={`${styles.stock} ${!inventory.retired && inventory.available_copies > 0 ? styles.available : ""}`}
            >
              {inventory.retired
                ? "Retired"
                : inventory.available_copies > 0
                  ? "Available"
                  : "On loan"}
            </span>
          )}
        </div>
      </Link>
      <div className={styles.content}>
        <span className={styles.eyebrow}>
          {book.firstPublishYear ?? "Publication date unavailable"} ·{" "}
          {book.editionCount} editions
        </span>
        <h3>
          <Link to={`/books/${book.id}`}>{book.title}</Link>
        </h3>
        <p>{book.authors.join(", ") || "Unknown author"}</p>
        <Link className={styles.detail} to={`/books/${book.id}`}>
          View book <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
