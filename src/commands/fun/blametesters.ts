import config from "config.json";
import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'blame',
};

async function onMessage(ctx: Ctx, message: Message) {
    if (!message.channel.isSendable()) return;

    const c = message.content.toLowerCase();

    const responsible = message.mentions.has(ctx.client.user!) && (c.includes("who") && (c.includes("responsible") || c.includes("blame")));
    const misc = (c.includes("gamebreaking") || c.includes("game-breaking")) && c.includes("bug") 
        || c.includes("no updates") || c.includes("release was") || c.includes("update was")
        || (c.includes("release") || c.includes("mod") || c.includes("upate")) && (c.includes("lag") || c.includes("bug"));

    if (responsible || misc)
        message.reply(rnd.pickRandom(config.fun.blame));
}

export default {
    data,
    onMessage,
} as Cmd
