import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export interface AuthValue {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
