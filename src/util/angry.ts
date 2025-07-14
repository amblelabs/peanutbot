import config from "config.json";
import { AttachmentBuilder, type Message } from "discord.js";

async function sendAngry(message: Message) {
    const file = new AttachmentBuilder("http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/angry.png");
    await message.reply({content: config.fun.wrath_text, files:[file]});
}

export default {
    sendAngry,
}