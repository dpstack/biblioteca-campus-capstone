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
          setError("We could not load your reading status. Please try again.");
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
          ? "Your reading status was saved."
          : "Book removed from your list.",
      );
    } catch {
      setError(
        "We could not save the change. Your previous status has been kept.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reading-control" aria-busy={loading || saving}>
      <label htmlFor="reading-status">My reading status</label>
      <select
        id="reading-status"
        value={status}
        disabled={loading || saving || Boolean(error)}
        onChange={(event) => void save(event.target.value as ReadingStatus)}
      >
        <option value="" disabled>
          {loading ? "Loading status…" : "Select a status"}
        </option>
        <option value="want_to_read">Want to read</option>
        <option value="reading">Reading</option>
        <option value="finished">Finished</option>
      </select>
      {status && (
        <button
          className="reading-remove"
          type="button"
          disabled={saving || loading || Boolean(error)}
          onClick={() => void save("")}
        >
          Remove from my list
        </button>
      )}
      {loading && <p role="status">Loading your reading status…</p>}
      {saving && <p role="status">Saving…</p>}
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
            Reload
          </button>
        </p>
      )}
    </div>
  );
}
