import {type Cmd, type Ctx, format} from "~/util/base.ts";
import config from "config.json"
import {MessageReaction, EmbedBuilder, type User} from "discord.js";

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
            // Check if this message is a reply to someone else
            if (message.reference && message.reference.messageId) {
                try {
                    // Fetch the original message being replied to
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

                    if (repliedMessage) {
                        const replyEmbed = new EmbedBuilder()
                            .setColor('#5a4c45') // Dark subtle color to represent a reply context
                            .setAuthor({
                                name: `Replying to ${repliedMessage.author?.tag || "Unknown User"}`,
                                iconURL: repliedMessage.author?.displayAvatarURL({ forceStatic: false })
                            })
                            .setDescription(repliedMessage.content|| null)
                            .setTimestamp(repliedMessage.createdAt)

                        const replyImage =
                            repliedMessage.attachments.first()?.url ||
                            repliedMessage.embeds.find(e => e.image?.url)?.image?.url ||
                            repliedMessage.embeds.find(e => e.thumbnail?.url)?.thumbnail?.url;

                        if (replyImage) replyEmbed.setImage(replyImage);
                        embedsArray.push(replyEmbed);
                    }
                } catch (err) {
                    console.log("Could not fetch the reply");
                }
            }

            // --- MAIN EMBED ---
            const mainEmbed = new EmbedBuilder()
                .setColor('#fd8a00')
                .setAuthor({
                    name: message.author?.tag || "Unknown User",
                    iconURL: message.author?.displayAvatarURL({ forceStatic: false })
                })
                .setDescription(message.content||null)
                .setTimestamp(message.createdAt)

            const image =
                message.attachments.first()?.url ||
                message.embeds.find(e => e.image?.url)?.image?.url ||
                message.embeds.find(e => e.thumbnail?.url)?.thumbnail?.url;

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