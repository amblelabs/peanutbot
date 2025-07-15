import config from "config.json";
import { type Message, type SendableChannels } from "discord.js"
import type { CmdData, Ctx } from "~/util/base"
import cache from "~/util/cache";

const url = "http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_pet_1.webm";

const data: CmdData = {
    name: 'pet',
}

async function play(channel: SendableChannels) {
    await cache.uncache(url, m => channel.send(m));
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (config.fun.pet.enabled && message.channel.isSendable()) {
        await play(message.channel);
    } 
}

export default {
    data,
    execute,
}