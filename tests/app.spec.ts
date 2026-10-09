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
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scroll,
      `Desbordamiento horizontal en ${path}`,
    ).toBeLessThanOrEqual(dimensions.width);
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

test("el teclado salta al contenido, navega y cierra el menú con Escape", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Buscar libros, autores o temas")).toBeFocused();
  await page.keyboard.type("Tolkien");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/catalogo\?q=Tolkien/);
  await expect(page.locator("main")).toBeFocused();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menú" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Inicio", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir menú" }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Abrir menú" }),
    ).toHaveAttribute("aria-expanded", "false");
  }
});

test("autor ordena una búsqueda completa entre páginas y pide afinar resultados amplios", async ({
  page,
}) => {
  const authors = Array.from({ length: 30 }, (_, index) => ({
    key: `/works/OL${900 + index}W`,
    title: `Obra ${index}`,
    author_name: [index < 6 ? "Zora" : "Ana"],
  }));
  let requests = 0;
  await page.route("https://openlibrary.org/search.json?**", async (route) => {
    const url = new URL(route.request().url());
    requests++;
    await route.fulfill({
      json: {
        numFound: url.searchParams.get("q") === "amplia" ? 201 : 30,
        docs: authors,
      },
    });
  });
  await page.goto("/catalogo?q=acotada&sort=author");
  await expect(page.locator(".book-grid article")).toHaveCount(24);
  expect(await page.locator(".book-grid article p").allTextContents()).toEqual(
    Array(24).fill("Ana"),
  );
  const initialRequests = requests;
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.locator(".book-grid article")).toHaveCount(6);
  expect(await page.locator(".book-grid article p").allTextContents()).toEqual(
    Array(6).fill("Zora"),
  );
  expect(requests).toBe(initialRequests);
  await page.goto("/catalogo?q=amplia&sort=author");
  await expect(page.getByRole("alert")).toContainText("200 obras o menos");
  await expect(page.locator(".book-grid article")).toHaveCount(0);
});

test("orden por autor funciona con una búsqueda real de Open Library", async ({
  page,
}, info) => {
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("/search.json") &&
      new URL(response.url()).searchParams.get("limit") === "200",
  );
  await page.goto(
    "/catalogo?q=A%20Wizard%20of%20Earthsea&field=title&sort=author",
  );
  expect((await response).status()).toBe(200);
  await expect(page.locator(".book-grid article").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Ordenar:" })).toHaveValue(
    "author",
  );
  const names = await page.locator(".book-grid article p").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  const firstAuthors = names.map((value) => value.split(",")[0]);
  const knownAuthors = firstAuthors.filter(
    (name) => name !== "Autor no indicado",
  );
  expect(firstAuthors).toEqual(
    [...knownAuthors]
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .concat(firstAuthors.filter((name) => name === "Autor no indicado")),
  );
  if (info.project.name === "desktop")
    await page.screenshot({
      path: "docs/screenshots/author-production-desktop.png",
    });
});
