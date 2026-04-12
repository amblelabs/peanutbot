/* God bless Fuma: https://github.com/fuma-nama/fumadocs/blob/8999346b6b0888398b01a60f8864ab70ce8cdf9d/packages/core/src/search/index.ts#L54 */

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegexFromQuery(q: string): RegExp | null {
  const trimmed = q.trim();
  if (trimmed.length === 0) return null;
  const terms = Array.from(new Set(trimmed.split(/\s+/).filter(Boolean)));
  if (terms.length === 0) return null;
  const escaped = terms.map(escapeRegExp).join("|");
  return new RegExp(`(${escaped})`, "gi");
}

export interface HighlightedText<Content = string> {
  type: "text";
  content: Content;
  styles?: {
    highlight?: boolean;
  };
}

export function createContentHighlighter(query: string | RegExp) {
  const regex = typeof query === "string" ? buildRegexFromQuery(query) : query;

  return {
    highlightMarkdown(content: string): string {
      return highlightMarkdown(this.highlight(content));
    },
    highlight(content: string): HighlightedText[] {
      if (!regex) return [{ type: "text", content }];
      const out: HighlightedText[] = [];

      let i = 0;
      for (const match of content.matchAll(regex)) {
        if (i < match.index) {
          out.push({
            type: "text",
            content: content.substring(i, match.index),
          });
        }

        out.push({
          type: "text",
          content: match[0],
          styles: {
            highlight: true,
          },
        });

        i = match.index + match[0].length;
      }

      if (i < content.length) {
        out.push({
          type: "text",
          content: content.substring(i),
        });
      }

      return out;
    },
  };
}

export function highlightMarkdown(highlighted: HighlightedText[]): string {
  let builder = "";
  for (const subtext of highlighted) {
    let scontent = subtext.content;
    if (subtext.styles?.highlight) {
      scontent = "__" + scontent + "__";
    }

    builder += scontent;
  }

  return builder;
}
