import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "../../src/components/ThemeToggle";

let media: {
  matches: boolean;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  media = {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  window.matchMedia = jest.fn(() => media) as any;
});

test("el control accesible alterna el tema y persiste la elección", async () => {
  const user = userEvent.setup();
  const view = render(<ThemeToggle />);
  const button = screen.getByRole("button", { name: "Tema oscuro" });
  expect(button).toHaveAttribute("aria-pressed", "false");
  button.focus();
  await user.keyboard("{Enter}");
  expect(button).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("biblioteca-theme-v1")).toBe("dark");
  view.unmount();
  render(<ThemeToggle />);
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button"));
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("sigue el sistema sin preferencia explícita y deja de seguirlo al elegir", async () => {
  const user = userEvent.setup();
  render(<ThemeToggle />);
  const onChange = media.addEventListener.mock.calls[0][1];
  media.matches = true;
  onChange();
  await waitFor(() =>
    expect(document.documentElement.dataset.theme).toBe("dark"),
  );
  await user.click(screen.getByRole("button"));
  media.matches = false;
  onChange();
  media.matches = true;
  onChange();
  await waitFor(() =>
    expect(document.documentElement.dataset.theme).toBe("light"),
  );
});

test("continúa funcionando si el navegador bloquea el almacenamiento", async () => {
  const read = jest
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new Error("denied");
    });
  const write = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("denied");
    });
  try {
    render(<ThemeToggle />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  } finally {
    read.mockRestore();
    write.mockRestore();
  }
});

test("sincroniza la preferencia modificada en otra pestaña", async () => {
  render(<ThemeToggle />);
  localStorage.setItem("biblioteca-theme-v1", "dark");
  window.dispatchEvent(
    new StorageEvent("storage", { key: "biblioteca-theme-v1" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true"),
  );
});
