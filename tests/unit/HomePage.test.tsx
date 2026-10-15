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

test("an empty response stops loading and offers catalog exploration", async () => {
  (searchBooks as jest.Mock).mockResolvedValue({ books: [], total: 0 });
  show();
  expect(
    await screen.findByText(/No featured books are available/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading featured books" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Explore the catalog" }),
  ).toHaveAttribute("href", "/catalog");
});
test("works without covers also show the empty state", async () => {
  (searchBooks as jest.Mock).mockResolvedValue({
    books: [{ id: "OL1W", title: "No cover", coverId: null }],
    total: 1,
  });
  show();
  await screen.findByText(/No featured books are available/);
  expect(
    screen.queryByRole("status", { name: "Loading featured books" }),
  ).not.toBeInTheDocument();
});
test("an API failure shows a message and allows continuing to the catalog", async () => {
  (searchBooks as jest.Mock).mockRejectedValue(
    new Error("Books could not be loaded."),
  );
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Books could not be loaded.",
  );
  expect(screen.getByRole("link", { name: "Go to catalog" })).toHaveAttribute(
    "href",
    "/catalog",
  );
  expect(
    screen.queryByRole("status", { name: "Loading featured books" }),
  ).not.toBeInTheDocument();
});
