import {type Cmd, type Ctx, format} from "~/util/base.ts";
import config from "config.json"
import {MessageReaction, EmbedBuilder, type User, AttachmentBuilder} from "discord.js";

export default {
    data: { name: "peanutboard" },

    onMessageReactionAdd: async (ctx: Ctx, reaction: MessageReaction, user:User) =>{
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }

        if (reaction.emoji.id !== config.fun.peanutboard.emoji) return;

        const { message } = reaction;

        if (message.author && message.author.id === user.id) {
            return;
        }
        if (message.channelId === config.fun.peanutboard.channel) {
            return;
        }

        if (reaction.count >= config.fun.peanutboard.limit) {
            const peanutboardChannel = ctx.client.channels.cache.get(config.fun.peanutboard.channel);
            if (!peanutboardChannel || !peanutboardChannel.isSendable()) return console.error('peanutboard channel not found.');

            const fetchMessages = await peanutboardChannel.messages.fetch({ limit: 100 });
            const existingMessage = fetchMessages.find(msg =>
                msg.embeds.length > 0 &&
                msg.content.includes(message.url)
            );

            const embedsArray: EmbedBuilder[] = [];

            // --- REPLY HANDLING BLOCK ---
            if (message.reference && message.reference.messageId) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    if (repliedMessage) {
                        let replyText = repliedMessage.content || "";

                        // Append sticker name if present
                        if (repliedMessage.stickers.size > 0) {
                            replyText += `\n*Sticker: ${repliedMessage.stickers.first()?.name}*`;
                        }

                        // Append non-image attachments as download links
                        const nonImageAttachments = repliedMessage.attachments.filter(att => !att.contentType?.startsWith("image/"));
                        if (nonImageAttachments.size > 0) {
                            replyText += "\n" + nonImageAttachments.map(att => `📎 [${att.name}](${att.url})`).join("\n");
                        }

                        const replyEmbed = new EmbedBuilder()
                            .setColor('#5a4c45')
                            .setAuthor({
                                name: `Replying to ${repliedMessage.author?.tag || "Unknown User"}`,
                                iconURL: repliedMessage.author?.displayAvatarURL({ forceStatic: false })
                            })
                            .setDescription(replyText.trim() || null)
                            .setTimestamp(repliedMessage.createdAt);

                        const replyImage =
                            repliedMessage.attachments.first()?.url ||
                            repliedMessage.embeds.find(e => e.image?.url)?.image?.url ||
                            repliedMessage.embeds.find(e => e.thumbnail?.url)?.thumbnail?.url ||
                            repliedMessage.stickers.first()?.url;

                        if (replyImage) replyEmbed.setImage(replyImage);
                        embedsArray.push(replyEmbed);
                    }
                } catch (err) {
                    console.log("Could not fetch the reply");
                }
            }

            // --- MAIN EMBED ---
            let mainText = message.content || "";

            // Append sticker name if present
            if (message.stickers.size > 0) {
                mainText += `\n*Sticker: ${message.stickers.first()?.name}*`;
            }

            // Append non-image attachments as download links
            const mainNonImageAttachments = message.attachments.filter(att => !att.contentType?.startsWith("image/"));
            if (mainNonImageAttachments.size > 0) {
                mainText += "\n" + mainNonImageAttachments.map(att => `📎 [${att.name}](${att.url})`).join("\n");
            }

            const mainEmbed = new EmbedBuilder()
                .setColor('#fd8a00')
                .setAuthor({
                    name: message.author?.tag || "Unknown User",
                    iconURL: message.author?.displayAvatarURL({ forceStatic: false })
                })
                .setDescription(mainText.trim() || null)
                .setTimestamp(message.createdAt);

            const image =
                message.attachments.first()?.url ||
                message.embeds.find(e => e.image?.url)?.image?.url ||
                message.embeds.find(e => e.thumbnail?.url)?.thumbnail?.url ||
                message.stickers.first()?.url;

            if (image) mainEmbed.setImage(image);
            embedsArray.push(mainEmbed);

            // 6. Update existing message or send a new one
            if (existingMessage) {
                await existingMessage.edit({ content: format(config.fun.peanutboard.message, { count: reaction.count, url: message.url }), embeds: embedsArray });
            } else {
                await peanutboardChannel.send({ content: format(config.fun.peanutboard.message, { count: reaction.count, url: message.url }), embeds: embedsArray });
            }
        }
    },
    onMessageReactionRemove: async (ctx: Ctx, reaction: MessageReaction, user: User) => {
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        if (reaction.emoji.id !== config.fun.peanutboard.emoji) return;
        const { message } = reaction;
        if (message.author && message.author.id === user.id) {
            return;
        }
        if (message.channelId === config.fun.peanutboard.channel) {
            return;
        }

        // 2. Locate board and search for an existing entry
        const peanutboardChannel = ctx.client.channels.cache.get(config.fun.peanutboard.channel);
        if (!peanutboardChannel || !peanutboardChannel.isTextBased()) return;

        const fetchMessages = await peanutboardChannel.messages.fetch({ limit: 100 });
        const existingMessage = fetchMessages.find(msg =>
            msg.embeds.length > 0 &&
            msg.content.includes(message.url)
        );

        // If it's not even on the board, nothing to subtract or adjust
        if (!existingMessage) return;

        // 3. CASE A: Count dropped below minimum threshold -> Remove entry entirely
        if (reaction.count < config.fun.peanutboard.limit) {
            try {
                await existingMessage.delete();
            } catch (error) {
                console.error("Failed to delete low-count board post:", error);
            }
        }
        // 4. CASE B: Count dropped but stays qualified -> Update counter label live
        else {
            try {
                await existingMessage.edit({
                    content: format(config.fun.peanutboard.message, { count: reaction.count, url: message.url }),
                    embeds: existingMessage.embeds
                });
            } catch (error) {
                console.error("Failed to update subtracted count profile:", error);
            }
        }
    }
} as Cmd;