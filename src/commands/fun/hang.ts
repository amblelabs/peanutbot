import { type Message, type SendableChannels } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'hang',
};

function makeReply(): string {
    return 'https://cdn.discordapp.com/attachments/1213989170964340885/1378558565463101460/Jellys_been_bad.gif';
}

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    switch(args[0]) {
        case ('jelly'):
            await message.reply(makeReply());
            break;
        case ('kelly'):
            await message.reply(makeReply());
            break
    }
}

export default {
    data,
    execute,
} as Cmd