import { Client } from "discord.js";
import { logger } from "~/util/logger";

export function initializeHoneypot(client: Client) {
    const HONEYPOT_CHANNEL_ID = "1520480898741567579";

    logger.info(`Honeypot security system active for channel ID: ${HONEYPOT_CHANNEL_ID}`);

    client.on("messageCreate", async (message) => {
        if (message.channelId !== HONEYPOT_CHANNEL_ID) return;
        if (message.author.id === client.user?.id || message.webhookId) return;

        if (!message.member || !message.member.bannable) {
            logger.warn(`Honeypot triggered by unbannable user (Staff/Admin): ${message.author.tag}`);
            await message.delete().catch(() => null);
            return;
        }

        try {
            const violatorTag = message.author.tag;
            const violatorId = message.author.id;

            logger.info(`HONEYPOT TRIGGERED! Attempting to ban: ${violatorTag} (${violatorId})`);

            await message.member.ban({
                deleteMessageSeconds: 7 * 24 * 60 * 60,
                reason: "Automated security ban cause honeyppot"
            });

            logger.info(`Successfully banned user ${violatorTag} and purged their message history.`);

        } catch (error) {
            logger.error(`Failed to execute honeypot ban for ID ${message.author.id}:`, error);
        }
    });
}