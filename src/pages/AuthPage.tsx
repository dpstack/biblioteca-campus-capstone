import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export function AuthPage() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!isLoading && session) return <Navigate to="/mi-biblioteca" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setPending(true);
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        if (data.session) navigate("/mi-biblioteca");
        else
          setMessage(
            "Cuenta creada. Revisa tu correo para confirmar la dirección e iniciar sesión.",
          );
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        navigate("/mi-biblioteca");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible acceder. Intenta nuevamente.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container auth-grid">
        <div className="auth-story">
          <span className="eyebrow light">TU ESPACIO DE LECTURA</span>
          <h1>El conocimiento se disfruta más cuando es tuyo.</h1>
          <p>
            Crea una cuenta para seguir tus lecturas, solicitar préstamos y
            reservar los libros que te esperan.
          </p>
          <div className="auth-points">
            <span>
              <ShieldCheck size={18} /> Tu información, protegida
            </span>
            <span>
              <BookIcon /> Tus libros, en un solo lugar
            </span>
          </div>
        </div>
        <div className="auth-card">
          <span className="auth-icon">
            <LockKeyhole size={22} />
          </span>
          <h2>
            {mode === "signin" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </h2>
          <p>
            {mode === "signin"
              ? "Ingresa para continuar con tu biblioteca."
              : "Empieza a organizar tu próxima lectura."}
          </p>
          {!isSupabaseConfigured ? (
            <div className="inline-message">
              <strong>Falta conectar Supabase.</strong>
              <p>
                Primero crea un proyecto Supabase y configura las variables de{" "}
                <code>.env.local</code>. La guía está en el README del proyecto.
              </p>
              <Link to="/catalogo">
                Mientras tanto, explora el catálogo <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={(event) => void submit(event)}>
                <label htmlFor="auth-email">Correo electrónico</label>
                <div className="input-with-icon">
                  <Mail size={17} />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    placeholder="tu@universidad.edu"
                  />
                </div>
                <label htmlFor="auth-password">Contraseña</label>
                <div className="input-with-icon">
                  <LockKeyhole size={17} />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                {error && (
                  <p className="form-feedback error" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="form-feedback success" role="status">
                    {message}
                  </p>
                )}
                <button
                  className="button button-primary auth-submit"
                  type="submit"
                  disabled={pending}
                >
                  {pending
                    ? "Un momento…"
                    : mode === "signin"
                      ? "Iniciar sesión"
                      : "Crear cuenta"}{" "}
                  <ArrowRight size={17} />
                </button>
              </form>
              <p className="auth-switch">
                {mode === "signin"
                  ? "¿Aún no tienes cuenta?"
                  : "¿Ya tienes cuenta?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError("");
                    setMessage("");
                  }}
                >
                  {mode === "signin" ? "Regístrate" : "Inicia sesión"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BookIcon() {
  return <span aria-hidden="true">▣</span>;
}
