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

test("the filter restricts search before pagination, preserves other filters, and can be disabled", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={["/catalog?q=Campus&category=science&sort=newest&page=2"]}
    >
      <CatalogPage />
    </MemoryRouter>,
  );
  await screen.findByText("Page 2 of 2");
  await user.click(
    screen.getByRole("checkbox", { name: "Available to borrow" }),
  );
  await screen.findByText("Page 1 of 2");
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
  expect(await screen.findByText("Available")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Page 2 of 2");
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2, workIds: ["OL1W"] }),
    expect.any(AbortSignal),
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Available to borrow" }),
  );
  await screen.findByText("Page 1 of 2");
  expect(
    (searchBooks as jest.Mock).mock.calls.at(-1)[0].workIds,
  ).toBeUndefined();
});

test("an inventory error is not shown as an empty collection and allows retrying", async () => {
  (getAvailableInventory as jest.Mock).mockRejectedValueOnce(
    new Error("Inventory disconnected"),
  );
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalog?available=1"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Inventory disconnected",
  );
  expect(searchBooks).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("heading", { name: "Campus" });
  expect(screen.getByRole("checkbox")).toBeChecked();
});
test("the selected order survives paging and category changes", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalog?q=Campus"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Campus" });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Sort by:" }),
    "newest",
  );
  await waitFor(() =>
    expect(searchBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: "newest" }),
      expect.any(AbortSignal),
    ),
  );
  await user.click(await screen.findByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(searchBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, sort: "newest" }),
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getByRole("combobox", { name: "Sort by:" })).toHaveValue(
    "newest",
  );
  await user.click(screen.getByRole("button", { name: /Science/ }));
  await waitFor(() =>
    expect(searchBooks).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, category: "science", sort: "newest" }),
      expect.any(AbortSignal),
    ),
  );
});
test("navigation continues past page 1000", async () => {
  (searchBooks as jest.Mock).mockResolvedValue({ books: [book], total: 48000 });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalog?page=1001&sort=popularity"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  await screen.findByText("Page 1001 of 2000");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Page 1002 of 2000");
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1002, sort: "popularity" }),
    expect.any(AbortSignal),
  );
});
test("errors allow retrying without losing the search", async () => {
  (searchBooks as jest.Mock)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({ books: [book], total: 1 });
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/catalog?q=Campus&sort=oldest"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("heading", { name: "Campus" });
  expect(searchBooks).toHaveBeenLastCalledWith(
    expect.objectContaining({ term: "Campus", sort: "oldest" }),
    expect.any(AbortSignal),
  );
});
