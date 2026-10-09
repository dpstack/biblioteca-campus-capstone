import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LogOut,
  XCircle,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import {
  cancelReservation,
  getMyLoans,
  getMyReadingList,
  getMyReservations,
  returnBook,
  removeReadingItem,
} from "../lib/library";
import { coverUrl } from "../lib/openLibrary";
import type { Loan, ReadingListItem, Reservation } from "../types";

type Tab = "loans" | "reservations" | "reading";
const tabs: Tab[] = ["loans", "reservations", "reading"];

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

function AccountPage() {
  const { session, isLoading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("loans");
  const tabButtons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const [loans, setLoans] = useState<Loan[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reading, setReading] = useState<ReadingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openedAt] = useState(() => Date.now());

  const refresh = async () => {
    const [myLoans, myReservations, myReading] = await Promise.all([
      getMyLoans(),
      getMyReservations(),
      getMyReadingList(),
    ]);
    setLoans(myLoans);
    setReservations(myReservations);
    setReading(myReading);
  };

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.all([getMyLoans(), getMyReservations(), getMyReadingList()])
      .then(([myLoans, myReservations, myReading]) => {
        if (active) {
          setLoans(myLoans);
          setReservations(myReservations);
          setReading(myReading);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar tu biblioteca.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const activeLoans = useMemo(
    () => loans.filter((loan) => !loan.returned_at),
    [loans],
  );
  const waitingReservations = useMemo(
    () =>
      reservations.filter((reservation) => reservation.status === "waiting"),
    [reservations],
  );

  const navigateTabs = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: Tab,
  ) => {
    const index = tabs.indexOf(current);
    const next =
      event.key === "ArrowRight"
        ? tabs[(index + 1) % tabs.length]
        : event.key === "ArrowLeft"
          ? tabs[(index + tabs.length - 1) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabButtons.current[next]?.focus();
  };

  if (isLoading)
    return <div className="container page-status">Verificando sesión…</div>;
  if (!session) return <Navigate to="/acceso" replace />;

  const perform = async (kind: "return" | "cancel" | "remove", id: string) => {
    setError("");
    setMessage("");
    setPendingId(id);
    try {
      if (kind === "return") await returnBook(id);
      else if (kind === "cancel") await cancelReservation(id);
      else await removeReadingItem(id);
      await refresh();
      setMessage(
        kind === "return"
          ? "Devolución registrada correctamente."
          : kind === "cancel"
            ? "Reserva cancelada correctamente."
            : "Libro eliminado de tu lista.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible completar la operación.",
      );
    } finally {
      setPendingId("");
    }
  };

  return (
    <div className="account-page">
      <section className="page-intro account-intro">
        <div className="container account-heading">
          <div>
            <span className="eyebrow">MI ESPACIO</span>
            <h1>Mi biblioteca</h1>
            <p>
              Hola, {session.user.email}. Aquí tienes tus lecturas y
              solicitudes.
            </p>
          </div>
          <button
            className="signout-button"
            type="button"
            onClick={() =>
              void signOut().catch((cause: unknown) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "No se pudo cerrar sesión.",
                ),
              )
            }
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </section>
      <div className="container account-content">
        <div className="account-stats">
          <div>
            <span className="stats-icon">
              <BookOpen size={20} />
            </span>
            <strong>{activeLoans.length}</strong>
            <small>Préstamos activos</small>
          </div>
          <div>
            <span className="stats-icon">
              <Clock3 size={20} />
            </span>
            <strong>{waitingReservations.length}</strong>
            <small>Reservas pendientes</small>
          </div>
          <div>
            <span className="stats-icon">
              <BookMarked size={20} />
            </span>
            <strong>{reading.length}</strong>
            <small>En mi lista</small>
          </div>
        </div>
        {error && (
          <p className="inline-message error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="inline-message success" role="status">
            {message}
          </p>
        )}
        <div
          className="account-tabs"
          role="tablist"
          aria-label="Secciones de mi biblioteca"
        >
          <button
            id="tab-loans"
            ref={(button) => {
              tabButtons.current.loans = button;
            }}
            tabIndex={tab === "loans" ? 0 : -1}
            onKeyDown={(event) => navigateTabs(event, "loans")}
            role="tab"
            aria-selected={tab === "loans"}
            aria-controls="panel-account"
            type="button"
            className={tab === "loans" ? "active" : ""}
            onClick={() => setTab("loans")}
          >
            Préstamos <span>{loans.length}</span>
          </button>
          <button
            id="tab-reservations"
            ref={(button) => {
              tabButtons.current.reservations = button;
            }}
            tabIndex={tab === "reservations" ? 0 : -1}
            onKeyDown={(event) => navigateTabs(event, "reservations")}
            role="tab"
            aria-selected={tab === "reservations"}
            aria-controls="panel-account"
            type="button"
            className={tab === "reservations" ? "active" : ""}
            onClick={() => setTab("reservations")}
          >
            Reservas <span>{reservations.length}</span>
          </button>
          <button
            id="tab-reading"
            ref={(button) => {
              tabButtons.current.reading = button;
            }}
            tabIndex={tab === "reading" ? 0 : -1}
            onKeyDown={(event) => navigateTabs(event, "reading")}
            role="tab"
            aria-selected={tab === "reading"}
            aria-controls="panel-account"
            type="button"
            className={tab === "reading" ? "active" : ""}
            onClick={() => setTab("reading")}
          >
            Lista de lectura <span>{reading.length}</span>
          </button>
        </div>
        <div
          id="panel-account"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`tab-${tab}`}
          className="account-panel"
        >
          {loading ? (
            <p role="status">Cargando tus datos…</p>
          ) : tab === "loans" ? (
            loans.length ? (
              <div className="account-list">
                {loans.map((loan) => (
                  <AccountRow
                    key={loan.id}
                    item={loan}
                    meta={
                      <>
                        <CalendarClock size={15} />{" "}
                        {loan.returned_at
                          ? `Devuelto el ${formatDate(loan.returned_at)}`
                          : `Entrega: ${formatDate(loan.due_at)}`}
                      </>
                    }
                    badge={
                      loan.returned_at
                        ? "Devuelto"
                        : Date.parse(loan.due_at) < openedAt
                          ? "Vencido"
                          : "Activo"
                    }
                    action={
                      !loan.returned_at && (
                        <button
                          type="button"
                          disabled={Boolean(pendingId)}
                          onClick={() => void perform("return", loan.id)}
                        >
                          <CheckCircle2 size={16} />{" "}
                          {pendingId === loan.id
                            ? "Procesando…"
                            : "Registrar devolución"}
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Aún no tienes préstamos"
                description="Explora la colección y encuentra un libro disponible para llevar contigo."
              />
            )
          ) : tab === "reservations" ? (
            reservations.length ? (
              <div className="account-list">
                {reservations.map((reservation) => (
                  <AccountRow
                    key={reservation.id}
                    item={reservation}
                    meta={
                      <>
                        <Clock3 size={15} /> Solicitado el{" "}
                        {formatDate(reservation.created_at)}
                      </>
                    }
                    badge={
                      reservation.status === "waiting"
                        ? "En espera"
                        : reservation.status === "fulfilled"
                          ? "Atendida"
                          : "Cancelada"
                    }
                    action={
                      reservation.status === "waiting" && (
                        <button
                          type="button"
                          disabled={Boolean(pendingId)}
                          onClick={() => void perform("cancel", reservation.id)}
                        >
                          <XCircle size={16} />{" "}
                          {pendingId === reservation.id
                            ? "Procesando…"
                            : "Cancelar reserva"}
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No hay reservas"
                description="Si un libro de la colección está prestado, podrás reservarlo desde su ficha."
              />
            )
          ) : reading.length ? (
            <div className="account-list">
              {reading.map((item) => (
                <AccountRow
                  key={item.work_id}
                  item={item}
                  meta={
                    <>
                      <BookMarked size={15} />{" "}
                      {item.status === "want_to_read"
                        ? "Quiero leer"
                        : item.status === "reading"
                          ? "Leyendo"
                          : "Terminado"}
                    </>
                  }
                  badge={formatDate(item.updated_at)}
                  action={
                    <button
                      type="button"
                      disabled={Boolean(pendingId)}
                      onClick={() => void perform("remove", item.work_id)}
                    >
                      <XCircle size={16} />{" "}
                      {pendingId === item.work_id
                        ? "Procesando…"
                        : "Quitar de mi lista"}
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Tu lista está vacía"
              description="Abre la ficha de un libro y guárdalo como próximo, actual o terminado."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  item,
  meta,
  badge,
  action,
}: {
  item: {
    work_id: string;
    title: string;
    author: string;
    cover_id: number | null;
  };
  meta: React.ReactNode;
  badge: string;
  action?: React.ReactNode;
}) {
  const cover = coverUrl(item.cover_id);
  return (
    <article className="account-row">
      <div className="account-row-cover">
        {cover ? (
          <img src={cover} alt="" loading="lazy" />
        ) : (
          <BookOpen size={26} />
        )}
      </div>
      <div className="account-row-info">
        <Link to={`/libro/${item.work_id}`}>{item.title}</Link>
        <p>{item.author}</p>
        <span>{meta}</span>
      </div>
      <div className="account-row-end">
        <span className="account-badge">{badge}</span>
        {action}
      </div>
    </article>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link className="button button-primary" to="/catalogo">
        Explorar catálogo <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export default AccountPage;
