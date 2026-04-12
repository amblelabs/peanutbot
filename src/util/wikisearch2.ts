/* https://github.com/fuma-nama/fumadocs/tree/8999346b6b0888398b01a60f8864ab70ce8cdf9d/packages/core/src/search */

import {
  getByID,
  type Orama,
  search,
  type SearchParams,
  type AnyOrama,
  create,
  load,
  type TypedDocument,
  type RawData,
} from "@orama/orama";

/* Cloned from https://github.com/oramasearch/orama/blob/main/packages/orama/src/components/tokenizer/languages.ts */
export const STEMMERS: Record<string, string> = {
  arabic: "ar",
  armenian: "am",
  bulgarian: "bg",
  czech: "cz",
  danish: "dk",
  dutch: "nl",
  english: "en",
  finnish: "fi",
  french: "fr",
  german: "de",
  greek: "gr",
  hungarian: "hu",
  indian: "in",
  indonesian: "id",
  irish: "ie",
  italian: "it",
  lithuanian: "lt",
  nepali: "np",
  norwegian: "no",
  portuguese: "pt",
  romanian: "ro",
  russian: "ru",
  serbian: "rs",
  slovenian: "ru",
  spanish: "es",
  swedish: "se",
  tamil: "ta",
  turkish: "tr",
  ukrainian: "uk",
  vietnamese: "vi",
  sanskrit: "sk",
};

type Awaitable<T> = T | Promise<T>;
type ExportedData =
  | (RawData & { type: "simple" | "advanced" })
  | {
      type: "i18n";
      data: Record<string, RawData & { type: "simple" | "advanced" }>;
    };

type SimpleDocument = TypedDocument<Orama<typeof simpleSchema>>;
const simpleSchema = {
  url: "string",
  title: "string",
  breadcrumbs: "string[]",
  description: "string",
  content: "string",
  keywords: "string",
} as const;

type AdvancedDocument = TypedDocument<Orama<typeof advancedSchema>>;
const advancedSchema = {
  content: "string",
  page_id: "string",
  type: "string",
  breadcrumbs: "string[]",
  tags: "enum[]",
  url: "string",
  embeddings: "vector[512]",
} as const;

async function searchSimple(
  db: Orama<typeof simpleSchema>,
  query: string,
  params: Partial<
    SearchParams<Orama<typeof simpleSchema>, SimpleDocument>
  > = {},
): Promise<SortedResult[]> {
  const result = await search(db, {
    term: query,
    tolerance: 1,
    ...params,
    boost: {
      title: 2,
      ...("boost" in params ? params.boost : undefined),
    },
  });

  return result.hits.map<SortedResult>((hit) => ({
    type: "page",
    content: hit.document.title,
    breadcrumbs: hit.document.breadcrumbs,
    id: hit.document.url,
    url: hit.document.url,
  }));
}

function removeUndefined<T extends object>(value: T, deep = false): T {
  const obj = value as Record<string, unknown>;

  for (const key in obj) {
    if (obj[key] === undefined) delete obj[key];
    if (!deep) continue;

    const entry = obj[key];

    if (typeof entry === "object" && entry !== null) {
      removeUndefined(entry, deep);
      continue;
    }

    if (Array.isArray(entry)) {
      for (const item of entry) removeUndefined(item, deep);
    }
  }

  return value;
}

async function searchAdvanced(
  db: Orama<typeof advancedSchema>,
  query: string,
  tag: string | string[] = [],
  {
    mode = "fulltext",
    ...override
  }: Partial<SearchParams<Orama<typeof advancedSchema>, AdvancedDocument>> = {},
): Promise<SortedResult[]> {
  if (typeof tag === "string") tag = [tag];

  const params = {
    limit: 60,
    mode,
    ...override,
    where: removeUndefined({
      tags:
        tag.length > 0
          ? {
              containsAll: tag,
            }
          : undefined,
      ...override.where,
    }),
    groupBy: {
      properties: ["page_id"],
      maxResult: 8,
      ...override.groupBy,
    },
    properties: mode === "fulltext" ? ["content"] : ["content", "embeddings"],
  } as SearchParams<typeof db, AdvancedDocument>;

  if (query.length > 0) {
    params.term = query;
  }

  const result = await search(db, params);
  const list: SortedResult[] = [];
  for (const item of result.groups ?? []) {
    const pageId = item.values[0] as string;

    const page = getByID(db, pageId);
    if (!page) continue;

    list.push({
      id: pageId,
      type: "page",
      content: page.content,
      breadcrumbs: page.breadcrumbs,
      url: page.url,
    });

    for (const hit of item.result) {
      if (hit.document.type === "page") continue;

      list.push({
        id: hit.document.id.toString(),
        content: hit.document.content,
        breadcrumbs: hit.document.breadcrumbs,
        type: hit.document.type as SortedResult["type"],
        url: hit.document.url,
      });
    }
  }

  if (typeof params.limit === "number" && list.length > params.limit) {
    return list.slice(0, params.limit);
  }

  return list;
}
interface StaticOptions {
  /**
   * Where to download exported search indexes (URL)
   *
   * @defaultValue '/api/search'
   */
  from?: string;

  initOrama?: (locale?: string) => AnyOrama | Promise<AnyOrama>;

  /**
   * Filter results with specific tag(s).
   */
  tag?: string | string[];

  /**
   * Filter by locale (unsupported at the moment)
   */
  locale?: string;

  /**
   * extra options for search
   */
  search?: Partial<SearchParams<Orama<unknown>>>;
}

const cache = new Map<string, Promise<Database>>();

// locale -> db
type Database = Map<
  string,
  {
    type: "simple" | "advanced";
    db: AnyOrama;
  }
>;

async function loadDB(
  from: string,
  initOrama: StaticOptions["initOrama"] = (locale) =>
    create({ schema: { _: "string" }, language: locale }),
): Promise<Database> {
  const res = await fetch(from);

  if (!res.ok)
    throw new Error(
      `failed to fetch exported search indexes from ${from}, make sure the search database is exported and available for client.`,
    );

  const data = (await res.json()) as ExportedData;
  const dbs: Database = new Map();

  if (data.type === "i18n") {
    await Promise.all(
      Object.entries(data.data).map(async ([k, v]) => {
        const db = await initOrama(k);

        load(db, v);
        dbs.set(k, {
          type: v.type,
          db,
        });
      }),
    );
  } else {
    const db = await initOrama();
    load(db, data);
    dbs.set("", {
      type: data.type,
      db,
    });
  }

  return dbs;
}

function getDBCached(options: StaticOptions) {
  const { from = "/api/search", initOrama } = options;
  const cacheKey = from;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const result = loadDB(from, initOrama);
  cache.set(cacheKey, result);
  return result;
}

export function oramaStaticClient(options: StaticOptions): SearchClient {
  const { tag, locale, search } = options;

  return {
    async search(query) {
      const dbs = await getDBCached(options);
      let db = dbs.get(locale ?? "");

      if (!db) {
        console.warn(
          `failed to find search data for "${locale}", available: ${Array.from(dbs.keys())}.`,
        );
        db = dbs.values().next().value;
      }

      if (!db) return [];
      if (db.type === "simple")
        return searchSimple(
          db as unknown as Orama<typeof simpleSchema>,
          query,
          search as never,
        );

      return searchAdvanced(
        db.db as Orama<typeof advancedSchema>,
        query,
        tag,
        search as never,
      );
    },
  };
}
export interface SortedResult<Content = string> {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: Content;

  /**
   * breadcrumbs to be displayed on UI
   */
  breadcrumbs?: Content[];
  /**
   * @deprecated it is now included in `content` as Markdown using `<mark />`.
   */
  contentWithHighlights?: HighlightedText<Content>[];
}

export interface HighlightedText<Content = string> {
  type: "text";
  content: Content;
  styles?: {
    highlight?: boolean;
  };
}

export interface SearchClient {
  search: (query: string) => Awaitable<SortedResult[]>;
}
