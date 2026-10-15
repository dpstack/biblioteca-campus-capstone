import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SiteLayout } from "../../src/components/SiteLayout";
import { AuthContext } from "../../src/context/auth-context";
jest.mock("../../src/lib/config", () => ({ isSupabaseConfigured: true }));
function show(session = null) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ session, isLoading: false, signOut: jest.fn() }}
      >
        <SiteLayout />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
test("the menu opens and closes on navigation", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await user.click(screen.getByRole("link", { name: "Explore catalog" }));
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
test("the login link opens the form when signed out", () => {
  show();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login",
  );
});
test("an active session links to the account", () => {
  show({ user: { id: "student" } } as any);
  expect(screen.getByRole("link", { name: "My account" })).toHaveAttribute(
    "href",
    "/my-library",
  );
});

test("Escape closes the menu and returns focus to its button", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
