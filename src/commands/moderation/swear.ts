import config from "../../../config.json"; // 👈 Make sure this path is correct for your file structure!
import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
    name: 'swear',
};

async function onMessage(ctx: Ctx, message: Message) {
    // 1. Guard: Ignore bots, DMs (no guild), and unsendable channels
    if (!message.inGuild() || !message.channel.isSendable() || message.author.bot) return;

    // 3. Check if they pinged the bot AND said the trigger word (lowercased!)
    const swear = message.mentions.has(ctx.client.user!.id) && message.content.includes("BITCH!");

    if (swear) {
        try {
            // 4. Fetch the member using the message.guild object
            const member = await message.guild.members.fetch(message.author.id);
            // 5. Apply the timeout
            if (member) {
                message.reply(config.swear.reply)
                await member.timeout(config.swear.period, "peanut: swore at me :(");
            }
        } catch (error) {
            // This catches errors if the bot lacks permissions to timeout the user
            console.error("❌ Failed to timeout user:", error);
        }
    }
}

export default {
    data,
    onMessage,
} as Cmd;