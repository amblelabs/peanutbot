import { EmbedBuilder, type Message } from "discord.js";
import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes
} from "sequelize";
import type { Ctx, Cmd } from "../../util/base.ts";
import { logger } from "../../util/logger.ts";
import config from "config.json";

export class HoneypotStat extends Model<
    InferAttributes<HoneypotStat>,
    InferCreationAttributes<HoneypotStat>
> {
    declare id: string;
    declare totalBans: CreationOptional<number>;
}

// REMOVED: let cachedBanCount = 0;

export default {
    data: {
        name: "honeypot",
    },

    setup: async (ctx: Ctx) => {
        HoneypotStat.init(
            {
                id: { type: DataTypes.STRING, primaryKey: true },
                totalBans: { type: DataTypes.INTEGER, defaultValue: 0 },
            },
            { sequelize: ctx.sql }
        );

        await HoneypotStat.sync();

        const [stat] = await HoneypotStat.findOrCreate({
            where: { id: "global" },
            defaults: {
                id: "global", // 👇 Add this line to satisfy the TypeScript compiler
                totalBans: 0
            }
        });

        logger.info(`Honeypot security system active for channel ID: ${config.honeypot.channelId}. All-time bans: ${stat.totalBans}`);
    },

    onMessage: async (ctx: Ctx, message: Message) => {
        if (message.channelId !== config.honeypot.channelId) return;
        if (message.author.bot || message.webhookId) return;
        if (!message.guild) return;

        try {
            const member = await message.guild.members.fetch(message.author.id);
            const violatorTag = message.author.tag;
            const violatorId = message.author.id;
            const displayName = member.user.globalName || member.user.username;

            logger.info(`HONEYPOT TRIGGERED! Attempting to ban: ${violatorTag} (${violatorId})`);

            await member.ban({
                deleteMessageSeconds: config.honeypot.deleteMessageSeconds,
                reason: config.honeypot.banDescription,
            });

            // 👇 1. Atomically increment the database first (Immune to race conditions)
            await HoneypotStat.increment("totalBans", {
                by: 1,
                where: { id: "global" }
            });

            // 👇 2. Fetch the newly updated row to get the guaranteed accurate count
            const stat = await HoneypotStat.findByPk("global");
            const trueBanCount = stat?.totalBans ?? 0;

            logger.info(`Successfully banned user ${violatorTag}. Total all-time bans: ${trueBanCount}`);

            const logChannel = await ctx.client.channels.fetch(config.honeypot.logChannelId).catch(() => null);
            if (logChannel && logChannel.isSendable()) {
                await logChannel.send(
                    `**HONEYPOT TRIGGERED**\n**Banned:** \`${violatorTag}\` (${violatorId})\n**Total Bans (All-Time):** \`${trueBanCount}\``
                );
            }
        } catch (error) {
            logger.error(`Failed to execute honeypot ban for ID ${message.author.id}:`, error);
        }
    },
} as Cmd;