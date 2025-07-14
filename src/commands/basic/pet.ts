import config from "config.json";
import { AttachmentBuilder, type Message, type SendableChannels } from "discord.js"
import type { CmdData, Ctx } from "~/util/base"
import wrath from "~/util/angry";

const data: CmdData = {
    name: 'pet',
}

async function play(channel: SendableChannels) {
    const file = new AttachmentBuilder("http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_pet_1.webm");

    await channel.send({files: [file]});
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