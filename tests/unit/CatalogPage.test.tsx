import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "../../src/pages/CatalogPage";
import { searchBooks } from "../../src/lib/openLibrary";
import { getInventory, getAvailableInventory } from "../../src/lib/library";
jest.mock("../../src/lib/openLibrary", () => ({
  searchBooks: jest.fn(),
  coverUrl: () => null,
}));
jest.mock("../../src/lib/library", () => ({
  getInventory: jest.fn(),
  getAvailableInventory: jest.fn(),
}));
const book = {
  id: "OL1W",
  title: "Campus",
  authors: ["Ana"],
  firstPublishYear: 2020,
  coverId: null,
  subjects: [],
  editionCount: 1,
};
beforeEach(() => {
  (searchBooks as jest.Mock).mockResolvedValue({ books: [book], total: 48 });
  (getInventory as jest.Mock).mockResolvedValue([]);
  (getAvailableInventory as jest.Mock).mockResolvedValue([
    { work_id: "OL1W", total_copies: 2, available_copies: 1, retired: false },
  ]);
});

test("el filtro restringe la búsqueda antes de paginar, conserva los otros filtros y se puede desactivar", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={[
        "/catalogo?q=Campus&category=science&sort=newest&page=2",
      ]}
    >
      <CatalogPage />
    </MemoryRouter>,
  );
  await screen.findByText("Página 2 de 2");
  await user.click(
    screen.getByRole("checkbox", { name: "Disponibles para préstamo" }),
  );
  await screen.findByText("Página 1 de 2");
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({
      term: "Campus",
      category: "science",
      sort: "newest",
      page: 1,
      workIds: ["OL1W"],
    }),
    expect.any(AbortSignal),
  );
  expect(await screen.findByText("Disponible")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Página 2 de 2");
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2, workIds: ["OL1W"] }),
    expect.any(AbortSignal),
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Disponibles para préstamo" }),
  );
  await screen.findByText("Página 1 de 2");
  expect(
    (searchBooks as jest.Mock).mock.calls.at(-1)[0].workIds,
  ).toBeUndefined();
});

test("un error de inventario no se presenta como una colección vacía y permite reintentar", async () => {
  (getAvailableInventory as jest.Mock).mockRejectedValueOnce(
    new Error("Inventario desconectado"),
  );
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalogo?available=1"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Inventario desconectado",
  );
  expect(searchBooks).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("heading", { name: "Campus" });
  expect(screen.getByRole("checkbox")).toBeChecked();
});
test("el orden elegido se conserva al avanzar y cambiar categoría", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalogo?q=Campus"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Campus" });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Ordenar:" }),
    "newest",
  );
  await waitFor(() =>
    expect(searchBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: "newest" }),
      expect.any(AbortSignal),
    ),
  );
  await user.click(await screen.findByRole("button", { name: "Siguiente" }));
  await waitFor(() =>
    expect(searchBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, sort: "newest" }),
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getByRole("combobox", { name: "Ordenar:" })).toHaveValue(
    "newest",
  );
  await user.click(screen.getByRole("button", { name: /Ciencia/ }));
  await waitFor(() =>
    expect(searchBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, category: "science", sort: "newest" }),
      expect.any(AbortSignal),
    ),
  );
});
test("la navegación continúa después de la página 1000", async () => {
  (searchBooks as jest.Mock).mockResolvedValue({ books: [book], total: 48000 });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalogo?page=1001&sort=popularity"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  await screen.findByText("Página 1001 de 2000");
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Página 1002 de 2000");
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1002, sort: "popularity" }),
    expect.any(AbortSignal),
  );
});
test("los errores permiten reintentar sin perder la búsqueda", async () => {
  (searchBooks as jest.Mock)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({ books: [book], total: 1 });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalogo?q=Campus&sort=oldest"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("heading", { name: "Campus" });
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({ term: "Campus", sort: "oldest" }),
    expect.any(AbortSignal),
  );
});
