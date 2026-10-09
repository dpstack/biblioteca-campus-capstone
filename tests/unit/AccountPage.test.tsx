import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AccountPage from "../../src/pages/AccountPage";
import { AuthContext } from "../../src/context/auth-context";
import * as library from "../../src/lib/library";
jest.mock("../../src/lib/library", () => ({
  getMyLoans: jest.fn(),
  getMyReservations: jest.fn(),
  getMyReadingList: jest.fn(),
  returnBook: jest.fn(),
  cancelReservation: jest.fn(),
  removeReadingItem: jest.fn(),
}));
const snapshot = {
  work_id: "OL1W",
  title: "Campus",
  author: "Ana",
  cover_id: null,
};
const loan = {
  ...snapshot,
  id: "loan-1",
  borrowed_at: "2026-10-09T12:00:00Z",
  due_at: "2026-10-23T12:00:00Z",
  returned_at: null,
};
const reservation = {
  ...snapshot,
  id: "reservation-1",
  created_at: "2026-10-09T12:00:00Z",
  status: "waiting",
};
function show(
  session: any = { user: { id: "student", email: "ana@example.com" } },
) {
  render(
    <AuthContext.Provider
      value={{
        session,
        isLoading: false,
        signOut: jest.fn().mockResolvedValue(undefined),
      }}
    >
      <MemoryRouter initialEntries={["/mi-biblioteca"]}>
        <Routes>
          <Route path="/mi-biblioteca" element={<AccountPage />} />
          <Route path="/acceso" element={<h1>Acceso</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  (library.getMyLoans as jest.Mock).mockResolvedValue([]);
  (library.getMyReservations as jest.Mock).mockResolvedValue([]);
  (library.getMyReadingList as jest.Mock).mockResolvedValue([]);
  (library.returnBook as jest.Mock).mockResolvedValue(undefined);
  (library.cancelReservation as jest.Mock).mockResolvedValue(undefined);
  (library.removeReadingItem as jest.Mock).mockResolvedValue(undefined);
});
test("las pestañas admiten flechas, Home y End y una sola parada con Tab", async () => {
  const user = userEvent.setup();
  show();
  await screen.findByText("Aún no tienes préstamos");
  const loans = screen.getByRole("tab", { name: /Préstamos/ });
  await user.click(loans);
  await user.keyboard("{ArrowRight}");
  const reservations = screen.getByRole("tab", { name: /Reservas/ });
  expect(reservations).toHaveFocus();
  expect(reservations).toHaveAttribute("aria-selected", "true");
  expect(loans).toHaveAttribute("tabindex", "-1");
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: /Lista de lectura/ })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(loans).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: /Lista de lectura/ })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(loans).toHaveFocus();
});
test("devuelve un préstamo y muestra el historial actualizado", async () => {
  (library.getMyLoans as jest.Mock)
    .mockResolvedValueOnce([loan])
    .mockResolvedValue([{ ...loan, returned_at: "2026-10-09T13:00:00Z" }]);
  const user = userEvent.setup();
  show();
  await user.click(
    await screen.findByRole("button", { name: "Registrar devolución" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Devolución registrada",
  );
  expect(library.returnBook).toHaveBeenCalledWith("loan-1");
  expect(screen.getByText("Devuelto")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Registrar devolución" }),
  ).not.toBeInTheDocument();
});
test("cancela una reserva y conserva su historial", async () => {
  (library.getMyReservations as jest.Mock)
    .mockResolvedValueOnce([reservation])
    .mockResolvedValue([{ ...reservation, status: "cancelled" }]);
  const user = userEvent.setup();
  show();
  await screen.findByText("Aún no tienes préstamos");
  await user.click(screen.getByRole("tab", { name: /Reservas/ }));
  await user.click(screen.getByRole("button", { name: "Cancelar reserva" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Reserva cancelada",
  );
  expect(library.cancelReservation).toHaveBeenCalledWith("reservation-1");
  expect(screen.getByText("Cancelada")).toBeInTheDocument();
});
test("quita una lectura del panel y actualiza la lista", async () => {
  (library.getMyReadingList as jest.Mock)
    .mockResolvedValueOnce([
      { ...snapshot, status: "reading", updated_at: "2026-10-09T12:00:00Z" },
    ])
    .mockResolvedValue([]);
  const user = userEvent.setup();
  show();
  await screen.findByText("Aún no tienes préstamos");
  await user.click(screen.getByRole("tab", { name: /Lista de lectura/ }));
  await user.click(screen.getByRole("button", { name: "Quitar de mi lista" }));
  expect(await screen.findByText("Tu lista está vacía")).toBeInTheDocument();
  expect(library.removeReadingItem).toHaveBeenCalledWith("OL1W");
});
test("una devolución rechazada conserva el préstamo activo", async () => {
  (library.getMyLoans as jest.Mock).mockResolvedValue([loan]);
  (library.returnBook as jest.Mock).mockRejectedValue(
    new Error("No autorizado"),
  );
  const user = userEvent.setup();
  show();
  await user.click(
    await screen.findByRole("button", { name: "Registrar devolución" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("No autorizado");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Registrar devolución" }),
    ).toBeEnabled(),
  );
  expect(screen.getByText("Activo")).toBeInTheDocument();
});
test("sin sesión redirige y no consulta datos privados", async () => {
  show(null);
  await screen.findByRole("heading", { name: "Acceso" });
  expect(library.getMyLoans).not.toHaveBeenCalled();
});
