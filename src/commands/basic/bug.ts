import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'bug',
};

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (args[0] === 'stargate') {
        await message.reply(config.texts.stargate_bug);
        return;
    }
    
    if (args[0] === 'timeless' || args[0] === 'heroes' || args[0] === 'th') {
        await message.reply(config.texts.th_bug);
        return;
    }
    
    await message.reply(config.texts.ait_bug);
}

export default {
    data,
    execute,
}