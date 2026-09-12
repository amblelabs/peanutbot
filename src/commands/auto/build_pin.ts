import {
    ChatInputCommandInteraction,
    Message,
    type SendableChannels,
    SlashCommandBuilder,
} from "discord.js";
import type { Cmd, Ctx } from "~/util/base";

interface BuildInfo {
    modName: string;
    branch: string;
    buildNum: number;
    mcVersion?: string;
    buildKey: string;
}

function parseBuildInfo(message: Message): BuildInfo | null {
    const textSources: { source: string; text: string }[] = [
        ...message.attachments.map((att) => ({ source: `attachment: ${att.name}`, text: att.name || "" })),
        { source: "content", text: message.content || "" },
        ...message.embeds.flatMap((embed, idx) => [
            { source: `embed[${idx}].title`, text: embed.title || "" },
            { source: `embed[${idx}].description`, text: embed.description || "" },
            { source: `embed[${idx}].url`, text: embed.url || "" },
            ...embed.fields.flatMap((f) => [
                { source: `embed[${idx}].field.name`, text: f.name },
                { source: `embed[${idx}].field.value`, text: f.value },
            ]),
        ]),
    ];

    for (const { text } of textSources) {
        if (!text) continue;

        const lowerText = text.toLowerCase();
        if (!lowerText.includes(".jar") || !lowerText.includes("-dev.")) continue;

        const jarMatches = text.match(/[a-zA-Z0-9_\-\.\+\?=\&]+\.jar(?:\?[^\s]+)?/gi);
        if (!jarMatches) continue;

        for (const raw of jarMatches) {
            const filename = raw.split("?")[0];

            const devMatch = filename.match(/^(.+?)-dev\.(\d+)(?:(?:\+|-)??mc\.([a-zA-Z0-9_\.]+))?\.jar$/i);
            if (!devMatch) continue;

            const base = devMatch[1];
            const buildNum = parseInt(devMatch[2], 10);
            const mcVersion = devMatch[3] ? devMatch[3].toLowerCase().trim() : undefined;

            let modName = "";
            let branch = "main";

            const verMatch = base.match(/-(\d+\.\d+(?:\.\d+)?)(?:-|$)/);
            if (verMatch && verMatch.index !== undefined) {
                modName = base.slice(0, verMatch.index).toLowerCase().trim();
                const rawBranch = base.slice(verMatch.index + verMatch[0].length).toLowerCase().trim();
                if (rawBranch) branch = rawBranch;
            } else {
                const parts = base.split("-");
                if (parts.length > 1) {
                    modName = parts[0].toLowerCase().trim();
                    branch = parts.slice(1).join("-").toLowerCase().trim();
                } else {
                    modName = base.toLowerCase().trim();
                }
            }

            const buildKey = mcVersion
                ? `${modName}:${branch}:${mcVersion}`
                : `${modName}:${branch}`;

            return {
                modName,
                branch,
                buildNum,
                mcVersion,
                buildKey,
            };
        }
    }

    return null;
}

async function evaluateAndPinMessage(message: Message): Promise<boolean> {
    const newBuild = parseBuildInfo(message);
    if (!newBuild) return false;

    if (!("messages" in message.channel) || typeof message.channel.messages.fetchPinned !== "function") {
        console.error(`[AutoPin Error] Channel ${message.channelId} does not support fetching pinned messages.`);
        return false;
    }

    try {
        const pinnedMessages = await message.channel.messages.fetchPinned();
        let shouldPinNew = true;

        for (const pinnedMsg of pinnedMessages.values()) {
            if (pinnedMsg.id === message.id) continue;

            const pinnedBuild = parseBuildInfo(pinnedMsg);
            if (!pinnedBuild) continue;

            if (newBuild.buildKey === pinnedBuild.buildKey) {
                if (newBuild.buildNum > pinnedBuild.buildNum) {
                    await pinnedMsg.unpin().catch((err) =>
                        console.error(`❌ [AutoPin Error] Failed to unpin message ${pinnedMsg.id}:`, err)
                    );
                } else {
                    shouldPinNew = false;
                }
            }
        }

        if (shouldPinNew && !message.pinned) {
            await message.pin();
            return true;
        }
    } catch (error) {
        console.error(`❌ [AutoPin Error] Could not complete pin evaluation for message ${message.id}:`, error);
    }

    return false;
}

async function scanChannelBuilds(
    channel: SendableChannels | any,
    limit: number = 50
): Promise<{ scanned: number; updated: number }> {
    if (!channel || !("messages" in channel) || typeof channel.messages.fetchPinned !== "function") {
        console.error(`[AutoPin Scan Error] Invalid or unsupported channel object:`, channel);
        return { scanned: 0, updated: 0 };
    }

    let fetchedMessages;
    let pinnedMessages;

    try {
        // Fetch both scan window and existing pins in parallel
        [fetchedMessages, pinnedMessages] = await Promise.all([
            channel.messages.fetch({ limit }),
            channel.messages.fetchPinned(),
        ]);
    } catch (err) {
        console.error(`❌ [AutoPin Scan Error] Failed to fetch channel messages:`, err);
        return { scanned: 0, updated: 0 };
    }

    // Step 1: "Think First" — Group fetched messages and find the highest build for each key
    const latestScannedMap = new Map<string, { info: BuildInfo; msg: Message }>();
    for (const msg of fetchedMessages.values()) {
        const info = parseBuildInfo(msg);
        if (!info) continue;

        const existing = latestScannedMap.get(info.buildKey);
        if (!existing || info.buildNum > existing.info.buildNum) {
            latestScannedMap.set(info.buildKey, { info, msg });
        }
    }

    // Step 2: Group existing channel pins by buildKey
    const currentPinsMap = new Map<string, { info: BuildInfo; msg: Message }>();
    for (const msg of pinnedMessages.values()) {
        const info = parseBuildInfo(msg);
        if (!info) continue;
        currentPinsMap.set(info.buildKey, { info, msg });
    }

    let updatedCount = 0;

    // Step 3: "Pin Later" — Perform single pin/unpin action only for final winners
    for (const [buildKey, scanned] of latestScannedMap.entries()) {
        const pinned = currentPinsMap.get(buildKey);

        if (!pinned) {
            // New build track found that isn't pinned yet
            if (!scanned.msg.pinned) {
                await scanned.msg.pin().catch((err) =>
                    console.error(`❌ [AutoPin Error] Failed to pin message ${scanned.msg.id}:`, err)
                );
                updatedCount++;
            }
        } else if (scanned.info.buildNum > pinned.info.buildNum) {
            // Scanned build strictly replaces the pinned build
            await pinned.msg.unpin().catch((err) =>
                console.error(`❌ [AutoPin Error] Failed to unpin message ${pinned.msg.id}:`, err)
            );
            if (!scanned.msg.pinned) {
                await scanned.msg.pin().catch((err) =>
                    console.error(`❌ [AutoPin Error] Failed to pin message ${scanned.msg.id}:`, err)
                );
            }
            updatedCount++;
        }
    }

    return { scanned: fetchedMessages.size, updated: updatedCount };
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
            console.error(`❌ AutoPin Listener Error:`, error);
        }
    },
} as Cmd;