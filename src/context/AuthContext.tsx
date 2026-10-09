import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthContext, type AuthValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    let unsubscribe = () => {};
    import("../lib/supabase")
      .then(({ supabase }) => {
        if (!active) return;
        if (!supabase) {
          setIsLoading(false);
          return;
        }
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (active) {
            authChanged = true;
            setSession(nextSession);
            setIsLoading(false);
          }
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession().then(({ data, error }) => {
          if (active && !authChanged) {
            setSession(error ? null : data.session);
            setIsLoading(false);
          }
        });
      })
      .catch(() => {
        if (active && !authChanged) {
          setSession(null);
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      isLoading,
      signOut: async () => {
        const { supabase } = await import("../lib/supabase");
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
      },
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
