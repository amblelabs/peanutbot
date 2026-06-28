import type { Message } from "discord.js";
import { DataTypes, type ModelStatic, type Model } from "sequelize";
import type { Ctx, Cmd } from "../../util/base.ts";
import { logger } from "../../util/logger.ts";
import config from "config.json";

// Added the database model variable here
let HoneypotDb: ModelStatic<Model<any, any>>;

export default {
    data: {
        name: "honeypot",
    },

    // Made setup async so it can sync the database table
    setup: async (ctx: Ctx) => {
        HoneypotDb = ctx.sql.define("honeypot_stats", {
            id: { type: DataTypes.STRING, primaryKey: true },
            totalBans: { type: DataTypes.INTEGER, defaultValue: 0 },
        });
        await HoneypotDb.sync();

        logger.info(`Honeypot security system active for channel ID: ${config.honeypot.channelId}`);
    },

    onMessage: async (ctx: Ctx, message: Message) => {
        if (message.channelId !== config.honeypot.channelId) return;
        if (message.author.bot || message.webhookId) return;

        // it screams at me if i dont leave this here and idk why
        if (!message.guild) return;

        try {
            // Fetch the member first to guarantee they aren't missing from the cache
            const member = await message.guild.members.fetch(message.author.id);

            const violatorTag = message.author.tag;
            const violatorId = message.author.id;

            logger.info(`HONEYPOT TRIGGERED! Attempting to ban: ${violatorTag} (${violatorId})`);

            // Execute the ban on the fetched member
            await member.ban({
                deleteMessageSeconds: config.honeypot.deleteMessageSeconds,
                reason: config.honeypot.banDescription,
            });

            // Added: Fetch, increment, and save the all-time counter
            const [stat] = await HoneypotDb.findOrCreate({
                where: { id: "global" },
                defaults: { totalBans: 0 }
            });
            stat.set("totalBans", (stat.get("totalBans") as number) + 1);
            await stat.save();
            const allTimeBanCount = stat.get("totalBans");

            logger.info(`Successfully banned user ${violatorTag} and purged their message history. Total all-time bans: ${allTimeBanCount}`);

            // Added: Send the alert to your log channel (assuming you add logChannelId to your config)
            const logChannel = await ctx.client.channels.fetch(config.honeypot.logChannelId).catch(() => null);
            if (logChannel && logChannel.isSendable()) {
                await logChannel.send(
                    `**HONEYPOT TRIGGERED**\n**Banned:** \`${violatorTag}\` (${violatorId})\n**Total Bans (All-Time):** \`${allTimeBanCount}\``
                );
            }

        } catch (error) {
            // This will catch errors if the fetch fails (e.g., they instantly left the server)
            // or if the Discord API blocks the ban.
            logger.error(`Failed to execute honeypot ban for ID ${message.author.id}:`, error);
        }
    },
} as Cmd;