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
      <MemoryRouter initialEntries={["/books/OL1W"]}>
        <Routes>
          <Route path="/books/:workId" element={<BookPage />} />
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
    subjects: ["Fiction"],
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
test("requests a loan and updates availability", async () => {
  (library.getInventory as jest.Mock)
    .mockResolvedValueOnce([
      { work_id: "OL1W", total_copies: 1, available_copies: 1 },
    ])
    .mockResolvedValue([
      { work_id: "OL1W", total_copies: 1, available_copies: 0 },
    ]);
  const user = userEvent.setup();
  show();
  await user.click(await screen.findByRole("button", { name: "Borrow book" }));
  expect(await screen.findByText(/Loan registered/)).toBeInTheDocument();
  expect(library.borrowBook).toHaveBeenCalledWith({
    work_id: "OL1W",
    title: "Campus",
    author: "Ana",
    cover_id: null,
  });
  expect(await screen.findByText("All copies are on loan")).toBeInTheDocument();
});
test("reserves an unavailable work and shows confirmation", async () => {
  (library.getInventory as jest.Mock).mockResolvedValue([
    { work_id: "OL1W", total_copies: 1, available_copies: 0 },
  ]);
  const user = userEvent.setup();
  show();
  await user.click(await screen.findByRole("button", { name: "Reserve book" }));
  expect(await screen.findByText(/Reservation registered/)).toBeInTheDocument();
  expect(library.reserveBook).toHaveBeenCalled();
});
test("reports a queue rejection without claiming a successful loan", async () => {
  (library.borrowBook as jest.Mock).mockRejectedValue(
    new Error("Reservado para otra persona"),
  );
  const user = userEvent.setup();
  show();
  await user.click(await screen.findByRole("button", { name: "Borrow book" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Reservado para otra persona",
  );
  expect(screen.queryByText(/Loan registered/)).not.toBeInTheDocument();
});
test("works outside the collection offer no loans and metadata renders as text", async () => {
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
  await screen.findByText("Outside the collection");
  expect(
    screen.queryByRole("button", { name: /Borrow book|Reserve book/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "<img src=x onerror=alert(1)>",
  );
  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector("img")).toBeNull();
});
