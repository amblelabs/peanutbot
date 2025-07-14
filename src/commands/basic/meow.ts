import config from "config.json";
import { AttachmentBuilder, Client, type Message, type SendableChannels } from "discord.js"
import type { CmdData } from "~/util/base"
import { logger } from "~/util/logger";
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'meow',
}

async function meow(channel: SendableChannels) {
    const file = new AttachmentBuilder("http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_meow_1.webm");

    await channel.send({files: [file]});
}

async function execute(message: Message, args: string[]) {
    if (config.fun.meow.enabled && message.channel.isSendable() 
        && message.member?.roles.cache.some(role => role.id === config.fun.meow.force_role))
        await meow(message.channel);
}

function randomize(): number {
    const minutes = rnd.getRandomIntInclusive(config.fun.meow.min, config.fun.meow.max);
    const seconds = minutes * 60;
    
    logger.debug(`Meow scheduled for ${minutes} minutes.`);
    return seconds * 1000;
}

async function setup(client: Client) {
    async function f() {
        const channel = client.channels.cache.get(config.fun.meow.channel);
       
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