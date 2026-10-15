import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnv } from "vite";

const publicEnv = loadEnv("development", process.cwd(), "VITE_");
test.skip(
  !publicEnv.VITE_SUPABASE_URL || !publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  "Configure Supabase to test the inventory filter.",
);

test("real borrowing filter: public inventory and combined search", async ({
  page,
}) => {
  await page.goto("/catalog?available=1");
  await expect(
    page.getByRole("checkbox", { name: "Available to borrow" }),
  ).toBeChecked();
  await expect(page.locator(".book-grid article").first()).toBeVisible({
    timeout: 30000,
  });
  const cards = page.locator(".book-grid article");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++)
    await expect(
      cards.nth(i).getByText("Available", { exact: true }),
    ).toBeVisible();
  await page.getByLabel("Search term").fill("Tolkien");
  await page.getByRole("button", { name: "Search", exact: true }).click();
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
  await page.getByRole("checkbox", { name: "Available to borrow" }).click();
  await expect(page).not.toHaveURL(/available=1/);
  await expect(
    page.getByRole("checkbox", { name: "Available to borrow" }),
  ).not.toBeChecked();
});

test("mock inventory: 30 available works are paginated after filtering", async ({
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
  await page.goto("/catalog?available=1");
  await expect(page.locator(".book-grid article")).toHaveCount(24);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.locator(".book-grid article")).toHaveCount(6);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toBeChecked();
});
