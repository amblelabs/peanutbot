import config from "config.json";
import { type Message, type SendableChannels } from "discord.js"
import type { CmdData, Ctx } from "~/util/base"
import { logger } from "~/util/logger";
import rnd from "~/util/rnd";
import wrath from "~/util/angry";
import cache from "~/util/cache";

const url = "http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_meow_1.webm";

const data: CmdData = {
    name: 'meow',
}

async function meow(channel: SendableChannels) {
    cache.uncache(url, m => channel.send(m));
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (config.fun.meow.enabled && message.channel.isSendable()) {
        const hasRole = message.member?.roles.cache.has(config.fun.meow.force_role);

        if (!hasRole) {
            wrath.sendAngry(message);
            return;
        }

        meow(message.channel);
    } 
}

function randomize(): number {
    const minutes = rnd.getRandomIntInclusive(config.fun.meow.min, config.fun.meow.max);
    const seconds = minutes * 60;
    
    logger.debug(`Meow scheduled for ${minutes} minutes.`);
    return seconds * 1000;
}

async function setup(ctx: Ctx) {
    async function f() {
        const channel = ctx.client.channels.cache.get(config.fun.meow.channel);
       
        setTimeout(f, randomize());

        if (channel?.isSendable())
            await meow(channel)
    }

    if (config.fun.meow.enabled)
        setTimeout(f, randomize());
}

export default {
    data,
    setup,
    execute,
}