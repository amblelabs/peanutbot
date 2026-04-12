import type {
  Interaction,
  InteractionReplyOptions,
  Message,
  MessagePayload,
  SendableChannels,
  SharedSlashCommand,
  SlashCommandBuilder,
} from "discord.js";
import config from "config.json";
import wikisearch from "~/util/wikisearch";
import { format, type Cmd, type CmdData, type Ctx } from "~/util/base";
import path from "node:path";
import { logger } from "~/util/logger";
import {
  paginate,
  paginateReply,
  paginateReplyMessage,
} from "~/util/paginator";
import { createContentHighlighter } from "~/util/highlighter";

async function printSearchResults(query: string): Promise<string> {
  const result = await wikisearch.search(query);
  if (!result) return config.wikisearch.empty;

  const msgBuilder = [config.wikisearch.header];

  for (const res of result) {
    const title = res.prefix ?? res.children.title;
    msgBuilder.push(
      `\n- [${title}](<${config.wikisearch.baseUrl}${res.route}>)`,
    );

    let content = res.children.content.trim();
    msgBuilder.push(`> ${content}\n`);
  }

  return msgBuilder.join("\n");
}

async function printSearchResultsV2(ctx: Ctx, query: string): Promise<string> {
  const result = await ctx.search.search(query);
  if (!result) return config.wikisearch.empty;

  const highlighter = createContentHighlighter(query);
  const msg = [config.wikisearch2.header];

  let pageCounter = 0;

  for (const res of result) {
    switch (res.type) {
      case "page":
        msg.push(
          format(config.wikisearch2.format.page, {
            num: pageCounter + 1,
            title: res.content,
            url: config.wikisearch2.baseUrl + res.url,
          }),
        );

        msg.push(
          format(
            config.wikisearch2.format.breadcrumbs,
            res.breadcrumbs?.join(" ❯ "),
          ),
        );

        pageCounter += 1;
        break;

      case "heading":
        msg.push(format(config.wikisearch2.format.header, res.content));
        break;

      case "text":
        const content = highlighter.highlightMarkdown(res.content);
        msg.push(format(config.wikisearch2.format.text, content));
        break;
    }
  }

  return msg.join(config.wikisearch2.format.sep);
}

async function searchByQuery(ctx: Ctx, message: Message, query: string) {
  const target = message.reference ? await message.fetchReference() : message;

  await paginateReplyMessage(target, [
    ...(await printSearchResults(query)),
    ...(await printSearchResultsV2(ctx, query)),
  ]);
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const query = interaction.options.getString("query", true);

  await paginateReply(interaction, [
    ...(await printSearchResults(query)),
    ...(await printSearchResultsV2(ctx, query)),
  ]);
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  const query = args.join(" ");
  searchByQuery(ctx, message, query);
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder
    .setDescription("Search the wiki.")
    .addStringOption((option) =>
      option.setName("query").setRequired(true).setDescription("Search query."),
    );
}

async function setup(ctx: Ctx) {
  try {
    const resp = await fetch(config.wikisearch.indexUrl, {
      signal: AbortSignal.timeout(5000),
    });
    const json = await resp.json();
    wikisearch.preloadIndex(json);
  } catch (e) {
    logger.warn("Failed to fetch index, using fallback!");
    logger.error(e);
    const indexPath = path.resolve(__dirname, "../../../index.json");
    const data = require(indexPath);
    wikisearch.preloadIndex(data);
  }
}

const data: CmdData = {
  name: "search",
};

export default {
  data,
  slash,
  setup,
  onInteraction,

  searchByQuery,
  printSearchResults,
} as Cmd & {
  printSearchResults: (arg0: string) => Promise<string>;
  searchByQuery: (arg0: Ctx, arg1: Message<true>, arg2: string) => any;
};
