import type { Book, CatalogResult, WorkDetail } from "../types";

const API_ROOT = "https://openlibrary.org";
const AUTHOR_LIMIT = 200;
const authorSearchCache = new Map<
  string,
  { createdAt: number; result: CatalogResult }
>();

type SearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  edition_count?: number;
};

type SearchResponse = {
  numFound?: number;
  num_found?: number;
  docs?: SearchDoc[];
};

type WorkResponse = {
  key?: string;
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
  authors?: Array<{ author?: { key?: string } }>;
  links?: Array<{ title?: string; url?: string }>;
};

type AuthorResponse = { name?: string };

const normalizeWorkId = (key: string | undefined): string | null => {
  const id = key?.split("/").pop();
  return id && /^OL\d+W$/.test(id) ? id : null;
};

const toBook = (doc: SearchDoc): Book | null => {
  const id = normalizeWorkId(doc.key);
  if (!id || !doc.title) return null;
  return {
    id,
    title: doc.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    firstPublishYear: doc.first_publish_year ?? null,
    coverId: doc.cover_i ?? null,
    subjects: doc.subject?.slice(0, 5) ?? [],
    editionCount: doc.edition_count ?? 0,
  };
};

const readJson = async <T>(url: URL, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(
      `Open Library respondió ${response.status}. Intenta de nuevo.`,
    );
  return response.json() as Promise<T>;
};

export const coverUrl = (coverId: number | null, size: "M" | "L" = "M") =>
  coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`
    : null;

export interface SearchOptions {
  workIds?: string[];
  term?: string;
  field?: "keyword" | "title" | "author";
  category?: string;
  page?: number;
  sort?: "relevance" | "newest" | "oldest" | "author" | "popularity";
}

export async function searchBooks(
  options: SearchOptions,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const url = new URL("/search.json", API_ROOT);
  const term = options.term?.trim().slice(0, 120) ?? "";
  const category = options.category?.trim() ?? "";
  const requestedPage = options.page ?? 1;
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const authorSort = options.sort === "author";
  const workIds =
    options.workIds === undefined
      ? undefined
      : [...new Set(options.workIds)]
          .filter((id) => /^OL\d+W$/.test(id))
          .sort();
  const cacheKey = JSON.stringify([
    term,
    options.field ?? "keyword",
    category,
    workIds,
  ]);
  if (signal?.aborted)
    throw new DOMException("Búsqueda cancelada", "AbortError");
  if (workIds?.length === 0) return { books: [], total: 0 };
  const cached = authorSort ? authorSearchCache.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.createdAt < 120_000) {
    return {
      total: cached.result.total,
      books: cached.result.books.slice((page - 1) * 24, page * 24),
    };
  }
  if (options.field === "title" && term) url.searchParams.set("title", term);
  else if (options.field === "author" && term)
    url.searchParams.set("author", term);
  else
    url.searchParams.set(
      "q",
      (workIds
        ? term.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1")
        : term) ||
        (category ? `subject:${category}` : workIds ? "" : "subject:fiction"),
    );
  if (workIds) {
    const restriction = `key:(${workIds.map((id) => `"/works/${id}"`).join(" OR ")})`;
    const query = url.searchParams.get("q");
    url.searchParams.set(
      "q",
      query ? `(${query}) AND ${restriction}` : restriction,
    );
  }
  if (category && term) url.searchParams.set("subject", category);
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,cover_i,edition_count",
  );
  url.searchParams.set("limit", authorSort ? String(AUTHOR_LIMIT) : "24");
  url.searchParams.set("page", String(authorSort ? 1 : page));
  const sorts = { newest: "new", oldest: "old", popularity: "readinglog" };
  if (options.sort && options.sort in sorts)
    url.searchParams.set("sort", sorts[options.sort as keyof typeof sorts]);
  url.searchParams.set("lang", "es");
  const result = await readJson<SearchResponse>(url, signal);
  const total = result.numFound ?? result.num_found;
  const books = (result.docs ?? [])
    .map(toBook)
    .filter((book): book is Book => book !== null);
  if (!authorSort) return { books, total: total ?? 0 };
  if (total === undefined || total > AUTHOR_LIMIT) {
    throw new Error(
      "Para ordenar toda la búsqueda por autor, afina el título, autor o categoría hasta obtener 200 obras o menos, o elige otro orden.",
    );
  }
  if ((result.docs ?? []).length < total) {
    throw new Error(
      "Open Library devolvió una búsqueda incompleta. Reintenta antes de ordenar por autor.",
    );
  }
  books.sort((a, b) => {
    const first = a.authors[0] ?? "";
    const second = b.authors[0] ?? "";
    if (!first && second) return 1;
    if (first && !second) return -1;
    return (
      first.localeCompare(second, "es", { sensitivity: "base" }) ||
      a.title.localeCompare(b.title, "es") ||
      a.id.localeCompare(b.id)
    );
  });
  // Cache only complete, public results. A bounded cache preserves ordering while paging.
  if (!signal?.aborted) {
    authorSearchCache.delete(cacheKey);
    if (authorSearchCache.size >= 8)
      authorSearchCache.delete(authorSearchCache.keys().next().value!);
    authorSearchCache.set(cacheKey, {
      createdAt: Date.now(),
      result: { books, total: books.length },
    });
  }
  return {
    total: books.length,
    books: books.slice((page - 1) * 24, page * 24),
  };
}

export async function getWork(
  workId: string,
  signal?: AbortSignal,
): Promise<WorkDetail> {
  if (!/^OL\d+W$/.test(workId))
    throw new Error("Identificador de libro inválido.");
  const url = new URL(`/works/${workId}.json`, API_ROOT);
  const work = await readJson<WorkResponse>(url, signal);
  const authorKeys = (work.authors ?? [])
    .map((entry) => entry.author?.key)
    .filter((key): key is string =>
      Boolean(key && /^\/authors\/OL\d+A$/.test(key)),
    )
    .slice(0, 3);
  const authors = await Promise.all(
    authorKeys.map(async (key) => {
      try {
        const author = await readJson<AuthorResponse>(
          new URL(`${key}.json`, API_ROOT),
          signal,
        );
        return author.name ?? "";
      } catch {
        return "";
      }
    }),
  );
  return {
    id: workId,
    title: work.title ?? "Sin título",
    authors: authors.filter(Boolean),
    firstPublishYear: work.first_publish_date
      ? Number(work.first_publish_date.match(/\d{4}/)?.[0]) || null
      : null,
    firstPublishDate: work.first_publish_date ?? null,
    coverId: work.covers?.find((id) => id > 0) ?? null,
    subjects: work.subjects?.slice(0, 12) ?? [],
    editionCount: 0,
    description:
      typeof work.description === "string"
        ? work.description
        : (work.description?.value ??
          "Open Library no ofrece una descripción para esta obra."),
    links: (work.links ?? []).filter(
      (link): link is { title: string; url: string } =>
        Boolean(link.title && link.url),
    ),
  };
}
