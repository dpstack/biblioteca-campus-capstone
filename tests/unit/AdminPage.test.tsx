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
  title: "Library",
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
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  (admin.getAdminDashboard as jest.Mock).mockResolvedValue(dashboard);
  (admin.saveAdminBook as jest.Mock).mockResolvedValue(undefined);
  (open.searchBooks as jest.Mock).mockResolvedValue({
    books: [{ id: "OL2W", title: "New work", authors: ["Eva"], coverId: 2 }],
    total: 1,
  });
});
test("redirects signed-out visitors without querying administrative data", async () => {
  show(null);
  expect(await screen.findByRole("heading", { name: "Login" })).toBeVisible();
  expect(admin.getAdminDashboard).not.toHaveBeenCalled();
});
test("backend denial reveals no controls or circulation", async () => {
  (admin.getAdminDashboard as jest.Mock).mockRejectedValue(
    new Error("Login exclusivo para administradores."),
  );
  show();
  expect(await screen.findByRole("alert")).toHaveTextContent("exclusivo");
  expect(
    screen.queryByRole("button", { name: "Search books" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("reader@example.invalid")).not.toBeInTheDocument();
});
test("searching, adding copies, and saving refreshes the collection", async () => {
  const user = userEvent.setup();
  show();
  await user.type(
    await screen.findByLabelText("Title, author, or keyword"),
    "New work",
  );
  await user.click(screen.getByRole("button", { name: "Search books" }));
  await user.click(await screen.findByRole("button", { name: "Manage OL2W" }));
  const copies = screen.getByLabelText("Total copies");
  await user.clear(copies);
  await user.type(copies, "3");
  await user.click(screen.getByRole("button", { name: "Save inventory" }));
  await waitFor(() =>
    expect(admin.saveAdminBook).toHaveBeenCalledWith(
      {
        work_id: "OL2W",
        title: "New work",
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
    "Inventory saved",
  );
  expect(admin.getAdminDashboard).toHaveBeenCalledTimes(2);
});
test("retirement uses the backend and preserves the editor when reservations are pending", async () => {
  const user = userEvent.setup();
  (admin.saveAdminBook as jest.Mock).mockRejectedValue(
    new Error("Resolve pending reservations before retiring this work."),
  );
  show();
  await user.click(await screen.findByRole("button", { name: "Edit OL1W" }));
  await user.click(
    screen.getByLabelText("Retire from new loans and reservations"),
  );
  await user.click(screen.getByRole("button", { name: "Save inventory" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "pending reservations",
  );
  expect(
    screen.getByLabelText("Retire from new loans and reservations"),
  ).toBeChecked();
  expect(screen.getByRole("button", { name: "Save inventory" })).toBeEnabled();
});
