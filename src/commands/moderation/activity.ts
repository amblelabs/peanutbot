import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type {
    Interaction,
    Message,
    SendableChannels,
    SharedSlashCommand,
    SlashCommandBuilder
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

// 1. Export Data Properties Explicitly
export const data: CmdData = {
    name: "activity",
};

// Helper: Generates uniform payload across traditional messages and slash commands
function makeLaunchPayload(guildId: string | null, userId: string) {
    // Use deployed platform URL config, fallback to localhost for debugging
    const serverUrl = process.env.ACTIVITY_URL || "http://localhost:3000";
    const activityLaunchUrl = `${serverUrl}?guildId=${guildId || ""}&userId=${userId}`;

    const launchButton = new ButtonBuilder()
        .setLabel("Launch Webhook Studio")
        .setStyle(ButtonStyle.Link)
        .setURL(activityLaunchUrl);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(launchButton);

    return {
        content: "Click the button below to open Webhook Studio and manage channel webhooks:",
        components: [row],
    };
}

// 2. Standard Prefix Command Execution Handler
export async function execute(
    _ctx: Ctx,
    message: Message,
    _channel: SendableChannels,
    _args: string[],
) {
    const payload = makeLaunchPayload(message.guildId, message.author.id);
    await message.reply(payload);
}

// 3. Slash Command Metadata Registration Builder
export function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder
        .setName(data.name)
        .setDescription("Launch the Webhook Studio Activity UI.");
}

// 4. Modern Slash Command Interaction Handler
export async function onInteraction(_ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.guildId) {
        await interaction.reply({
            content: "This command can only be used inside a server.",
            ephemeral: true,
        });
        return;
    }

    // Natively requests Discord to launch the embedded Activity UI panel over the channel
    // Note: This requires discord.js v14.15.0+ or raw API structures
    await interaction.deferReply({
        type: 12, // InteractionResponseType.LaunchActivity
    } as any);
}


// 5. Default Framework Wrapper Context Export
export default {
    data,
    slash,
    execute,
    onInteraction,
} as Cmd;
