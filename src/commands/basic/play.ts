import config from "config.json";
import { AttachmentBuilder, Client, type Message, type SendableChannels } from "discord.js"
import type { CmdData } from "~/util/base"
import { logger } from "~/util/logger";
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'play',
}

async function play(channel: SendableChannels) {
    const file = new AttachmentBuilder("http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_play_1.webm");

    await channel.send({files: [file]});
}

async function execute(message: Message, args: string[]) {
    if (config.fun.play.enabled && message.channel.isSendable() 
        && message.member?.roles.cache.some(role => role.id === config.fun.play.role))
        await play(message.channel);
}

export default {
    data,
    execute,
}