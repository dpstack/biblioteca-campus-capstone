import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthPage } from "../../src/pages/AuthPage";
import { AuthContext } from "../../src/context/auth-context";
import { supabase } from "../../src/lib/supabase";
jest.mock("../../src/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { signInWithPassword: jest.fn(), signUp: jest.fn() } },
}));
function show() {
  render(
    <AuthContext.Provider
      value={{ session: null, isLoading: false, signOut: jest.fn() }}
    >
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/my-library" element={<h1>My loans</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
async function fill(user) {
  await user.type(screen.getByLabelText("Email address"), "ana@campus.edu");
  await user.type(screen.getByLabelText("Password"), "password123");
}
test("submits credentials and opens the library after sign-in", async () => {
  (supabase!.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    error: null,
  });
  show();
  const user = userEvent.setup();
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByRole("heading", { name: "My loans" }),
  ).toBeInTheDocument();
  expect(supabase!.auth.signInWithPassword).toHaveBeenCalledWith({
    email: "ana@campus.edu",
    password: "password123",
  });
});
test("shows rejected credentials and allows retrying", async () => {
  (supabase!.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    error: new Error("Invalid credentials"),
  });
  show();
  const user = userEvent.setup();
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid credentials",
  );
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(screen.queryByText("My loans")).not.toBeInTheDocument();
});
test("registration without a session requires email confirmation", async () => {
  (supabase!.auth.signUp as jest.Mock).mockResolvedValue({
    data: { session: null },
    error: null,
  });
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Sign up" }));
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Check your email",
  );
  expect(screen.queryByText("My loans")).not.toBeInTheDocument();
});
