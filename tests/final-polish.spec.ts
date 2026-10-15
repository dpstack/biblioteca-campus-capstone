import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";

const publicEnv = loadEnv("development", process.cwd(), "VITE_");
const catalogPath =
  publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY
    ? "/catalogo?available=1"
    : "/catalogo?q=Tolkien";

test("revisión final: rutas públicas, consola limpia y capturas de demo en ambos temas", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      consoleIssues.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    consoleIssues.push(`uncaught: ${error.message}`),
  );
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ["/", catalogPath, "/libro/OL27448W", "/acceso"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      if (path === "/")
        await expect(
          page.locator(".featured-section article").first(),
        ).toBeVisible({ timeout: 30000 });
      if (path.includes("catalogo"))
        await expect(page.locator(".book-grid article").first()).toBeVisible({
          timeout: 30000,
        });
      if (path.includes("libro"))
        await expect(
          page.getByRole("heading", { name: "The Lord of the Rings" }),
        ).toBeVisible({ timeout: 30000 });
      await page.waitForFunction(
        () => [...document.images].every((image) => image.complete),
        undefined,
        { timeout: 20000 },
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.getByRole("alert")).toHaveCount(0);
      const label =
        path === "/"
          ? "home"
          : path.includes("catalogo")
            ? "catalog"
            : path.includes("libro")
              ? "book"
              : "access";
      await page.screenshot({
        path: `docs/screenshots/final-${label}-${theme}-${info.project.name}.png`,
      });
    }
  }
  await page.goto("/mi-biblioteca");
  await expect(page).toHaveURL(/\/acceso$/);
  expect(consoleIssues).toEqual([]);
});
