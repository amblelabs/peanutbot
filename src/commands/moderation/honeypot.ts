import { EmbedBuilder, type Message } from "discord.js";
import { DataTypes, type ModelStatic, type Model } from "sequelize";
import type { Ctx, Cmd } from "../../util/base.ts";
import { logger } from "../../util/logger.ts";
import config from "config.json";

// Added the database model variable here
let HoneypotDb: ModelStatic<Model<any, any>>;

// 👇 1. Added a cache variable to hold the count in memory
let cachedBanCount = 0;

export default {
    data: {
        name: "honeypot",
    },

    setup: async (ctx: Ctx) => {
        HoneypotDb = ctx.sql.define("honeypot_stats", {
            id: { type: DataTypes.STRING, primaryKey: true },
            totalBans: { type: DataTypes.INTEGER, defaultValue: 0 },
        });
        await HoneypotDb.sync();

        // 👇 2. Guarantee the row exists and cache the count ONCE when the bot starts
        const [stat] = await HoneypotDb.findOrCreate({
            where: { id: "global" },
            defaults: { totalBans: 0 }
        });
        cachedBanCount = stat.get("totalBans") as number;

        logger.info(`Honeypot active for channel ID: ${config.honeypot.channelId}. All-time bans: ${cachedBanCount}`);
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
            const displayName = member.user.globalName || member.user.username;

            logger.info(`HONEYPOT TRIGGERED! Attempting to ban: ${violatorTag} (${violatorId})`);

            // Execute the ban on the fetched member
            await member.ban({
                deleteMessageSeconds: config.honeypot.deleteMessageSeconds,
                reason: config.honeypot.banDescription,
            });

            // 👇 3. The Optimization!
            // Update the memory instantly, then fire off exactly ONE SQL operation (UPDATE)
            cachedBanCount++;
            await HoneypotDb.update(
                { totalBans: cachedBanCount },
                { where: { id: "global" } }
            );

            logger.info(`Successfully banned user ${violatorTag} and purged their message history. Total all-time bans: ${cachedBanCount}`);

            // Send the alert to your log channel
            const logChannel = await ctx.client.channels.fetch(config.honeypot.logChannelId).catch(() => null);
            if (logChannel && logChannel.isSendable()) {
                await logChannel.send(
                    `**HONEYPOT TRIGGERED**\n**Banned:** \`${violatorTag}\` (${violatorId})\n**Total Bans (All-Time):** \`${cachedBanCount}\``
                );
            }

      /*      const dossierChannel = await ctx.client.channels.fetch(config.honeypot.dossierChannelId).catch(() => null);
            if (dossierChannel && dossierChannel.isSendable()) {
                const banPost = new EmbedBuilder()
                    .setTitle(`${displayName} / ${violatorId}`)
                    .setDescription(`Punishment: Ban\nBy <@${ctx.client.user?.id}>\nLength: Permanent\nReason: HONEYPOT\n`)
                    .setColor(0xFF0000); // Adds a nice red warning color to the side of the post

                await dossierChannel.send({ embeds: [banPost] });
            }*/
        } catch (error) {
            // This will catch errors if the fetch fails (e.g., they instantly left the server)
            // or if the Discord API blocks the ban.
            logger.error(`Failed to execute honeypot ban for ID ${message.author.id}:`, error);
        }
    },
} as Cmd;