import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData } from "~/util/base"

const data: CmdData = {
    name: 'wiki',
};

async function execute(message: Message, args: string[]) {
    if (args[0] === 'stargate') {
        await message.reply(config.texts.stargate_wiki);
        return;
    }
    
    await message.reply(config.texts.ait_wiki);
}

export default {
    data,
    execute,
}