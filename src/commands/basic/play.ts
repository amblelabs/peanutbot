import config from "config.json";
import { AttachmentBuilder, type Message, type SendableChannels } from "discord.js"
import type { CmdData, Ctx } from "~/util/base"
import wrath from "~/util/angry";
import cache from "~/util/cache";
import rnd from "~/util/rnd";

const url = "http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_play_1.webm";

const data: CmdData = {
    name: 'play',
}

async function play(channel: SendableChannels) {
    cache.uncache(url, m => channel.send(m));
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (config.fun.play.enabled && message.channel.isSendable()) {
        const hasRole = message.member?.roles.cache.has(config.fun.play.role);
        
        if (!hasRole) {
            wrath.sendAngry(message);
            return;
        }
        
        await play(message.channel);
    } 
}

async function onMessage(ctx: Ctx, message: Message) {
    if (message.content.toLowerCase().includes("high five") && message.mentions.has(ctx.client.user!))
        message.reply(rnd.pickRandom(config.fun.highfives));
}

export default {
    data,
    execute,
    onMessage,
}