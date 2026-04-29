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
import { format, type Cmd, type CmdData, type Ctx } from "~/util/base";
import path from "node:path";
import { logger } from "~/util/logger";
import {
  paginate,
  paginateReply,
  paginateReplyMessage,
} from "~/util/paginator";
import { createContentHighlighter } from "~/util/highlighter";

async function printSearchResultsV2(ctx: Ctx, query: string): Promise<string> {
  const result = await ctx.search.search(query);
  const msg = [config.wikisearch.format.header];

  if (!result.length) {
    msg.push(config.wikisearch.format.empty);
    return msg.join(config.wikisearch.format.sep);
  }

  const highlighter = createContentHighlighter(query);

  let pageCounter = 0;

  for (const res of result) {
    switch (res.type) {
      case "page":
        msg.push(
          format(config.wikisearch.format.page, {
            num: pageCounter + 1,
            title: res.content,
            url: config.wikisearch.baseUrl + res.url,
          }),
        );

        msg.push(
          format(
            config.wikisearch.format.breadcrumbs,
            res.breadcrumbs?.join(" ❯ "),
          ),
        );

        pageCounter += 1;
        break;

      case "heading":
        msg.push(format(config.wikisearch.format.header, res.content));
        break;

      case "text":
        const content = highlighter
          .highlightMarkdown(res.content)
          .split("\n")
          .map((s) => format(config.wikisearch.format.text, s))
          .join("\n");

        msg.push(content);
        break;
    }
  }

  return msg.join(config.wikisearch.format.sep);
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const query = interaction.options.getString("query", true);

  await paginateReply(
    interaction,
    await Promise.all([
      format(config.wikisearch.format.results, query),
      printSearchResultsV2(ctx, query),
    ]),
  );
}

async function searchByQuery(ctx: Ctx, message: Message, query: string) {
  const target = message.reference ? await message.fetchReference() : message;

  await paginateReplyMessage(target, await printSearchResultsV2(ctx, query));
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  const query = args.join(" ");
  await searchByQuery(ctx, message, query);
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder
    .setDescription("Search the wiki.")
    .addStringOption((option) =>
      option.setName("query").setRequired(true).setDescription("Search query."),
    );
}

const data: CmdData = {
  name: "search",
};

export default {
  data,
  slash,
  onInteraction,
} as Cmd & {
  searchByQuery: (arg0: Ctx, arg1: Message, arg2: string) => Promise<void>;
};
