import type { Cmd, Ctx } from "../../../utilsbase";

const countTagsCommand: Cmd = {
  data: {
    name: "counttags",
  },
  
  slash: (builder) =>
    builder
      .setName("counttags")
      .setDescription("Counts how many members have the server tag equipped."),

  onInteraction: async (ctx: Ctx, interaction) => {
    // 1. Ensure this is a slash command before proceeding
    if (!interaction.isChatInputCommand()) return;

    // 2. Prevent crashes if someone runs this in DMs
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    // 3. Defer reply because fetching members can take time
    await interaction.deferReply();

    try {
      // Fetch all members to ensure cache is 100% accurate
      const members = await interaction.guild.members.fetch();

      // Filter for members who have the tag equipped and enabled
      const taggedMembers = members.filter((member) => {
        // Natively typed in the latest discord.js versions
        const identity = member.user.primaryGuild;

        return (
          identity !== null &&
          identity !== undefined &&
          identity.identityGuildId === interaction.guild?.id &&
          identity.identityEnabled === true
        );
      });

      const count = taggedMembers.size;
      
      await interaction.editReply(
        `**${count}** members currently have our guild tag actively equipped!`
      );
      
    } catch (error) {
      console.error("Error fetching members:", error);
      await interaction.editReply(
        "There was an error trying to fetch the member list."
      );
    }
  },
};

export default countTagsCommand;
