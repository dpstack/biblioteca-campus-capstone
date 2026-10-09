import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnv } from "vite";

const publicEnv = loadEnv("development", process.cwd(), "VITE_");
const isSupabaseConfigured = Boolean(
  publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
);

test("catálogo público: inicio, búsqueda y ficha de libro", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /tu próxima gran idea comienza/i }),
  ).toBeVisible();
  await page.getByLabel("Buscar libros, autores o temas").fill("Tolkien");
  await page
    .getByRole("button", { name: /buscar/i })
    .first()
    .click();
  await expect(page).toHaveURL(/catalogo\?q=Tolkien/);
  await expect(page.locator(".book-grid article").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/libro/OL27448W");
  await expect(
    page.getByRole("heading", { name: "The Lord of the Rings" }),
  ).toBeVisible({ timeout: 30_000 });
  if (isSupabaseConfigured) {
    await expect(page.getByText(/ejemplares disponibles/)).toBeVisible();
    await expect(page.getByText("Préstamos aún sin conectar")).toHaveCount(0);
  } else {
    await expect(page.getByText("Préstamos aún sin conectar")).toBeVisible();
  }
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete),
    undefined,
    { timeout: 15_000 },
  );
  await page.screenshot({
    path: `docs/screenshots/book-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(pageErrors).toEqual([]);
});

test("las páginas públicas no presentan violaciones WCAG A/AA detectables", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const path of [
    "/",
    "/catalogo?q=Tolkien",
    "/libro/OL27448W",
    "/acceso",
  ]) {
    await page.goto(path);
    if (path === "/") {
      await expect(
        page.locator(".featured-section .book-grid article").first(),
      ).toBeVisible();
    } else if (path.startsWith("/catalogo")) {
      await expect(
        page.locator(".catalog-main .book-grid article").first(),
      ).toBeVisible();
    } else if (path.startsWith("/libro")) {
      await expect(
        page.getByRole("heading", { name: "The Lord of the Rings" }),
      ).toBeVisible();
      if (isSupabaseConfigured)
        await expect(page.getByText(/ejemplares disponibles/)).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Bienvenido de nuevo" }),
      ).toBeVisible();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const summary = results.violations.flatMap((violation) =>
      violation.nodes.map(
        (node) =>
          `${violation.id}: ${node.target[0]} | ${node.failureSummary?.split("\n")[1] ?? ""}`,
      ),
    );
    expect(summary, `Violaciones en ${path}`).toEqual([]);
  }
});

test("acceso muestra el estado de Supabase y menú móvil funciona", async ({
  page,
}, testInfo) => {
  await page.goto("/acceso");
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  if (isSupabaseConfigured) {
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
  } else {
    await expect(page.getByText("Falta conectar Supabase.")).toBeVisible();
  }
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByText("Explorar catálogo"),
    ).toBeVisible();
  }
  await page.goto("/");
  await expect(
    page.locator(".featured-section .book-grid article").first(),
  ).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete),
    undefined,
    { timeout: 15_000 },
  );
  await page.screenshot({
    path: `docs/screenshots/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("inventario conectado y ruta personal protegida", async ({ page }) => {
  test.skip(!isSupabaseConfigured, "No hay proyecto Supabase configurado");
  const inventoryResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/library_books") &&
      response.request().method() === "GET",
  );
  await page.goto("/libro/OL27448W");
  expect((await inventoryResponse).status()).toBe(200);
  await expect(page.getByText(/ejemplares disponibles/)).toBeVisible();
  await page.goto("/mi-biblioteca");
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
});
