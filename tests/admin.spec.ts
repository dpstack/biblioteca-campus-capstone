import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnv } from "vite";
const env = loadEnv("development", process.cwd(), "VITE_");
test("administration: add, edit, retire, and review circulation (mock API)", async ({
  page,
}, info) => {
  test.skip(
    !env.VITE_SUPABASE_URL,
    "Public Supabase configuration is required to load the SDK.",
  );
  const url = env.VITE_SUPABASE_URL;
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.invalid",
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
      session: {
        access_token: jwt,
        refresh_token: "test-refresh",
        expires_at: exp,
        expires_in: 3600,
        token_type: "bearer",
        user,
      },
    },
  );
  const books: any[] = [];
  await page.route(`${url}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/is_library_admin"))
      return route.fulfill({ json: true });
    if (path.endsWith("/admin_dashboard"))
      return route.fulfill({
        json: {
          books,
          loans: [
            {
              id: "loan",
              work_id: "OL1W",
              title: "Borrowed work",
              email: "reader@example.invalid",
              due_at: "2026-10-23",
            },
          ],
          reservations: [
            {
              id: "reservation",
              work_id: "OL1W",
              title: "Borrowed work",
              email: "next@example.invalid",
              created_at: "2026-10-09",
            },
          ],
        },
      });
    if (path.endsWith("/admin_save_book")) {
      const body = route.request().postDataJSON();
      expect(route.request().headers().authorization).toBe(`Bearer ${jwt}`);
      const old = books.find((book) => book.work_id === body.p_work_id);
      const item = {
        work_id: body.p_work_id,
        title: body.p_title,
        author: body.p_author,
        cover_id: body.p_cover_id,
        total_copies: body.p_total_copies,
        available_copies: body.p_total_copies,
        retired: body.p_retired,
      };
      if (old) Object.assign(old, item);
      else books.push(item);
      return route.fulfill({ json: null });
    }
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    return route.fulfill({ json: [] });
  });
  await page.route("https://openlibrary.org/search.json?**", (route) =>
    route.fulfill({
      json: {
        numFound: 1,
        docs: [
          {
            key: "/works/OL2W",
            title: "New work",
            author_name: ["Eva"],
            edition_count: 1,
          },
        ],
      },
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Add from Open Library" }),
  ).toBeVisible();
  await page.getByLabel("Title, author, or keyword").fill("New work");
  await page.getByRole("button", { name: "Search books" }).click();
  await page.getByRole("button", { name: "Manage OL2W" }).click();
  await page.getByLabel("Total copies").fill("3");
  await page.getByRole("button", { name: "Save inventory" }).click();
  await expect(page.getByText("3 available out of 3 · Active")).toBeVisible();
  await page.getByRole("button", { name: "Edit OL2W" }).click();
  await page.getByLabel("Retire from new loans and reservations").check();
  await page.getByRole("button", { name: "Save inventory" }).click();
  await expect(page.getByText("3 available out of 3 · Retired")).toBeVisible();
  await expect(page.getByText("reader@example.invalid")).toBeVisible();
  await expect(
    page.getByText(/next@example.invalid · Position 1/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(
    page.getByRole("button", { name: "Dark theme" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/screenshots/admin-dark-fixture-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/my-library");
  await expect(page.getByRole("heading", { name: "My library" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dark theme" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("administration: a regular session receives no data or editor (mock API)", async ({
  page,
}) => {
  test.skip(!env.VITE_SUPABASE_URL, "Public Supabase is not configured.");
  const url = env.VITE_SUPABASE_URL;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "reader@example.invalid",
    aud: "authenticated",
  };
  const jwt = [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp })).toString("base64url"),
    "test",
  ].join(".");
  await page.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
      session: {
        access_token: jwt,
        refresh_token: "test",
        expires_at: exp,
        token_type: "bearer",
        user,
      },
    },
  );
  await page.route(`${url}/**`, (route) =>
    route.request().url().includes("admin_dashboard")
      ? route.fulfill({
          status: 403,
          json: { message: "Login exclusivo para administradores." },
        })
      : route.fulfill({ json: false }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("alert")).toContainText("exclusivo");
  await expect(page.getByRole("button", { name: "Search books" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Administration", exact: true }),
  ).toHaveCount(0);
});
