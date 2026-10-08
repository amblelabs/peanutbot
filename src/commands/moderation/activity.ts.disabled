import {
    ApplicationIntegrationType,
    InteractionContextType,
} from "discord.js";
import type {
    Interaction,
    Message,
    SendableChannels,
    SharedSlashCommand,
    SlashCommandBuilder,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

export const data: CmdData = {
    name: "activity",
};

// 1. Slash command metadata
export function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder
        .setName(data.name)
        .setDescription("Launch the Webhook Studio Activity UI.")
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.Guild);
}

// 2. Slash command handler — LAUNCH_ACTIVITY via raw REST
export async function onInteraction(_ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.guildId) {
        await interaction.reply({
            content: "This command can only be used inside a server.",
            ephemeral: true,
        });
        return;
    }

    // deferReply() does NOT support type 12 — must hit the REST callback directly
    try {
        await interaction.client.rest.post(
            `/interactions/${interaction.id}/${interaction.token}/callback`,
            { body: { type: 12 } }, // InteractionResponseType.LaunchActivity
        );
    } catch (err) {
        console.error("Failed to launch Activity:", err);
        // Only fall back if we haven't already acked the interaction
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content:
                    "Failed to launch the Activity. Is the Activity URL configured in the Developer Portal?",
                ephemeral: true,
            });
        }
    }
}

// 3. Prefix command — cannot launch Activities, redirect to slash
export async function execute(
    _ctx: Ctx,
    message: Message,
    _channel: SendableChannels,
    _args: string[],
) {
    await message.reply(
        "Activities can only be launched via slash command. Use `/activity`.",
    );
}

export default {
    data,
    slash,
    execute,
    onInteraction,
} as Cmd;