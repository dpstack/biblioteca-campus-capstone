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
      <MemoryRouter initialEntries={["/acceso"]}>
        <Routes>
          <Route path="/acceso" element={<AuthPage />} />
          <Route path="/mi-biblioteca" element={<h1>Mis préstamos</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
async function fill(user) {
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "ana@campus.edu",
  );
  await user.type(screen.getByLabelText("Contraseña"), "password123");
}
test("envía las credenciales y abre la biblioteca después del login", async () => {
  (supabase!.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    error: null,
  });
  show();
  const user = userEvent.setup();
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(
    await screen.findByRole("heading", { name: "Mis préstamos" }),
  ).toBeInTheDocument();
  expect(supabase!.auth.signInWithPassword).toHaveBeenCalledWith({
    email: "ana@campus.edu",
    password: "password123",
  });
});
test("muestra un rechazo de credenciales y permite reintentar", async () => {
  (supabase!.auth.signInWithPassword as jest.Mock).mockResolvedValue({
    error: new Error("Credenciales inválidas"),
  });
  show();
  const user = userEvent.setup();
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Credenciales inválidas",
  );
  expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  expect(screen.queryByText("Mis préstamos")).not.toBeInTheDocument();
});
test("registro sin sesión requiere confirmación por correo", async () => {
  (supabase!.auth.signUp as jest.Mock).mockResolvedValue({
    data: { session: null },
    error: null,
  });
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Regístrate" }));
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Revisa tu correo",
  );
  expect(screen.queryByText("Mis préstamos")).not.toBeInTheDocument();
});
