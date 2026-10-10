import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnv } from "vite";

const publicEnv = loadEnv("development", process.cwd(), "VITE_");
test.skip(
  !publicEnv.VITE_SUPABASE_URL || !publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  "Configura Supabase para probar el filtro de inventario.",
);

test("filtro real de préstamo: stock público y búsqueda combinada", async ({
  page,
}) => {
  await page.goto("/catalogo?available=1");
  await expect(
    page.getByRole("checkbox", { name: "Disponibles para préstamo" }),
  ).toBeChecked();
  await expect(page.locator(".book-grid article").first()).toBeVisible({
    timeout: 30000,
  });
  const cards = page.locator(".book-grid article");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++)
    await expect(
      cards.nth(i).getByText("Disponible", { exact: true }),
    ).toBeVisible();
  await page.getByLabel("Término de búsqueda").fill("Tolkien");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/available=1.*q=Tolkien/);
  await expect(
    page.getByRole("heading", { name: "The Lord of the Rings", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
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
  await page
    .getByRole("checkbox", { name: "Disponibles para préstamo" })
    .click();
  await expect(page).not.toHaveURL(/available=1/);
  await expect(
    page.getByRole("checkbox", { name: "Disponibles para préstamo" }),
  ).not.toBeChecked();
});

test("inventario simulado: 30 obras disponibles se paginan después del filtro", async ({
  page,
}) => {
  const ids = Array.from({ length: 30 }, (_, i) => `OL${i + 1}W`);
  await page.route("**/rest/v1/library_books?**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("retired")).toBe("eq.false");
    expect(url.searchParams.get("available_copies")).toBe("gt.0");
    await route.fulfill({
      json: ids.map((work_id) => ({
        work_id,
        total_copies: 2,
        available_copies: 1,
        retired: false,
      })),
    });
  });
  await page.route("https://openlibrary.org/search.json?**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("q")).toContain('"/works/OL30W"');
    expect(url.searchParams.get("q")).toContain('"/works/OL1W"');
    const offset = (Number(url.searchParams.get("page")) - 1) * 24;
    await route.fulfill({
      json: {
        numFound: 30,
        docs: ids
          .slice(offset, offset + 24)
          .map((id) => ({ key: `/works/${id}`, title: `Prestables ${id}` })),
      },
    });
  });
  await page.goto("/catalogo?available=1");
  await expect(page.locator(".book-grid article")).toHaveCount(24);
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.locator(".book-grid article")).toHaveCount(6);
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toBeChecked();
});
