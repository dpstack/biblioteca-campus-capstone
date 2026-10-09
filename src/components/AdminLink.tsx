import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth-context";
export function AdminLink({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [allowedFor, setAllowedFor] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (userId)
      void import("../lib/admin")
        .then((module) => module.isAdmin())
        .then((allowed) => {
          if (active) setAllowedFor(allowed ? userId : null);
        })
        .catch(() => {
          if (active) setAllowedFor(null);
        });
    return () => {
      active = false;
    };
  }, [userId]);
  return userId && allowedFor === userId ? (
    <Link className="nav-link" to="/administracion" onClick={onNavigate}>
      Administración
    </Link>
  ) : null;
}
