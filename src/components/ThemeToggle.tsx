import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const key = "biblioteca-theme-v1";
const readPreference = (): Theme | null => {
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
};
const systemTheme = (): Theme =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export function ThemeToggle() {
  const [preference, setPreference] = useState(readPreference);
  const [system, setSystem] = useState(systemTheme);
  const theme = preference ?? system;

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => setSystem(systemTheme());
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null)
        setPreference(readPreference());
    };
    media?.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#111c17" : "#164334");
  }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setPreference(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // The control remains usable when browser storage is unavailable.
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Tema oscuro"
      aria-pressed={theme === "dark"}
      title={
        theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      }
    >
      {theme === "dark" ? (
        <Sun size={20} aria-hidden="true" />
      ) : (
        <Moon size={20} aria-hidden="true" />
      )}
    </button>
  );
}
