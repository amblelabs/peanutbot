import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder
} from "discord.js";

/**
 * Paginates an array of EmbedBuilders with interactive Previous/Next buttons.
 *
 * @param interaction The initial command interaction
 * @param pages An array of EmbedBuilders representing the pages
 * @param timeout How long the buttons should remain active in milliseconds (default: 60s)
 */
export async function paginate(
    interaction: ChatInputCommandInteraction,
    pages: EmbedBuilder[],
    timeout: number = 60000
) {
    if (!pages || pages.length === 0) throw new Error("Pages array cannot be empty.");

    // If there's only one page, just send it without buttons
    if (pages.length === 1) {
        return await interaction.editReply({ embeds: [pages[0]], components: [] });
    }

    let index = 0;

    const prevButton = new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true); // Disabled on the first page

    const nextButton = new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Primary);

    const getRow = () => new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

    const message = await interaction.editReply({
        embeds: [pages[index]],
        components: [getRow()]
    });

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: timeout,
        // Ensure only the person who ran the command can click the buttons
        filter: (i) => i.user.id === interaction.user.id
    });

    collector.on("collect", async (i) => {
        try {
            if (i.customId === "prev") index = Math.max(0, index - 1);
            else if (i.customId === "next") index = Math.min(pages.length - 1, index + 1);
            else return;

            // Dynamically disable buttons based on the new index
            prevButton.setDisabled(index === 0);
            nextButton.setDisabled(index === pages.length - 1);

            await i.update({
                embeds: [pages[index]],
                components: [getRow()]
            });
        } catch (error) {
            console.warn("Could not update pagination message:", error);
        }
    });

    collector.on("end", async () => {
        // When time expires, disable all buttons and edit the message
        prevButton.setDisabled(true);
        nextButton.setDisabled(true);

        await interaction.editReply({ components: [getRow()] }).catch(() => {
            console.warn("Could not disable pagination buttons (message deleted).");
        });
    });
}