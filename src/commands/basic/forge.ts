import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'forge',
};

async function execute(ctx: Ctx, message: Message, args: string[]) {
    await message.reply(config.texts.forge_faq);
}

export default {
    data,
    execute,
}