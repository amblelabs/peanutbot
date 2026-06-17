import { EmbedBuilder, type Message as DiscordMessage, type TextChannel } from "discord.js";
import { Client as StoatClient } from "revolt.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import { logger } from "~/util/logger";
import config from "../../../config.json.js";
import env from "../../../env.json.js";

const data: CmdData = {
    name: "bridge",
};

const stoat = new StoatClient();

const stoatToDiscordEmojis = Object.fromEntries(
    Object.entries(config.bridge.emojis).map(([discordRaw, stoatRaw]) => [stoatRaw, discordRaw])
);

function translateDiscordToStoatEmojis(text: string): string {
    return text.replace(/<a?:\w+:\d+>/g, (match) => {
        const emojiMap = config.bridge.emojis as Record<string, string>;
        return emojiMap[match] || match;
    });
}

function translateStoatToDiscordEmojis(text: string): string {
    return text.replace(/:[0-9A-Z]{26}:/g, (match) => {
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
    attachments?: { url: string; name: string }[];
}) {
    try {
        const channel = await stoat.channels.fetch(payload.stoatChannelId);
        if (!channel) return;

        const parsedContent = translateDiscordToStoatEmojis(payload.content);
        const uploadedFileIds: string[] = [];

        // If there are files, upload them to Stoat's Autumn server first
        if (payload.attachments && payload.attachments.length > 0) {
            const autumnUrl = stoat.configuration?.features.autumn.url || "https://autumn.revolt.chat";

            for (const file of payload.attachments) {
                try {
                    const response = await fetch(file.url);
                    const blob = await response.blob();

                    const form = new FormData();
                    form.append("file", blob, file.name);

                    const uploadRes = await fetch(`${autumnUrl}/attachments`, {
                        method: "POST",
                        body: form,
                    });

                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json() as { id: string };
                        uploadedFileIds.push(uploadData.id);
                    } else {
                        logger.warn(`Failed to upload ${file.name} to Stoat: ${uploadRes.status}`);
                    }
                } catch (err) {
                    logger.error(`Error processing attachment ${file.name}:`, err);
                }
            }
        }

        const finalContent = parsedContent.trim() ? parsedContent : undefined;

        // Skip if message has absolutely no text and no files
        if (!finalContent && uploadedFileIds.length === 0) return;

        await channel.sendMessage({
            content: finalContent,
            attachments: uploadedFileIds.length > 0 ? uploadedFileIds : undefined,
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
        if (stoatMessage.author?.bot) return;

        try {
            const channelsMap = config.bridge.channels as Record<string, string>;
            const discordChannelId = Object.keys(channelsMap).find(
                (key) => channelsMap[key] === stoatMessage.channelId
            );

            if (!discordChannelId) return;

            const discordChannel = await ctx.client.channels.fetch(discordChannelId);

            if (discordChannel?.isTextBased()) {
                const textChannel = discordChannel as TextChannel;
                const parsedContent = translateStoatToDiscordEmojis(stoatMessage.content ?? "");

                const discordFiles: string[] = [];
                if (stoatMessage.attachments && stoatMessage.attachments.length > 0) {
                    const autumnUrl = stoat.configuration?.features.autumn.url || "https://autumn.revolt.chat";
                    for (const attachment of stoatMessage.attachments) {
                        discordFiles.push(`${autumnUrl}/attachments/${attachment.id}/${attachment.filename}`);
                    }
                }

                if (!parsedContent.trim() && discordFiles.length === 0) return;

                // 🌟 FIX: Fallback chain to prioritize Server Nickname -> Global Display Name -> Unique Handle
                const displayName =
                    stoatMessage.member?.displayName ??
                    stoatMessage.author?.displayName ??
                    stoatMessage.author?.username ??
                    "Stoat User";

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: displayName, // <-- Uses the clean display name now
                        iconURL: stoatMessage.author?.avatar
                            ? `https://autumn.revolt.chat/avatars/${stoatMessage.author.avatar.id}`
                            : undefined,
                    })
                    .setColor("#2b2d31");

                if (parsedContent.trim()) {
                    embed.setDescription(parsedContent);
                }

                await textChannel.send({
                    embeds: [embed],
                    files: discordFiles
                });
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
    setup(ctx: Ctx) {
        initializeStoatListener(ctx);
    },
    async onMessage(ctx: Ctx, message: DiscordMessage) {
        // Skip bots or messages that have zero text AND zero files
        if (message.author.bot || (!message.content && message.attachments.size === 0)) return;

        try {
            const channelsMap = config.bridge.channels as Record<string, string>;
            const stoatChannelId = channelsMap[message.channelId];
            if (!stoatChannelId) return;

            await broadcastToStoat({
                stoatChannelId,
                username: message.member?.displayName ?? message.author.username,
                avatarUrl: message.author.displayAvatarURL({ size: 256 }),
                content: message.content,
                // Extract attachments directly from the Discord payload
                attachments: message.attachments.map(a => ({ url: a.url, name: a.name })),
            });
        } catch (error) {
            logger.error("Error processing stream forwarding logic:", error);
        }
    },
} as Cmd;