import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../src/pages/HomePage";
import { searchBooks } from "../../src/lib/openLibrary";
jest.mock("../../src/lib/openLibrary", () => ({
  searchBooks: jest.fn(),
  coverUrl: () => null,
}));
const show = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

test("una respuesta vacía termina la carga y ofrece explorar el catálogo", async () => {
  (searchBooks as jest.Mock).mockResolvedValue({ books: [], total: 0 });
  show();
  expect(
    await screen.findByText(/No hay destacados disponibles/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Cargando libros destacados" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Explorar el catálogo" }),
  ).toHaveAttribute("href", "/catalogo");
});
test("un catálogo con obras sin portada también muestra el estado vacío", async () => {
  (searchBooks as jest.Mock).mockResolvedValue({
    books: [{ id: "OL1W", title: "Sin portada", coverId: null }],
    total: 1,
  });
  show();
  await screen.findByText(/No hay destacados disponibles/);
  expect(
    screen.queryByRole("status", { name: "Cargando libros destacados" }),
  ).not.toBeInTheDocument();
});
test("un fallo de la API muestra un mensaje y permite continuar al catálogo", async () => {
  (searchBooks as jest.Mock).mockRejectedValue(
    new Error("No se pudieron cargar los libros."),
  );
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudieron cargar los libros.",
  );
  expect(screen.getByRole("link", { name: "Ir al catálogo" })).toHaveAttribute(
    "href",
    "/catalogo",
  );
  expect(
    screen.queryByRole("status", { name: "Cargando libros destacados" }),
  ).not.toBeInTheDocument();
});
