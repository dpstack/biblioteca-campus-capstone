import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SiteLayout } from "../../src/components/SiteLayout";
import { AuthContext } from "../../src/context/auth-context";
jest.mock("../../src/lib/config", () => ({ isSupabaseConfigured: true }));
function show(session = null) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ session, isLoading: false, signOut: jest.fn() }}
      >
        <SiteLayout />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
test("el menú se abre y se cierra al navegar", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await user.click(screen.getByRole("link", { name: "Explorar catálogo" }));
  expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
test("el acceso lleva al formulario si no hay sesión", () => {
  show();
  expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
    "href",
    "/acceso",
  );
});
test("la sesión activa lleva a la cuenta", () => {
  show({ user: { id: "student" } } as any);
  expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute(
    "href",
    "/mi-biblioteca",
  );
});

test("Escape cierra el menú desde su botón y devuelve el foco", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "Abrir menú" }));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
