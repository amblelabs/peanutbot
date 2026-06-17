import {EmbedBuilder, type Message as DiscordMessage, type TextChannel} from "discord.js";
import { Client as StoatClient } from "revolt.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import { logger } from "~/util/logger";
import config from "../../../config.json.js"; // Reads directly from your static config
import env from "../../../env.json.js";

const data: CmdData = {
    name: "bridge",
};

const stoat = new StoatClient();

// Create a reversed lookup map for Stoat-to-Discord emoji translations at boot
const stoatToDiscordEmojis = Object.fromEntries(
    Object.entries(config.bridge.emojis).map(([discordRaw, stoatRaw]) => [stoatRaw, discordRaw])
);

/**
 * Translates Discord custom emojis into Stoat equivalents using your config map
 */
function translateDiscordToStoatEmojis(text: string): string {
    // Matches raw Discord custom emoji structures like <:name:id> or <a:name:id>
    return text.replace(/<a?:\w+:\d+>/g, (match) => {
        // FIX: Tell TS that emojis can be indexed with any arbitrary string key
        const emojiMap = config.bridge.emojis as Record<string, string>;
        return emojiMap[match] || match;
    });
}

/**
 * Translates Stoat custom emojis into Discord equivalents using your config map
 */
function translateStoatToDiscordEmojis(text: string): string {
    // Matches raw Stoat custom emoji strings like :01KHEG7QM5DPK1BSRD2SCPQNBJ:
    return text.replace(/:[0-9A-Z]{26}:/g, (match) => {
        // FIX: Do the same casting workaround for the reversed memory dictionary mapping
        const reverseEmojiMap = stoatToDiscordEmojis as Record<string, string>;
        return reverseEmojiMap[match] || match;
    });
}

/**
 * 1. DISCORD ➔ STOAT (Broadcast)
 */
async function broadcastToStoat(payload: {
    stoatChannelId: string;
    username: string;
    avatarUrl: string;
    content: string;
}) {
    try {
        const channel = await stoat.channels.fetch(payload.stoatChannelId);
        if (!channel) return;

        const parsedContent = translateDiscordToStoatEmojis(payload.content);

        await channel.sendMessage({
            content: parsedContent,
            masquerade: {
                name: payload.username,
                avatar: payload.avatarUrl,
            },
        });
    } catch (error) {
        logger.error("Failed to broadcast message into Stoat:", error);
    }
}

/**
 * 2. STOAT ➔ DISCORD (Listener)
 */
function initializeStoatListener(ctx: Ctx) {
    stoat.on("ready", () => {
        logger.info(`Logged into Stoat as ${stoat.user?.username}! Config-based gateway online.`);
    });

    stoat.on("messageCreate", async (stoatMessage) => {
        // Prevent bots from triggering infinite relay loops
        if (stoatMessage.author?.bot) return;

        try {
            // 1. FIX TS7053: Cast the channels config block as a string record
            const channelsMap = config.bridge.channels as Record<string, string>;

            // Find the Discord channel ID by performing a reverse lookup on your config channels
            const discordChannelId = Object.keys(channelsMap).find(
                (key) => channelsMap[key] === stoatMessage.channelId
            );

            if (!discordChannelId) return; // Not a mapped bridge room

            const discordChannel = await ctx.client.channels.fetch(discordChannelId);

            // 3. FIX TS2339: Cast to TextChannel so TypeScript knows the .send() method safely exists
            if (discordChannel?.isTextBased()) {
                const textChannel = discordChannel as TextChannel;

                const parsedContent = translateStoatToDiscordEmojis(stoatMessage.content ?? "");

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: stoatMessage.author?.username ?? "Stoat User",
                        // 2. FIX TS2339: Change ._id to .id to match revolt.js file schemas
                        iconURL: stoatMessage.author?.avatar
                            ? `https://autumn.revolt.chat/avatars/${stoatMessage.author.avatar.id}`
                            : undefined,
                    })
                    .setDescription(parsedContent)
                    .setColor("#2b2d31");

                // This now references the writeable text channel safely
                await textChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error("Error parsing message delivery from Stoat:", error);
        }
    });

    if (env.bridge.stoat.token) {
        stoat.loginBot(env.bridge.stoat.token);
    } else {
        logger.error("Missing 'stoatToken' configuration key inside env.json!");
    }
}

export default {
    data,

    // Setup loop called by index.ts during startup sequence
    setup(ctx: Ctx) {
        // Start up the live WebSocket pipeline
        initializeStoatListener(ctx);
    },

    // Real-time message listener called by index.ts
    async onMessage(ctx: Ctx, message: DiscordMessage) {
        if (message.author.bot) return;

        try {
            // Look up if this Discord channel maps to a Stoat room inside your config file
            const channelsMap = config.bridge.channels as Record<string, string>;
            const stoatChannelId = channelsMap[message.channelId];
            if (!stoatChannelId) return;

            await broadcastToStoat({
                stoatChannelId,
                username: message.member?.displayName ?? message.author.username,
                avatarUrl: message.author.displayAvatarURL({ size: 256 }),
                content: message.content,
            });
        } catch (error) {
            logger.error("Error processing stream forwarding logic:", error);
        }
    },
} as Cmd;