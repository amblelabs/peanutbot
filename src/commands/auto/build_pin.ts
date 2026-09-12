import {
    ChatInputCommandInteraction,
    Message,
    type SendableChannels,
    SlashCommandBuilder,
} from "discord.js";
import type { Cmd, Ctx } from "~/util/base";

// 1. Flexible Webhook Header Regex (Handles bolding, link wrappers, custom tags, and emojis)
// Matches: **Stargate: Sojourner** (**SGS**) dev build [#166]
// Matches: **AIT** dev build `#2751`
const HEADER_REGEX = /\*\*(.+?)\*\*(?:\s*[\(\[`]?\*\*?([^\*\n\)\n\]]+)\*\*?[\)\]`]?)*?\s*dev\s+build\s*.*?#(\d+)/i;

// 2. Flexible JAR Regex
// Matches: stargate-fabric-0.0.0-sojourner-dev.165+mc.1.21.1.jar
const JAR_REGEX = /([a-zA-Z0-9_\-]+?)(?:-(\d+\.\d+(?:\.\d+)?))?-([a-zA-Z0-9_\-]+?)-dev\.(\d+)(?:\+mc\.([a-zA-Z0-9_\.]+))?\.jar/i;

interface BuildInfo {
    modName: string;
    branch: string;
    buildNum: number;
    mcVersion?: string;
    buildKey: string;
}

function parseBuildInfo(message: Message): BuildInfo | null {
    const textSources: { source: string; text: string }[] = [
        { source: "content", text: message.content || "" },
        ...message.attachments.map((att) => ({ source: "attachment", text: att.name || "" })),
        ...message.embeds.flatMap((embed) => [
            { source: "embed title", text: embed.title || "" },
            { source: "embed desc", text: embed.description || "" },
            ...embed.fields.flatMap((f) => [
                { source: "embed field name", text: f.name },
                { source: "embed field val", text: f.value },
            ]),
        ]),
    ];

    for (const { text } of textSources) {
        if (!text) continue;

        // Try JAR filename match first
        const jarMatch = text.match(JAR_REGEX);
        if (jarMatch) {
            const [, rawMod, _ver, branch, buildStr, mcVer] = jarMatch;
            const buildNum = parseInt(buildStr, 10);
            const modName = rawMod.toLowerCase();
            const branchName = branch.toLowerCase();
            const mc = mcVer ? mcVer.toLowerCase() : "";
            const buildKey = mc ? `${modName}:${branchName}:${mc}` : `${modName}:${branchName}`;

            return { modName, branch: branchName, buildNum, mcVersion: mc, buildKey };
        }

        // Try Webhook text header match second
        const headerMatch = text.match(HEADER_REGEX);
        if (headerMatch) {
            const [, rawMod, tag, buildStr] = headerMatch;
            const buildNum = parseInt(buildStr, 10);

            let modName = rawMod.toLowerCase().trim();
            let branchName = tag ? tag.toLowerCase().trim() : "main";

            // Handle "Mod: Branch" format in title (e.g. "Stargate: Sojourner")
            if (modName.includes(":")) {
                const parts = modName.split(":");
                modName = parts[0].trim();
                branchName = parts[1].trim();
            }

            const buildKey = `${modName}:${branchName}`;
            return { modName, branch: branchName, buildNum, buildKey };
        }
    }

    return null;
}

async function evaluateAndPinMessage(message: Message): Promise<boolean> {
    const newBuild = parseBuildInfo(message);

    if (!newBuild) {
        return false;
    }

    console.log(
        `[AutoPin Match] Found build: Key="${newBuild.buildKey}", Run=#${newBuild.buildNum} (Msg ID: ${message.id})`
    );

    if (!("fetchPinned" in message.channel)) return false;

    try {
        const pinnedMessages = await message.channel.messages.fetchPinned();
        let shouldPinNew = true;

        for (const pinnedMsg of pinnedMessages.values()) {
            const pinnedBuild = parseBuildInfo(pinnedMsg);
            if (!pinnedBuild) continue;

            if (newBuild.buildKey === pinnedBuild.buildKey) {
                if (newBuild.buildNum > pinnedBuild.buildNum) {
                    console.log(`[AutoPin Unpin] Unpinning older build #${pinnedBuild.buildNum}`);
                    await pinnedMsg.unpin().catch((err) =>
                        console.error(`Failed to unpin message ${pinnedMsg.id}:`, err)
                    );
                } else {
                    shouldPinNew = false;
                }
            }
        }

        if (shouldPinNew && !message.pinned) {
            await message.pin();
            console.log(`📌 [AutoPin Success] Pinned message ${message.id} for ${newBuild.buildKey} #${newBuild.buildNum}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ [AutoPin Error] Could not pin message ${message.id}:`, error);
    }

    return false;
}

async function scanChannelBuilds(
    channel: SendableChannels | any,
    limit: number = 50
): Promise<{ scanned: number; updated: number }> {
    if (!channel || !("messages" in channel)) return { scanned: 0, updated: 0 };

    console.log(`🔍 [AutoPin Scan] Fetching last ${limit} messages in channel ${channel.id}...`);
    const fetched = await channel.messages.fetch({ limit });
    const sortedMessages = [...fetched.values()].sort(
        (a: Message, b: Message) => a.createdTimestamp - b.createdTimestamp
    );

    let updatedCount = 0;
    for (const msg of sortedMessages) {
        const updated = await evaluateAndPinMessage(msg);
        if (updated) updatedCount++;
    }

    return { scanned: sortedMessages.length, updated: updatedCount };
}

export default {
    data: { name: "autopin" },

    slash: (builder: SlashCommandBuilder) => {
        return builder
            .setName("autopin")
            .setDescription("Manually trigger channel scan for latest mod builds")
            .addIntegerOption((opt) =>
                opt
                    .setName("limit")
                    .setDescription("Number of recent messages to scan (default: 50, max: 100)")
                    .setMinValue(1)
                    .setMaxValue(100)
                    .setRequired(false)
            );
    },

    onInteraction: async (ctx: Ctx, interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== "autopin") return;

        await interaction.deferReply({ ephemeral: true });

        const limit = interaction.options.getInteger("limit") || 50;
        const { scanned, updated } = await scanChannelBuilds(interaction.channel!, limit);

        await interaction.editReply(
            `🔍 Scanned **${scanned}** messages. Pinned/Updated **${updated}** build(s).`
        );
    },

    execute: async (ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) => {
        const limit = args[0] ? Math.min(Math.max(parseInt(args[0], 10) || 50, 1), 100) : 50;

        const statusMsg = await message.reply(`Scanning **${limit}** messages for builds...`);
        const { scanned, updated } = await scanChannelBuilds(channel, limit);

        await statusMsg.edit(
            `✅ Scanned **${scanned}** messages. Pinned/Updated **${updated}** build(s).`
        );
    },

    onMessage: async (ctx: Ctx, message: Message) => {
        try {
            await evaluateAndPinMessage(message);
        } catch (error) {
            console.error(`❌ AutoPin Error:`, error);
        }
    },
} as Cmd;