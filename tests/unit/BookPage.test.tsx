import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { BookPage } from "../../src/pages/BookPage";
import { AuthContext } from "../../src/context/auth-context";
import { getWork } from "../../src/lib/openLibrary";
import * as library from "../../src/lib/library";
jest.mock("../../src/lib/supabase", () => ({ isSupabaseConfigured: true }));
jest.mock("../../src/lib/openLibrary", () => ({
  getWork: jest.fn(),
  coverUrl: () => null,
}));
jest.mock("../../src/lib/library", () => ({
  getInventory: jest.fn(),
  borrowBook: jest.fn(),
  reserveBook: jest.fn(),
  getReadingStatus: jest.fn(),
  setReadingStatus: jest.fn(),
  removeReadingItem: jest.fn(),
}));
function show(session: any = { user: { id: "student" } }) {
  render(
    <AuthContext.Provider
      value={{ session, isLoading: false, signOut: jest.fn() }}
    >
      <MemoryRouter initialEntries={["/libro/OL1W"]}>
        <Routes>
          <Route path="/libro/:workId" element={<BookPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  (getWork as jest.Mock).mockResolvedValue({
    id: "OL1W",
    title: "Campus",
    authors: ["Ana"],
    coverId: null,
    subjects: ["Ficción"],
    description: "Una biblioteca",
    firstPublishDate: null,
  });
  (library.getInventory as jest.Mock).mockResolvedValue([
    { work_id: "OL1W", total_copies: 1, available_copies: 1 },
  ]);
  (library.getReadingStatus as jest.Mock).mockResolvedValue(null);
  (library.borrowBook as jest.Mock).mockResolvedValue(undefined);
  (library.reserveBook as jest.Mock).mockResolvedValue(undefined);
});
test("solicita un préstamo y actualiza la disponibilidad", async () => {
  (library.getInventory as jest.Mock)
    .mockResolvedValueOnce([
      { work_id: "OL1W", total_copies: 1, available_copies: 1 },
    ])
    .mockResolvedValue([
      { work_id: "OL1W", total_copies: 1, available_copies: 0 },
    ]);
  const user = userEvent.setup();
  show();
  await user.click(
    await screen.findByRole("button", { name: "Solicitar préstamo" }),
  );
  expect(await screen.findByText(/Préstamo registrado/)).toBeInTheDocument();
  expect(library.borrowBook).toHaveBeenCalledWith({
    work_id: "OL1W",
    title: "Campus",
    author: "Ana",
    cover_id: null,
  });
  expect(
    await screen.findByText("Todos los ejemplares prestados"),
  ).toBeInTheDocument();
});
test("reserva una obra agotada y muestra confirmación", async () => {
  (library.getInventory as jest.Mock).mockResolvedValue([
    { work_id: "OL1W", total_copies: 1, available_copies: 0 },
  ]);
  const user = userEvent.setup();
  show();
  await user.click(
    await screen.findByRole("button", { name: "Reservar libro" }),
  );
  expect(await screen.findByText(/Reserva registrada/)).toBeInTheDocument();
  expect(library.reserveBook).toHaveBeenCalled();
});
test("un rechazo de la cola se comunica sin fingir un préstamo", async () => {
  (library.borrowBook as jest.Mock).mockRejectedValue(
    new Error("Reservado para otra persona"),
  );
  const user = userEvent.setup();
  show();
  await user.click(
    await screen.findByRole("button", { name: "Solicitar préstamo" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Reservado para otra persona",
  );
  expect(screen.queryByText(/Préstamo registrado/)).not.toBeInTheDocument();
});
test("fuera de colección no ofrece préstamos y los metadatos se muestran como texto", async () => {
  (library.getInventory as jest.Mock).mockResolvedValue([]);
  (getWork as jest.Mock).mockResolvedValue({
    id: "OL1W",
    title: "<img src=x onerror=alert(1)>",
    authors: ["Ana"],
    coverId: null,
    subjects: [],
    description: "<script>alert(1)</script>",
    firstPublishDate: null,
  });
  show(null);
  await screen.findByText("Fuera de la colección");
  expect(
    screen.queryByRole("button", { name: /préstamo|Reservar libro/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "<img src=x onerror=alert(1)>",
  );
  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector("img")).toBeNull();
});
