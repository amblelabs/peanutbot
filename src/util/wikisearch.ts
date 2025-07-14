import config from "~/../config.json";

/**
 * Yoinked from hextra by imfing on GitHub.
 */
import { Document } from "flexsearch";
import { logger } from "./logger";

let pageIndex: Document;
let sectionIndex: Document;

type SearchResult = {
    id: string,
    route: string,
    prefix: string,
    children: {
        title: string,
        content: string,
    },
};

const searchDataURL = config.wikisearch.index_url;

// https://github.com/TryGhost/Ghost/pull/21148
const regex = new RegExp(
    `[\u{4E00}-\u{9FFF}\u{3040}-\u{309F}\u{30A0}-\u{30FF}\u{AC00}-\u{D7A3}\u{3400}-\u{4DBF}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{2CEB0}-\u{2EBEF}\u{30000}-\u{3134F}\u{31350}-\u{323AF}\u{2EBF0}-\u{2EE5F}\u{F900}-\u{FAFF}\u{2F800}-\u{2FA1F}]|[0-9A-Za-zа-я\u00C0-\u017F\u0400-\u04FF\u0600-\u06FF\u0980-\u09FF\u1E00-\u1EFF\u0590-\u05FF]+`,
    'mug'
);

const encode = (str: string) => { return ('' + str).toLowerCase().match(regex) ?? []; }

async function preloadIndex() {
    const tokenize = 'forward';

    pageIndex = new Document({
      tokenize,
      encode,
      cache: 100,
      document: {
        id: 'id',
        store: ['title', 'crumb'],
        index: "content"
      }
    });

    sectionIndex = new Document({
      tokenize,
      encode,
      cache: 100,
      document: {
        id: 'id',
        store: ['title', 'content', 'url', 'display', 'crumb'],
        index: "content",
        tag: [{
          field: "pageId"
        }]
      }
    });

    const resp = await fetch(searchDataURL);
    const data = await resp.json();
    let pageId = 0;
    for (const route in data) {
      let pageContent = '';
      ++pageId;
      const urlParts = route.split('/').filter(x => x != "" && !x.startsWith('#'));

      let crumb = '';
      let searchUrl = '/';
      for (let i = 0; i < urlParts.length; i++) {
        const urlPart = urlParts[i];
        searchUrl += urlPart + '/'

        const crumbData = data[searchUrl];
        if (!crumbData) {
          logger.debug(`Excluded page ${searchUrl} - will not be included for search result breadcrumb for ${route}`);
          continue;
        }

        let title = data[searchUrl].title;
        if (title == "_index") {
          title = urlPart.split("-").map(x => x).join(" ");
        }
        crumb += title;

        if (i < urlParts.length - 1) {
          crumb += ' > ';
        }
      }

      for (const heading in data[route].data) {
        const [hash, text] = heading.split('#');
        const url = route.replace(/\/+$/, '') + (hash ? '#' + hash : '');
        const title = text || data[route].title;

        const content = data[route].data[heading] || '';
        const paragraphs = content.split('\n').filter(Boolean);

        sectionIndex.add({
          id: url,
          url,
          title,
          crumb,
          pageId: `page_${pageId}`,
          content: title,
          ...(paragraphs[0] && { display: paragraphs[0] })
        });

        for (let i = 0; i < paragraphs.length; i++) {
          sectionIndex.add({
            id: `${url}_${i}`,
            url,
            title,
            crumb,
            pageId: `page_${pageId}`,
            content: paragraphs[i]
          });
        }

        pageContent += ` ${title} ${content}`;
      }

      pageIndex.add({
        id: pageId,
        title: data[route].title,
        crumb,
        content: pageContent
      });
    }
  }

  /**
   * Performs a search based on the provided query and displays the results.
   * @param {Event} e - The event object.
   */
  async function search(query: string): Promise<SearchResult[]> {
    const pageResults = pageIndex.search(query, 5, { enrich: true, suggest: true })[0]?.result || [];

    const results = [];
    const pageTitleMatches: { [i: number]: number } = {};

    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];
      pageTitleMatches[i] = 0;

      // Show the top 5 results for each page
      const sectionResults = sectionIndex.search(query, 5, { enrich: true, suggest: true, tag: { 'pageId': `page_${result.id}` } })[0]?.result || [];
      let isFirstItemOfPage = true
      const occurred: Dict<boolean> = {}

      for (let j = 0; j < sectionResults.length; j++) {
        const { doc } = sectionResults[j];

        if (doc == null) continue;

        const isMatchingTitle = doc.display !== undefined
        if (isMatchingTitle) {
          pageTitleMatches[i]++
        }
        const { url, title } = doc
        const content = doc.display || doc.content

        if (occurred[url + '@' + content]) continue
        occurred[url + '@' + content] = true

        results.push({
          _page_rk: i,
          _section_rk: j,
          route: url,
          prefix: isFirstItemOfPage ? result.doc?.crumb : undefined,
          children: { title, content }
        })
        isFirstItemOfPage = false
      }
    }
    const sortedResults = results
      .sort((a, b) => {
        // Sort by number of matches in the title.
        if (a._page_rk === b._page_rk) {
          return a._section_rk - b._section_rk
        }
        if (pageTitleMatches[a._page_rk] !== pageTitleMatches[b._page_rk]) {
          return pageTitleMatches[b._page_rk] - pageTitleMatches[a._page_rk]
        }
        return a._page_rk - b._page_rk
      })
      .map(res => ({
        id: `${res._page_rk}_${res._section_rk}`,
        route: res.route,
        prefix: res.prefix,
        children: res.children
      }));
    
      return sortedResults as unknown as SearchResult[];
  }

const now = performance.now();
await preloadIndex();
const end = performance.now();

logger.debug(`Built index cache in ${end - now}ms.`);

export default {
    search
};