import {type Message, MessageFlags, type SendableChannels} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
    name: 'xkcd',
};

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    const comicNum = args[0];

    // Ensure a valid numeric argument was provided
    if (!comicNum || !/^\d+$/.test(comicNum)) {
        await message.reply("Please provide a valid comic number");
        return;
    }

    try {
        // Fetch metadata from the official xkcd API
        const response = await fetch(`https://xkcd.com/${comicNum}/info.0.json`);

        if (!response.ok) {
            await message.reply(`Comic ${comicNum} not found.`);
            return;
        }

        const comicData = (await response.json()) as {
            num: number;
            title: string;
            img: string;
            alt: string;
        };

        await message.reply({
            content: `${comicData.title}\n${comicData.alt}\nhttps://xkcd.com/${comicData.num}/`,
            files: [{ attachment: comicData.img, name: `xkcd-${comicData.num}.png` }],
            flags: [MessageFlags.SuppressEmbeds]
        });
    } catch (error) {
        console.error("Error fetching xkcd comic:", error);
        await message.reply("Failed to fetch the requested XKCD comic.");
    }
}

export default {
    data,
    execute,
} as Cmd;