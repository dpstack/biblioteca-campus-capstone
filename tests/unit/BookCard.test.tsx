import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BookCard } from "../../src/components/BookCard";

const book = {
  id: "OL1W",
  title: "El campus",
  authors: ["Ana"],
  firstPublishYear: 2020,
  coverId: 123,
  subjects: [],
  editionCount: 2,
};
function show(overrides = {}, copies?: number) {
  return render(
    <MemoryRouter>
      <BookCard
        book={{ ...book, ...overrides }}
        inventory={
          copies === undefined
            ? undefined
            : { work_id: book.id, available_copies: copies, total_copies: 2 }
        }
      />
    </MemoryRouter>,
  );
}
test("permite abrir la ficha y muestra autor y disponibilidad", () => {
  show({}, 1);
  expect(
    screen.getByRole("link", { name: "Ver detalles de El campus" }),
  ).toHaveAttribute("href", "/libro/OL1W");
  expect(screen.getByText("Ana")).toBeInTheDocument();
  expect(screen.getByText("Disponible")).toBeInTheDocument();
});
test("distingue un libro prestado de metadatos sin inventario", () => {
  const { unmount } = show({}, 0);
  expect(screen.getByText("En préstamo")).toBeInTheDocument();
  unmount();
  show({ authors: [], firstPublishYear: null });
  expect(screen.getByText("Autor no indicado")).toBeInTheDocument();
  expect(screen.getByText(/Edición sin fecha/)).toBeInTheDocument();
  expect(screen.queryByText("Disponible")).not.toBeInTheDocument();
});
test("una portada rota no impide consultar el libro", () => {
  show();
  fireEvent.error(screen.getByRole("img"));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver libro" })).toHaveAttribute(
    "href",
    "/libro/OL1W",
  );
});
