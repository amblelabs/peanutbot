import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'help',
};

async function execute(ctx: Ctx, message: Message, args: string[]) {
    await message.reply({ content: config.texts.help_text })
}

export default {
    data,
    execute,
}