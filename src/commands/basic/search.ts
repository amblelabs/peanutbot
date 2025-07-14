import type { Message } from "discord.js";
import config from "~/../config.json";
import wikisearch from "~/util/wikisearch";
import type { CmdData } from "~/util/base";

async function printSearchResults(query: string): Promise<string> {
    const result = await wikisearch.search(query);

    const msgBuilder = [
        config.texts.searching_header
    ];

    for (const res of result) {
        const title = res.prefix ?? res.children.title;
        msgBuilder.push(`- [${title}](<${config.wikisearch.base_url}${res.route}>)`);

        let content = res.children.content;

        if (content.length > config.wikisearch.max_length)
            content = content.substring(0, config.wikisearch.max_length);

        content = content + '...';
        msgBuilder.push(`> ${content}\n`);
    }

    return msgBuilder.join('\n');
}

async function execute(message: Message, args: string[]) {
    const query = args.join(' ');
    await message.reply(await printSearchResults(query));
}

const data: CmdData = {
    name: 'search',
};

export default {
    data,
    printSearchResults,
    execute
}