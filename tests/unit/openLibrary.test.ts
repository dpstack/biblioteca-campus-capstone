import { searchBooks, getWork } from "../../src/lib/openLibrary";
beforeEach(() => {
  global.fetch = jest.fn();
});

test("restricts works on the server before pagination and preserves title, category, and order", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      numFound: 30,
      docs: [{ key: "/works/OL30W", title: "Prestables" }],
    }),
  });
  const ids = Array.from({ length: 30 }, (_, i) => `OL${i + 1}W`);
  const result = await searchBooks({
    workIds: ids,
    term: "Campus",
    field: "title",
    category: "science",
    sort: "newest",
    page: 2,
  });
  const url = (fetch as jest.Mock).mock.calls[0][0];
  expect(url.searchParams.get("q")).toContain('"/works/OL30W"');
  expect(url.searchParams.get("q")).toContain('"/works/OL1W"');
  expect(url.searchParams.get("title")).toBe("Campus");
  expect(url.searchParams.get("subject")).toBe("science");
  expect(url.searchParams.get("sort")).toBe("new");
  expect(url.searchParams.get("page")).toBe("2");
  expect(result.total).toBe(30);
});

test("does not query Open Library when no copies are available", async () => {
  expect(await searchBooks({ workIds: [] })).toEqual({ books: [], total: 0 });
  expect(fetch).not.toHaveBeenCalled();
});

test("inventory is part of the author-sort cache key", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      numFound: 1,
      docs: [{ key: "/works/OL1W", title: "Campus" }],
    }),
  });
  await searchBooks({ term: "stock-cache", sort: "author", workIds: ["OL1W"] });
  await searchBooks({ term: "stock-cache", sort: "author", workIds: ["OL2W"] });
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("normalizes results and discards invalid works with mocked fetch", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      numFound: 2,
      docs: [
        { key: "/works/OL1W", title: "Campus" },
        { key: "/invalid", title: "Invalid" },
      ],
    }),
  });
  const result = await searchBooks({
    term: " Campus ",
    field: "title",
    page: 0,
  });
  expect(result.books).toHaveLength(1);
  expect(result.books[0]).toMatchObject({
    id: "OL1W",
    title: "Campus",
    authors: [],
  });
  const url = (fetch as jest.Mock).mock.calls[0][0];
  expect(url.searchParams.get("title")).toBe("Campus");
  expect(url.searchParams.get("page")).toBe("1");
});
test("propaga errores HTTP y of red", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  await expect(searchBooks({})).rejects.toThrow("503");
  (fetch as jest.Mock).mockRejectedValue(new Error("Offline"));
  await expect(searchBooks({})).rejects.toThrow("Offline");
});
test("rejects invalid identifiers before requesting data", async () => {
  await expect(getWork("../secret")).rejects.toThrow("identifier");
  expect(fetch).not.toHaveBeenCalled();
});
test.each([
  ["newest", "new"],
  ["oldest", "old"],
  ["popularity", "readinglog"],
])("sends global %s ordering to the API", async (sort, expected) => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ docs: [], numFound: 0 }),
  });
  await searchBooks({ sort: sort as any, page: 1001 });
  const url = (fetch as jest.Mock).mock.calls[0][0];
  expect(url.searchParams.get("sort")).toBe(expected);
  expect(url.searchParams.get("page")).toBe("1001");
});

test("sorts the whole search by author before pagination and preserves it across pages", async () => {
  const docs = Array.from({ length: 30 }, (_, index) => ({
    key: `/works/OL${index + 200}W`,
    title: `Work ${index}`,
    author_name: [index < 6 ? "Zora" : "Ana"],
  }));
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ docs, numFound: 30 }),
  });
  const first = await searchBooks({
    term: "global-author-fixture",
    sort: "author",
  });
  const second = await searchBooks({
    term: "global-author-fixture",
    sort: "author",
    page: 2,
  });
  expect(first.books).toHaveLength(24);
  expect(first.books.every((book) => book.authors[0] === "Ana")).toBe(true);
  expect(second.books).toHaveLength(6);
  expect(second.books.every((book) => book.authors[0] === "Zora")).toBe(true);
  expect(
    new Set([...first.books, ...second.books].map((book) => book.id)).size,
  ).toBe(30);
  expect(first.total).toBe(30);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch as jest.Mock).mock.calls[0][0].searchParams.get("limit")).toBe(
    "200",
  );
});

test("rejects broad searches rather than showing a partial author order", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ docs: [], numFound: 201 }),
  });
  await expect(
    searchBooks({ term: "broad-author-fixture", sort: "author" }),
  ).rejects.toThrow("200 works or fewer");
});

test("rejects incomplete results before author sorting", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ docs: [{ key: "OL7W", title: "Uno" }], numFound: 2 }),
  });
  await expect(
    searchBooks({ term: "incomplete-author-fixture", sort: "author" }),
  ).rejects.toThrow("incomplete");
});

test("breaks author ties by title and places unknown authors last", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      numFound: 3,
      docs: [
        { key: "OL7W", title: "Zeta", author_name: ["Ana"] },
        { key: "OL8W", title: "Sin autor" },
        { key: "OL9W", title: "Alfa", author_name: ["Ana"] },
      ],
    }),
  });
  const result = await searchBooks({
    term: "ties-author-fixture",
    sort: "author",
  });
  expect(result.books.map((book) => book.title)).toEqual([
    "Alfa",
    "Zeta",
    "Sin autor",
  ]);
});
