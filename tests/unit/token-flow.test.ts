/** @jest-environment node */
import { createClient } from "@supabase/supabase-js";

test("login almacena la sesión, REST envía Bearer y logout elimina los tokens", async () => {
  const storage = new Map<string, string>();
  const request = jest.fn(async (input, options) => {
    const url = String(input);
    if (url.includes("/auth/v1/token")) {
      return new Response(
        JSON.stringify({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          user: { id: "student", email: "ana@campus.edu" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/rest/v1/loans")) {
      expect(new Headers(options.headers).get("Authorization")).toBe(
        "Bearer test-access-token",
      );
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/auth/v1/logout"))
      return new Response(null, { status: 204 });
    throw new Error(`Solicitud inesperada: ${url}`);
  });
  const client = createClient("https://test.supabase.co", "publishable-test", {
    global: { fetch: request },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    },
  });
  const login = await client.auth.signInWithPassword({
    email: "ana@campus.edu",
    password: "password123",
  });
  expect(login.error).toBeNull();
  expect(storage.size).toBeGreaterThan(0);
  const result = await client.from("loans").select("*");
  expect(result.error).toBeNull();
  expect(result.data).toEqual([]);
  expect((await client.auth.signOut()).error).toBeNull();
  expect((await client.auth.getSession()).data.session).toBeNull();
  expect(storage.size).toBe(0);
});
