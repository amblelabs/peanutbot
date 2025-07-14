import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData } from "~/util/base"
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'peanut',
};

async function execute(message: Message, args: string[]) {
    await message.reply({stickers: [rnd.pickRandom(config.texts.peanuts)]});
}

export default {
    data,
    execute,
}