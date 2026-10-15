import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";

const publicEnv = loadEnv("development", process.cwd(), "VITE_");
const catalogPath =
  publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY
    ? "/catalog?available=1"
    : "/catalog?q=Tolkien";

test("final review: public routes, clean console, and demo screenshots in both themes", async ({
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
    for (const path of ["/", catalogPath, "/books/OL27448W", "/login"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("h1")).toBeVisible();
      if (path === "/")
        await expect(
          page.locator(".featured-section article").first(),
        ).toBeVisible({ timeout: 30000 });
      if (path.includes("catalog"))
        await expect(page.locator(".book-grid article").first()).toBeVisible({
          timeout: 30000,
        });
      if (path.includes("books"))
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
          : path.includes("catalog")
            ? "catalog"
            : path.includes("books")
              ? "book"
              : "access";
      await page.screenshot({
        path: `docs/screenshots/final-${label}-${theme}-${info.project.name}.png`,
      });
    }
  }
  await page.goto("/my-library");
  await expect(page).toHaveURL(/\/login$/);
  expect(consoleIssues).toEqual([]);
});

test("legacy links redirect to English routes and preserve search parameters", async ({
  page,
}) => {
  await page.goto("/catalogo?available=1&q=Tolkien");
  await expect(page).toHaveURL(/\/catalog\?available=1&q=Tolkien$/);
  await expect(
    page.getByRole("checkbox", { name: "Available to borrow" }),
  ).toBeChecked();
  await page.goto("/libro/OL27448W");
  await expect(page).toHaveURL(/\/books\/OL27448W$/);
  await expect(
    page.getByRole("heading", { name: "The Lord of the Rings" }),
  ).toBeVisible({ timeout: 30000 });
  await page.goto("/acceso");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
