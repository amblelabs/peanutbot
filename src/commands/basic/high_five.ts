import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base";
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'internal/high_five',
}

async function onMessage(ctx: Ctx, message: Message) {
    if (message.content.toLowerCase().includes("high five") && message.mentions.has(ctx.client.user!))
        message.reply(rnd.pickRandom(config.fun.highfives));
}

export default {
    data,
    onMessage,
}