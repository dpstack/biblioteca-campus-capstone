import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnv } from "vite";
const publicEnv = loadEnv("development", process.cwd(), "VITE_");
const catalogPath =
  publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY
    ? "/catalogo?available=1"
    : "/catalogo?q=Tolkien";

test("tema oscuro: teclado, persistencia, navegación y contraste", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Tema oscuro" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  for (const path of ["/", catalogPath, "/libro/OL27448W", "/acceso"]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    if (path.includes("catalogo"))
      await expect(page.locator(".book-grid article").first()).toBeVisible({
        timeout: 30000,
      });
    if (path.includes("libro"))
      await expect(
        page.getByRole("heading", { name: "The Lord of the Rings" }),
      ).toBeVisible({ timeout: 30000 });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (path === "/" || path.includes("catalogo"))
      await page.screenshot({
        path: `docs/screenshots/theme-dark-${path === "/" ? "home" : "catalog"}-${info.project.name}.png`,
        fullPage: true,
      });
  }
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("tema del sistema: cambios automáticos y preferencia previa al contenido", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.getElementById("root")) {
        (window as any).firstContentTheme =
          document.documentElement.dataset.theme;
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Tema oscuro" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (window as any).firstContentTheme)).toBe(
    "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => (window as any).firstContentTheme)).toBe(
    "light",
  );
});
