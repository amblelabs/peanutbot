import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    VoiceConnection,
    VoiceConnectionStatus
} from "@discordjs/voice";
import type {
    Interaction,
    Message,
    SendableChannels,
    SharedSlashCommand,
    SlashCommandBuilder,
} from "discord.js";
import path from "node:path";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
    name: "honk",
};

const activeConnections = new Map<string, VoiceConnection>();
const activeTimeouts = new Map<string, NodeJS.Timeout>();

const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes

async function runVoiceLogic(guildId: string, voiceChannelId: string, voiceAdapterCreator: any) {
    if (activeTimeouts.has(guildId)) {
        clearTimeout(activeTimeouts.get(guildId));
        activeTimeouts.delete(guildId);
    }

    let connection = activeConnections.get(guildId);

    if (!connection) {
        connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guildId,
            adapterCreator: voiceAdapterCreator,
        });

        activeConnections.set(guildId, connection);

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            connection?.destroy();
            activeConnections.delete(guildId);
            if (activeTimeouts.has(guildId)) {
                clearTimeout(activeTimeouts.get(guildId));
                activeTimeouts.delete(guildId);
            }
        });
    }

   const player = createAudioPlayer();
    const resource = createAudioResource(path.resolve(__dirname, "../../../assets/honk.mp3"));

    player.play(resource);
    connection.subscribe(player);

    const timeout = setTimeout(() => {
        const liveConnection = activeConnections.get(guildId);
        if (liveConnection) {
            liveConnection.destroy();
            activeConnections.delete(guildId);
        }
        activeTimeouts.delete(guildId);
    }, TIMEOUT_DURATION);

    activeTimeouts.set(guildId, timeout);
}

async function execute(
    _ctx: Ctx,
    message: Message,
    channel: SendableChannels,
    _args: string[],
) {
    const member = message.member;
    const guildId = message.guildId;

    if (!member || !guildId) return;

    const voiceChannel = member.voice.channel;

    // Requirement: If they are not in a VC, send a self-cleaning warning message to prevent long-term clutter
    if (!voiceChannel) {
        if (channel.isSendable()) {
            await message.reply("Not VC")
        }
        return;
    }

    try {
        await runVoiceLogic(
            guildId,
            voiceChannel.id,
            voiceChannel.guild.voiceAdapterCreator
        );
    } catch (error) {
        console.error(error);
    }
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription("Joins voice, plays audio, and disconnects after 10 minutes of text activity silence.");
}

async function onInteraction(_ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;

    const member = interaction.member as any;
    const guildId = interaction.guildId;

    if (!member || !guildId) return;

    const voiceChannel = member.voice?.channel;

    // Requirement: Make channel mismatched warnings strictly ephemeral (hidden to other users)
    if (!voiceChannel) {
        await interaction.reply({
            content: "⚠ You need to be in a voice channel to use this command!",
            ephemeral: true
        });
        return;
    }

    // Acknowledge interaction invisibly so nothing gets printed publicly into the server channels
    await interaction.deferReply({ ephemeral: true });
    await interaction.deleteReply();

    try {
        await runVoiceLogic(
            guildId,
            voiceChannel.id,
            voiceChannel.guild.voiceAdapterCreator
        );
    } catch (error) {
        console.error(error);
    }
}

export default {
    data,
    slash,
    execute,
    onInteraction,
} as Cmd;
