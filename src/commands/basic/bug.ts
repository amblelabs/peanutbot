import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData } from "~/util/base"

const data: CmdData = {
    name: 'bug',
};

async function execute(message: Message, args: string[]) {
    if (args[0] === 'stargate') {
        await message.reply(config.texts.stargate_bug);
        return;
    }
    
    await message.reply(config.texts.ait_bug);
}

export default {
    data,
    execute,
}