import { type Message, type SendableChannels } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'listening',
};

async function onMessage(ctx: Ctx, message: Message) {
    if (message.channel.isSendable() && message.content.toLowerCase().includes("listening") && message.mentions.has(ctx.client.user!))
        await message.reply({ stickers: ["1481417338346668162"] });
}

export default {
    data,
    onMessage,
} as Cmd
