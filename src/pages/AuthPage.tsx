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

  if (!isLoading && session) return <Navigate to="/my-library" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
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
        if (data.session) navigate("/my-library");
        else
          setMessage(
            "Account created. Check your email to confirm your address and sign in.",
          );
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        navigate("/my-library");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container auth-grid">
        <div className="auth-story">
          <span className="eyebrow light">YOUR READING SPACE</span>
          <h1>Make knowledge your own.</h1>
          <p>
            Create an account to track your reading, borrow books, and reserve
            your next read.
          </p>
          <div className="auth-points">
            <span>
              <ShieldCheck size={18} /> Your information, protected
            </span>
            <span>
              <BookIcon /> Your books, all in one place
            </span>
          </div>
        </div>
        <div className="auth-card">
          <span className="auth-icon">
            <LockKeyhole size={22} />
          </span>
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "signin"
              ? "Sign in to continue to your library."
              : "Start organizing your next read."}
          </p>
          {!isSupabaseConfigured ? (
            <div className="inline-message">
              <strong>Supabase is not connected.</strong>
              <p>
                First create a Supabase project and configure the variables in{" "}
                <code>.env.local</code>. See the project README for setup
                instructions.
              </p>
              <Link to="/catalog">
                Meanwhile, explore the catalog <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={(event) => void submit(event)}>
                <label htmlFor="auth-email">Email address</label>
                <div className="input-with-icon">
                  <Mail size={17} />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    placeholder="you@university.edu"
                  />
                </div>
                <label htmlFor="auth-password">Password</label>
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
                    placeholder="At least 8 characters"
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
                    ? "Please wait…"
                    : mode === "signin"
                      ? "Sign in"
                      : "Create account"}{" "}
                  <ArrowRight size={17} />
                </button>
              </form>
              <p className="auth-switch">
                {mode === "signin"
                  ? "Don't have an account?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError("");
                    setMessage("");
                  }}
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
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
