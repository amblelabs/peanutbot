import config from "config.json";
import { AttachmentBuilder, type Message, type SendableChannels } from "discord.js"
import type { CmdData } from "~/util/base"

const data: CmdData = {
    name: 'play',
}

async function play(channel: SendableChannels) {
    const file = new AttachmentBuilder("http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_play_1.webm");

    await channel.send({files: [file]});
}

async function execute(message: Message, args: string[]) {
    if (config.fun.play.enabled && message.channel.isSendable()) {
        const hasRole = message.member?.roles.cache.some(role => role.id === config.fun.play.role);
        
        if (!hasRole) {
    		const file = new AttachmentBuilder("http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/angry.png");
			await message.reply({files: [file]})
            return;
        }
        
        await play(message.channel);
    } 
}

export default {
    data,
    execute,
}