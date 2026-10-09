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
        to={`/libro/${book.id}`}
        aria-label={`Ver detalles de ${book.title}`}
      >
        <div className={styles.cover}>
          {cover && !coverFailed ? (
            <img
              src={cover}
              alt={`Portada de ${book.title}`}
              loading="lazy"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <BookOpen size={42} aria-hidden="true" />
          )}
          {inventory && (
            <span
              className={`${styles.stock} ${inventory.available_copies > 0 ? styles.available : ""}`}
            >
              {inventory.available_copies > 0 ? "Disponible" : "En préstamo"}
            </span>
          )}
        </div>
      </Link>
      <div className={styles.content}>
        <span className={styles.eyebrow}>
          {book.firstPublishYear ?? "Edición sin fecha"} · {book.editionCount}{" "}
          ediciones
        </span>
        <h3>
          <Link to={`/libro/${book.id}`}>{book.title}</Link>
        </h3>
        <p>{book.authors.join(", ") || "Autor no indicado"}</p>
        <Link className={styles.detail} to={`/libro/${book.id}`}>
          Ver libro <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
