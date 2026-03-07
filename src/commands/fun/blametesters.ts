import config from "config.json";
import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'blame',
};

async function onMessage(ctx: Ctx, message: Message) {
    if (!message.channel.isSendable()) return;
    if (!message.mentions.has(ctx.client.user!)) return;

    const c = message.content.toLowerCase();

    if (c.includes("who") && (c.includes("responsible") || c.includes("blame")))
        message.reply(rnd.pickRandom(config.fun.blame));
}

export default {
    data,
    onMessage,
} as Cmd
