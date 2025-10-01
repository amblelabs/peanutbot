import {
  Collection,
  Message,
  PermissionFlagsBits,
  type TextChannel,
  type SendableChannels,
  GuildMember,
  MessageFlags,
} from "discord.js";
import type { Cmd } from "~/util/base";

export default {
  data: { name: "clearafter" },

  slash: (builder) =>
    builder
      .setName("clearafter")
      .setDescription(
        "Deletes all messages in the channel after the specified message ID."
      )
      .addStringOption((option) =>
        option
          .setName("messageid")
          .setDescription(
            "The message ID after which all messages will be deleted."
          )
          .setRequired(true)
      ),

  onInteraction: async (ctx, interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { guild, channel, member, client, options } = interaction;

    if (!guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Ensure it's a text channel
    if (!channel?.isSendable()) {
      return interaction.reply({
        content: "❌ This command can only be used in a text channel.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const textChannel = channel as TextChannel;

    if (!member || !(member instanceof GuildMember)) {
      return interaction.reply({
        content: "❌ Could not retrieve member information.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ You need the "Manage Messages" permission to use this.',
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Check if bot has permission to manage messages
    if (
      !textChannel
        .permissionsFor(client.user)
        ?.has(PermissionFlagsBits.ManageMessages)
    ) {
      return interaction.reply({
        content:
          "❌ I don't have permission to manage messages in this channel.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Defer reply to avoid interaction timeout
    await interaction.deferReply({ ephemeral: true });

    const messageId = options.getString("messageid", true);

    let targetMessage: Message;
    try {
      targetMessage = await textChannel.messages.fetch(messageId);
    } catch (error) {
      return interaction.editReply({
        content:
          "❌ Could not find a message with that ID. Make sure the ID is correct and from this channel.",
      });
    }

    try {
      // Fetch messages sent *after* the target message (newer messages)
      const messages: Collection<string, Message> =
        await textChannel.messages.fetch({
          after: messageId,
        });

      // Filter messages that are actually newer than the target
      const toDelete = messages.filter(
        (msg) => msg.createdTimestamp > targetMessage.createdTimestamp
      );

      if (toDelete.size === 0) {
        return interaction.editReply({
          content:
            "✅ There are no messages after the specified message to delete.",
        });
      }

      // Bulk delete only supports up to 100 messages per call, and only messages <14 days old
      const deletePromises: Promise<any>[] = [];
      const deleteInBulk: string[] = [];

      toDelete.forEach((msg) => {
        if (deleteInBulk.length < 100) {
          deleteInBulk.push(msg.id);
        } else {
          // Send current batch
          deletePromises.push(textChannel.bulkDelete(deleteInBulk, true)); // `true` ignores pinned messages
          deleteInBulk.length = 0; // Clear array
          deleteInBulk.push(msg.id);
        }
      });

      // Push remaining messages
      if (deleteInBulk.length > 0) {
        deletePromises.push(textChannel.bulkDelete(deleteInBulk, true));
      }

      // Wait for all bulk deletes to complete
      await Promise.all(deletePromises);

      return interaction.editReply({
        content: `✅ Successfully deleted ${toDelete.size} message(s) after the specified message.`,
      });
    } catch (error) {
      console.error("Error deleting messages:", error);

      // Handle specific Discord error: messages older than 14 days
      if (error instanceof Error && (error as any).code === 50034) {
        return interaction.editReply({
          content:
            "❌ Cannot delete messages older than 14 days. Please manually delete older messages.",
        });
      }

      return interaction.editReply({
        content: `❌ An error occurred while deleting messages: ${
          (error as Error).message
        }`,
      });
    }
  },
} as Cmd;
