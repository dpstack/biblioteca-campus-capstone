import { useEffect, useState } from "react";
import {
  getReadingStatus,
  removeReadingItem,
  setReadingStatus,
} from "../lib/library";
import type { BookSnapshot, ReadingStatus } from "../types";

export function ReadingControl({ book }: { book: BookSnapshot }) {
  const [status, setStatus] = useState<ReadingStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getReadingStatus(book.work_id)
      .then((saved) => {
        if (active) setStatus(saved ?? "");
      })
      .catch(() => {
        if (active)
          setError("No pudimos cargar tu estado de lectura. Intenta de nuevo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [book.work_id, retry]);

  const save = async (next: ReadingStatus | "") => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (next) await setReadingStatus(book, next);
      else await removeReadingItem(book.work_id);
      setStatus(next);
      setMessage(
        next
          ? "Tu estado de lectura se guardó."
          : "Libro eliminado de tu lista.",
      );
    } catch {
      setError("No pudimos guardar el cambio. Tu estado anterior se conserva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reading-control" aria-busy={loading || saving}>
      <label htmlFor="reading-status">Estado en mi lista de lectura</label>
      <select
        id="reading-status"
        value={status}
        disabled={loading || saving || Boolean(error)}
        onChange={(event) => void save(event.target.value as ReadingStatus)}
      >
        <option value="" disabled>
          {loading ? "Cargando estado…" : "Seleccionar estado"}
        </option>
        <option value="want_to_read">Quiero leer</option>
        <option value="reading">Leyendo</option>
        <option value="finished">Terminado</option>
      </select>
      {status && (
        <button
          className="reading-remove"
          type="button"
          disabled={saving || loading || Boolean(error)}
          onClick={() => void save("")}
        >
          Quitar de mi lista
        </button>
      )}
      {loading && <p role="status">Cargando tu estado de lectura…</p>}
      {saving && <p role="status">Guardando…</p>}
      {message && (
        <p className="action-feedback success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="action-feedback error" role="alert">
          {error}{" "}
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Volver a cargar
          </button>
        </p>
      )}
    </div>
  );
}
