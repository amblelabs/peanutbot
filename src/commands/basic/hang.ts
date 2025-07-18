import { type Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'hang',
};

function makeReply(): string {
    return 'https://cdn.discordapp.com/attachments/1213989170964340885/1378558565463101460/Jellys_been_bad.gif';
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (args[0] === 'jelly') await message.reply(makeReply());
}

export default {
    data,
    execute,
}