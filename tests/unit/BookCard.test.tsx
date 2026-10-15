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
test("opens book details and shows author and availability", () => {
  show({}, 1);
  expect(
    screen.getByRole("link", { name: "View details of El campus" }),
  ).toHaveAttribute("href", "/books/OL1W");
  expect(screen.getByText("Ana")).toBeInTheDocument();
  expect(screen.getByText("Available")).toBeInTheDocument();
});
test("distinguishes an on-loan book from metadata without inventory", () => {
  const { unmount } = show({}, 0);
  expect(screen.getByText("On loan")).toBeInTheDocument();
  unmount();
  show({ authors: [], firstPublishYear: null });
  expect(screen.getByText("Unknown author")).toBeInTheDocument();
  expect(screen.getByText(/Publication date unavailable/)).toBeInTheDocument();
  expect(screen.queryByText("Available")).not.toBeInTheDocument();
});
test("a broken cover does not prevent viewing the book", () => {
  show();
  fireEvent.error(screen.getByRole("img"));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View book" })).toHaveAttribute(
    "href",
    "/books/OL1W",
  );
});
