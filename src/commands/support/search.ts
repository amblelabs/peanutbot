import {
    EmbedBuilder,
    type Interaction,
    type Message,
    type SendableChannels,
    type SharedSlashCommand,
    type SlashCommandBuilder,
    type ChatInputCommandInteraction,
} from "discord.js";
import config from "config.json";
import { format, type Cmd, type CmdData, type Ctx } from "~/util/base";
import { paginate } from "~/util/paginator2";
import { createContentHighlighter } from "~/util/highlighter";

function buildSearchEmbeds(query: string, body: string): EmbedBuilder[] {
    const maxChars = 2000;
    const safeQuery = query.length > 200 ? `${query.slice(0, 197)}...` : query;
    const lines = body.split("\n").flatMap((line) =>
        line.length <= maxChars ? [line] : (line.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [line])
    );
    const pages: EmbedBuilder[] = [];
    let currentDescription = "";

    for (const line of lines) {
        if (currentDescription.length + line.length + 1 > maxChars) {
            if (currentDescription.trim()) {
                pages.push(
                    new EmbedBuilder()
                        .setTitle(`🔍 Wiki Search Results: "${safeQuery}"`)
                        .setColor("#2B2D31")
                        .setDescription(currentDescription.trim())
                );
            }
            currentDescription = line + "\n";
        } else {
            currentDescription += line + "\n";
        }
    }

    if (currentDescription.trim()) {
        pages.push(
            new EmbedBuilder()
                .setTitle(`🔍 Wiki Search Results: "${safeQuery}"`)
                .setColor("#2B2D31")
                .setDescription(currentDescription.trim())
        );
    }

    if (pages.length === 0) {
        pages.push(
            new EmbedBuilder()
                .setTitle(`🔍 Wiki Search Results: "${safeQuery}"`)
                .setColor("#2B2D31")
                .setDescription(body || "*No results found.*")
        );
    }

    pages.forEach((embed, index) => {
        embed.setFooter({ text: `Page ${index + 1} of ${pages.length}` });
    });

    return pages;
}

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
                msg.push(format(config.wikisearch.format.breadcrumbs, res.breadcrumbs?.join(" ❯ ")));
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

    try {
        await interaction.deferReply();

        const query = interaction.options.getString("query", true);
        const body = await printSearchResultsV2(ctx, query);
        const pages = buildSearchEmbeds(query, body);

        await paginate(interaction, pages);
    } catch (error) {
        console.error("[Search] Wiki search failed:", error);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ The wiki search failed. Please try again." }).catch(() => {});
        }
    }
}

async function searchByQuery(ctx: Ctx, message: Message, query: string) {
    try {
        const target = message.reference ? await message.fetchReference() : message;
        const body = await printSearchResultsV2(ctx, query);
        const pages = buildSearchEmbeds(query, body);

        const initialMessage = await target.reply({
            embeds: [pages[0]]
        });

        const messageShimObject = {
            user: message.author,
            editReply: async (options: any) => {
                return await initialMessage.edit(options);
            },
        } as unknown as ChatInputCommandInteraction;

        await paginate(messageShimObject, pages);
    } catch (error) {
        console.error("[Search] Wiki search failed:", error);
    }
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
    searchByQuery,
    printSearchResultsV2,
} as Cmd & {
    searchByQuery: (ctx: Ctx, message: Message, query: string) => Promise<void>;
    printSearchResultsV2: (ctx: Ctx, query: string) => Promise<string>;
};