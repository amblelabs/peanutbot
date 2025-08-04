import type { Interaction, Message, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import config from "config.json";
import wikisearch from "~/util/wikisearch";
import type { CmdData, Ctx } from "~/util/base";
import path from "node:path";
import { logger } from "~/util/logger";
import { trimJoin } from "~/util/breaker";

async function printSearchResults(query: string): Promise<string> {
    const result = await wikisearch.search(query);
    const msgBuilder = [];

    for (const res of result) {
        const title = res.prefix ?? res.children.title;
        msgBuilder.push(`\n- [${title}](<${config.wikisearch.base_url}${res.route}>)`);

        let content = res.children.content.trim();
        msgBuilder.push(`> ${content}\n`);
    }

    if (msgBuilder.length == 0)
        return config.texts.searching_empty;

    return trimJoin({ texts: msgBuilder, prefix: config.texts.searching_header });
}

async function searchByQuery(ctx: Ctx, message: Message, query: string) {
    const target = message.reference ? await message.fetchReference() : message;
    await target.reply(await printSearchResults(query));
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    const query = args.join(' ');
    searchByQuery(ctx, message, query);
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('Search the wiki.')
        .addStringOption(option =>
            option.setName('query')
                .setRequired(true)
                .setDescription('Search query.')
        );
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const query = interaction.options.getString('query', true);
    await interaction.reply(await printSearchResults(query));
}

async function setup(ctx: Ctx) {
    try {
        const resp = await fetch(config.wikisearch.index_url, { signal: AbortSignal.timeout(5000) });
        const json = await resp.json();
        wikisearch.preloadIndex(json);
    } catch (e) {
        logger.warn('Failed to fetch index, using fallback!');
        const indexPath = path.resolve(__dirname, '../../../index.json');
        const data = require(indexPath);
        wikisearch.preloadIndex(data);
    }
}

const data: CmdData = {
    name: 'search',
};

export default {
    data,
    printSearchResults,
    slash,
    setup,
    onInteraction,
    execute,
    searchByQuery,
}