import config from "config.json";
import { type Message } from "discord.js";
import cache from "./cache";

const url = "http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/angry.png";

async function sendAngry(message: Message) {
    await message.reply(config.fun.wrath_text);
    await cache.uncache(url, m => message.reply(m));
}

export default {
    sendAngry,
}