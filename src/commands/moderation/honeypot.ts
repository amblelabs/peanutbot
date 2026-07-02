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
                id: "global",
                totalBans: 0
            }
        });
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

            await HoneypotStat.increment("totalBans", {
                by: 1,
                where: { id: "global" }
            });

            const stat = await HoneypotStat.findByPk("global");
            const trueBanCount = stat?.totalBans ?? 0;

            logger.info(`Successfully banned user ${violatorTag}. Total all-time bans: ${trueBanCount}`);

            // 👇 Cleaned up: No inline .catch(), no null checks. Just straight to the point.
            const logChannel = await ctx.client.channels.fetch(config.honeypot.logChannelId);
            if (logChannel.isSendable()) {
                await logChannel.send(
                    `**HONEYPOT TRIGGERED**\n**Banned:** \`${violatorTag}\` (${violatorId})\n**Total Bans (All-Time):** \`${trueBanCount}\``
                );
            }
        } catch (error) {
            logger.error(`Failed to execute honeypot ban sequence:`, error);
        }
    },
} as Cmd;