import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../src/context/AuthContext";
import { useAuth } from "../../src/context/auth-context";
import { supabase } from "../../src/lib/supabase";
jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));
const auth = supabase!.auth;
let notify;
const unsubscribe = jest.fn();
beforeEach(() => {
  (auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: null },
    error: null,
  });
  (auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
    notify = callback;
    return { data: { subscription: { unsubscribe } } };
  });
});
test("restores the session, handles changes, and cleans up the subscription", async () => {
  const session = { user: { id: "student" }, access_token: "test-token" };
  (auth.getSession as jest.Mock).mockResolvedValue({
    data: { session },
    error: null,
  });
  const { result, unmount } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.session).toEqual(session);
  act(() => notify("SIGNED_OUT", null));
  expect(result.current.session).toBeNull();
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
test("a network failure does not leave session restoration loading indefinitely", async () => {
  (auth.getSession as jest.Mock).mockRejectedValue(new Error("Offline"));
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.session).toBeNull();
});
test("sign-out clears the session and propagates failures", async () => {
  (auth.signOut as jest.Mock).mockResolvedValue({ error: null });
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => {
    await result.current.signOut();
  });
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(result.current.session).toBeNull();
  (auth.signOut as jest.Mock).mockResolvedValue({
    error: new Error("No se pudo cerrar"),
  });
  await expect(result.current.signOut()).rejects.toThrow("No se pudo cerrar");
});
test("a recent auth event takes precedence over slow initial restoration", async () => {
  let resolve;
  (auth.getSession as jest.Mock).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(auth.getSession).toHaveBeenCalled());
  act(() => notify("SIGNED_OUT", null));
  await act(async () =>
    resolve({ data: { session: { access_token: "obsolete" } }, error: null }),
  );
  expect(result.current.session).toBeNull();
});
