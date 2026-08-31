import { type Message, type SendableChannels } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'hang',
};

function makeReplySkye(): string {
    return 'https://images-ext-1.discordapp.net/external/sqwOuPQPml48TOP_P1sIyee0_fp-UCOJpOi7bdfI728/https/static.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/6b/f5/XA77J1GDlWiBHmd74.mp4';
}
function makeReplyNyx(): string {
    return 'https://cdn.discordapp.com/attachments/1213989170964340885/1378558565463101460/Jellys_been_bad.gif';
}

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    switch(args[0]) {
        case ('jelly'):
            await message.reply(makeReplyNyx());
            break;
        case ('kelly'):
            await message.reply(makeReplyNyx());
            break
        case ('nyx'):
            await message.reply(makeReplyNyx());
            break
case ('skye'):
            await message.reply(makeReplySkye());
            break

    }
}

export default {
    data,
    execute,
} as Cmd
