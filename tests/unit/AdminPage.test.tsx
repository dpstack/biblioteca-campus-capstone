import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminPage from "../../src/pages/AdminPage";
import { AuthContext } from "../../src/context/auth-context";
import * as admin from "../../src/lib/admin";
import * as open from "../../src/lib/openLibrary";
jest.mock("../../src/lib/admin", () => ({
  getAdminDashboard: jest.fn(),
  saveAdminBook: jest.fn(),
}));
jest.mock("../../src/lib/openLibrary", () => ({
  searchBooks: jest.fn(),
  getWork: jest.fn(),
}));
const book = {
  work_id: "OL1W",
  title: "Biblioteca",
  author: "Ana",
  cover_id: null,
  total_copies: 2,
  available_copies: 1,
  retired: false,
};
const dashboard = {
  books: [book],
  loans: [
    {
      ...book,
      id: "loan",
      email: "reader@example.invalid",
      borrowed_at: "2026-10-09",
      due_at: "2026-10-23",
      returned_at: null,
    },
  ],
  reservations: [],
};
function show(session: any = { user: { id: "admin" } }) {
  render(
    <AuthContext.Provider
      value={{ session, isLoading: false, signOut: jest.fn() }}
    >
      <MemoryRouter initialEntries={["/administracion"]}>
        <Routes>
          <Route path="/administracion" element={<AdminPage />} />
          <Route path="/acceso" element={<h1>Acceso</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  (admin.getAdminDashboard as jest.Mock).mockResolvedValue(dashboard);
  (admin.saveAdminBook as jest.Mock).mockResolvedValue(undefined);
  (open.searchBooks as jest.Mock).mockResolvedValue({
    books: [{ id: "OL2W", title: "Nueva obra", authors: ["Eva"], coverId: 2 }],
    total: 1,
  });
});
test("sin sesión dirige al acceso y no consulta información administrativa", async () => {
  show(null);
  expect(await screen.findByRole("heading", { name: "Acceso" })).toBeVisible();
  expect(admin.getAdminDashboard).not.toHaveBeenCalled();
});
test("denegación del backend no revela controles ni circulación", async () => {
  (admin.getAdminDashboard as jest.Mock).mockRejectedValue(
    new Error("Acceso exclusivo para administradores."),
  );
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("exclusivo");
  expect(
    screen.queryByRole("button", { name: "Buscar libros" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("reader@example.invalid")).not.toBeInTheDocument();
});
test("buscar, añadir ejemplares y guardar recarga la colección", async () => {
  const user = userEvent.setup();
  show();
  await user.type(
    await screen.findByLabelText("Título, autor o palabra clave"),
    "Nueva obra",
  );
  await user.click(screen.getByRole("button", { name: "Buscar libros" }));
  await user.click(
    await screen.findByRole("button", { name: "Gestionar OL2W" }),
  );
  const copies = screen.getByLabelText("Total de ejemplares");
  await user.clear(copies);
  await user.type(copies, "3");
  await user.click(screen.getByRole("button", { name: "Guardar inventario" }));
  await waitFor(() =>
    expect(admin.saveAdminBook).toHaveBeenCalledWith(
      {
        work_id: "OL2W",
        title: "Nueva obra",
        author: "Eva",
        cover_id: 2,
        total: 3,
        retired: false,
      },
      3,
      false,
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Inventario guardado",
  );
  expect(admin.getAdminDashboard).toHaveBeenCalledTimes(2);
});
test("retirar usa el backend y conserva editor si hay reservas pendientes", async () => {
  const user = userEvent.setup();
  (admin.saveAdminBook as jest.Mock).mockRejectedValue(
    new Error("Resuelve las reservas pendientes antes de retirar la obra."),
  );
  show();
  await user.click(await screen.findByRole("button", { name: "Editar OL1W" }));
  await user.click(
    screen.getByLabelText("Retirar de nuevos préstamos y reservas"),
  );
  await user.click(screen.getByRole("button", { name: "Guardar inventario" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "reservas pendientes",
  );
  expect(
    screen.getByLabelText("Retirar de nuevos préstamos y reservas"),
  ).toBeChecked();
  expect(
    screen.getByRole("button", { name: "Guardar inventario" }),
  ).toBeEnabled();
});
