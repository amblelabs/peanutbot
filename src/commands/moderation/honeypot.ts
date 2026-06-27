import type { Message } from "discord.js";
import type { Ctx, Cmd } from "~/util/base.ts";
import { logger } from "~/util/logger.ts";
import config from "config.json";
// 👇 PASTE YOUR TRAP CHANNEL ID HERE
const HONEYPOT_CHANNEL_ID = config.honeypot.channelId;

export default {
    data: {
        name: "honeypot",
    },

    setup: (ctx: Ctx) => {
        logger.info(`Honeypot security system active for channel ID: ${HONEYPOT_CHANNEL_ID}`);
    },

    onMessage: async (ctx: Ctx, message: Message) => {
        if (message.channelId !== HONEYPOT_CHANNEL_ID) return;
        if (message.author.bot || message.webhookId) return;

        // it screams at me if i dont leave this here and idk why
        if (!message.guild) return;

        try {
            // 👇 Fetch the member first to guarantee they aren't missing from the cache
            const member = await message.guild.members.fetch(message.author.id);

            const violatorTag = message.author.tag;
            const violatorId = message.author.id;

            logger.info(`HONEYPOT TRIGGERED! Attempting to ban: ${violatorTag} (${violatorId})`);

            // Execute the ban on the fetched member
            await member.ban({
                deleteMessageSeconds: config.honeypot.deleteMessageSeconds,
                reason: config.honeypot.banDescription,
            });

            logger.info(`Successfully banned user ${violatorTag} and purged their message history.`);
        } catch (error) {
            // This will catch errors if the fetch fails (e.g., they instantly left the server)
            // or if the Discord API blocks the ban.
            logger.error(`Failed to execute honeypot ban for ID ${message.author.id}:`, error);
        }
    },
} as Cmd;