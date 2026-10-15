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
      <MemoryRouter initialEntries={["/my-library"]}>
        <Routes>
          <Route path="/my-library" element={<AccountPage />} />
          <Route path="/login" element={<h1>Login</h1>} />
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
test("tabs support arrows, Home, End, and a single tab stop", async () => {
  const user = userEvent.setup();
  show();
  await screen.findByText("You have no loans yet");
  const loans = screen.getByRole("tab", { name: /Loans/ });
  await user.click(loans);
  await user.keyboard("{ArrowRight}");
  const reservations = screen.getByRole("tab", { name: /Reservations/ });
  expect(reservations).toHaveFocus();
  expect(reservations).toHaveAttribute("aria-selected", "true");
  expect(loans).toHaveAttribute("tabindex", "-1");
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: /Reading list/ })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(loans).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("tab", { name: /Reading list/ })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(loans).toHaveFocus();
});
test("returns a loan and shows updated history", async () => {
  (library.getMyLoans as jest.Mock)
    .mockResolvedValueOnce([loan])
    .mockResolvedValue([{ ...loan, returned_at: "2026-10-09T13:00:00Z" }]);
  const user = userEvent.setup();
  show();
  await user.click(await screen.findByRole("button", { name: "Return book" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Book returned");
  expect(library.returnBook).toHaveBeenCalledWith("loan-1");
  expect(screen.getByText("Returned")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Return book" }),
  ).not.toBeInTheDocument();
});
test("cancels a reservation and preserves its history", async () => {
  (library.getMyReservations as jest.Mock)
    .mockResolvedValueOnce([reservation])
    .mockResolvedValue([{ ...reservation, status: "cancelled" }]);
  const user = userEvent.setup();
  show();
  await screen.findByText("You have no loans yet");
  await user.click(screen.getByRole("tab", { name: /Reservations/ }));
  await user.click(screen.getByRole("button", { name: "Cancel reservation" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Reservation canceled",
  );
  expect(library.cancelReservation).toHaveBeenCalledWith("reservation-1");
  expect(screen.getByText("Canceled")).toBeInTheDocument();
});
test("removes a reading item and updates the list", async () => {
  (library.getMyReadingList as jest.Mock)
    .mockResolvedValueOnce([
      { ...snapshot, status: "reading", updated_at: "2026-10-09T12:00:00Z" },
    ])
    .mockResolvedValue([]);
  const user = userEvent.setup();
  show();
  await screen.findByText("You have no loans yet");
  await user.click(screen.getByRole("tab", { name: /Reading list/ }));
  await user.click(screen.getByRole("button", { name: "Remove from my list" }));
  expect(
    await screen.findByText("Your reading list is empty"),
  ).toBeInTheDocument();
  expect(library.removeReadingItem).toHaveBeenCalledWith("OL1W");
});
test("a rejected return keeps the loan active", async () => {
  (library.getMyLoans as jest.Mock).mockResolvedValue([loan]);
  (library.returnBook as jest.Mock).mockRejectedValue(
    new Error("Not authorized"),
  );
  const user = userEvent.setup();
  show();
  await user.click(await screen.findByRole("button", { name: "Return book" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Return book" })).toBeEnabled(),
  );
  expect(screen.getByText("Active")).toBeInTheDocument();
});
test("redirects signed-out visitors without querying private data", async () => {
  show(null);
  await screen.findByRole("heading", { name: "Login" });
  expect(library.getMyLoans).not.toHaveBeenCalled();
});
