import type { Message } from "discord.js";
import type { Ctx, Cmd } from "../../util/base.ts";
import { logger } from "../../util/logger.ts";

// 👇 PASTE YOUR TRAP CHANNEL ID HERE
const HONEYPOT_CHANNEL_ID = "1520480898741567579";

const honeypotModule: Cmd = {
    data: {
        name: "honeypot",
    },

    setup: (ctx: Ctx) => {
        logger.info(`Honeypot security system active for channel ID: ${HONEYPOT_CHANNEL_ID}`);
    },

    onMessage: async (ctx: Ctx, message: Message) => {
        if (message.channelId !== HONEYPOT_CHANNEL_ID) return;
        if (message.author.id === ctx.client.user?.id || message.webhookId) return;

        // Ensure this is happening inside a server, not a DM
        if (!message.guild) return;

        try {
            // 👇 Fetch the member first to guarantee they aren't missing from the cache
            const member = await message.guild.members.fetch(message.author.id);

            // Safety check: Don't try to ban server owners or admins
            if (!member.bannable) {
                logger.warn(`Honeypot triggered by unbannable user (Staff/Admin): ${message.author.tag}`);
                await message.delete().catch(() => null);
                return;
            }

            const violatorTag = message.author.tag;
            const violatorId = message.author.id;

            logger.info(`HONEYPOT TRIGGERED! Attempting to ban: ${violatorTag} (${violatorId})`);

            // Execute the ban on the fetched member
            await member.ban({
                deleteMessageSeconds: 7 * 24 * 60 * 60,
                reason: "Automated ban, they went in the honeypot",
            });

            logger.info(`Successfully banned user ${violatorTag} and purged their message history.`);
        } catch (error) {
            // This will catch errors if the fetch fails (e.g., they instantly left the server)
            // or if the Discord API blocks the ban.
            logger.error(`Failed to execute honeypot ban for ID ${message.author.id}:`, error);
        }
    },
};

export default honeypotModule;