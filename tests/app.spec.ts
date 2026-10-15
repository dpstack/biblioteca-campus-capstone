import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnv } from "vite";

const publicEnv = loadEnv("development", process.cwd(), "VITE_");
const isSupabaseConfigured = Boolean(
  publicEnv.VITE_SUPABASE_URL && publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
);

test("public catalog: home, search, and book details", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /your next great idea starts/i }),
  ).toBeVisible();
  await page.getByLabel("Search books, authors, or subjects").fill("Tolkien");
  await page
    .getByRole("button", { name: /search/i })
    .first()
    .click();
  await expect(page).toHaveURL(/catalog\?q=Tolkien/);
  await expect(page.locator(".book-grid article").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/books/OL27448W");
  await expect(
    page.getByRole("heading", { name: "The Lord of the Rings" }),
  ).toBeVisible({ timeout: 30_000 });
  if (isSupabaseConfigured) {
    await expect(page.getByText(/copies available/)).toBeVisible();
    await expect(page.getByText("Loans are not connected yet")).toHaveCount(0);
  } else {
    await expect(page.getByText("Loans are not connected yet")).toBeVisible();
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

test("public pages have no detectable WCAG A/AA violations", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const path of ["/", "/catalog?q=Tolkien", "/books/OL27448W", "/login"]) {
    await page.goto(path);
    if (path === "/") {
      await expect(
        page.locator(".featured-section .book-grid article").first(),
      ).toBeVisible({ timeout: 30_000 });
    } else if (path.startsWith("/catalog")) {
      await expect(
        page.locator(".catalog-main .book-grid article").first(),
      ).toBeVisible({ timeout: 30_000 });
    } else if (path.startsWith("/books")) {
      await expect(
        page.getByRole("heading", { name: "The Lord of the Rings" }),
      ).toBeVisible();
      if (isSupabaseConfigured)
        await expect(page.getByText(/copies available/)).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Welcome back" }),
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
    expect(summary, `Violations on ${path}`).toEqual([]);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scroll,
      `Horizontal overflow on ${path}`,
    ).toBeLessThanOrEqual(dimensions.width);
  }
});

test("login shows Supabase status and the mobile menu works", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  if (isSupabaseConfigured) {
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  } else {
    await expect(page.getByText("Supabase is not connected.")).toBeVisible();
  }
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByText("Explore catalog"),
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

test("connected inventory and protected account route", async ({ page }) => {
  test.skip(!isSupabaseConfigured, "No Supabase project is configured");
  const inventoryResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/library_books") &&
      response.request().method() === "GET",
  );
  await page.goto("/books/OL27448W");
  expect((await inventoryResponse).status()).toBe(200);
  await expect(page.getByText(/copies available/)).toBeVisible();
  await page.goto("/my-library");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("keyboard skips to content, navigates, and closes the menu with Escape", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Search books, authors, or subjects"),
  ).toBeFocused();
  await page.keyboard.type("Tolkien");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/catalog\?q=Tolkien/);
  await expect(page.locator("main")).toBeFocused();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Home", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Open menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  }
});

test("author order covers the full search across pages and asks to refine broad results", async ({
  page,
}) => {
  const authors = Array.from({ length: 30 }, (_, index) => ({
    key: `/works/OL${900 + index}W`,
    title: `Work ${index}`,
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
  await page.goto("/catalog?q=acotada&sort=author");
  await expect(page.locator(".book-grid article")).toHaveCount(24);
  expect(await page.locator(".book-grid article p").allTextContents()).toEqual(
    Array(24).fill("Ana"),
  );
  const initialRequests = requests;
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator(".book-grid article")).toHaveCount(6);
  expect(await page.locator(".book-grid article p").allTextContents()).toEqual(
    Array(6).fill("Zora"),
  );
  expect(requests).toBe(initialRequests);
  await page.goto("/catalog?q=amplia&sort=author");
  await expect(page.getByRole("alert")).toContainText("200 works or fewer");
  await expect(page.locator(".book-grid article")).toHaveCount(0);
});

test("author sorting works with a real Open Library search", async ({
  page,
}, info) => {
  const response = page.waitForResponse(
    (response) =>
      response.url().includes("/search.json") &&
      new URL(response.url()).searchParams.get("limit") === "200",
  );
  await page.goto(
    "/catalog?q=A%20Wizard%20of%20Earthsea&field=title&sort=author",
  );
  expect((await response).status()).toBe(200);
  await expect(page.locator(".book-grid article").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Sort by:" })).toHaveValue(
    "author",
  );
  const names = await page.locator(".book-grid article p").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  const firstAuthors = names.map((value) => value.split(",")[0]);
  const knownAuthors = firstAuthors.filter((name) => name !== "Unknown author");
  expect(firstAuthors).toEqual(
    [...knownAuthors]
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
      .concat(firstAuthors.filter((name) => name === "Unknown author")),
  );
  if (info.project.name === "desktop")
    await page.screenshot({
      path: "docs/screenshots/author-production-desktop.png",
    });
});
