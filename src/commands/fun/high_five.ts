import config from "config.json";
import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'high_five',
}

async function onMessage(ctx: Ctx, message: Message) {
    if (message.channel.isSendable() && message.content.toLowerCase().includes("high five") && message.mentions.has(ctx.client.user!))
        message.reply(rnd.pickRandom(config.fun.highfives));
}

export default {
    data,
    onMessage,
} as Cmd