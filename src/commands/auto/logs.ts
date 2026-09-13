import zlib from "node:zlib";
import { Message, NewsChannel, TextChannel, VoiceChannel } from "discord.js";
import type { Cmd, Ctx } from "~/util/base";

async function uploadToMclogs(logContent: string): Promise<string | null> {
    try {
        const response = await fetch("https://api.mclo.gs/1/log", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ content: logContent }),
        });

        const data = (await response.json()) as { success: boolean; url?: string };
        return data.success && data.url ? data.url : null;
    } catch (err) {
        console.error("❌ Failed to upload log to mclo.gs:", err);
        return null;
    }
}

export default {
    data: { name: "loguploader" },

    onMessage: async (ctx: Ctx, message: Message) => {
        if (message.author.bot || !message.attachments.size) return;

        const logAttachment = message.attachments.find((att) => {
            const name = (att.name || "").toLowerCase();
            return name.endsWith(".log") || name.endsWith(".log.gz") || name.endsWith(".txt");
        });

        if (!logAttachment) return;

        try {
            const res = await fetch(logAttachment.url);
            if (!res.ok) return;

            const buffer = Buffer.from(await res.arrayBuffer());
            let logText: string;

            if (logAttachment.name?.toLowerCase().endsWith(".gz")) {
                logText = zlib.gunzipSync(buffer).toString("utf-8");
            } else {
                logText = buffer.toString("utf-8");
            }

            if (!logText.trim()) return;

            const mclogsUrl = await uploadToMclogs(logText);
            if (!mclogsUrl) return;

            const channel = message.channel;
            const targetChannel = channel.isThread() ? channel.parent : channel;

            if (!targetChannel || !("createWebhook" in targetChannel)) return;

            const webhooks = await targetChannel.fetchWebhooks();
            let webhook = webhooks.find((wh) => wh.owner?.id === message.client.user?.id);

            if (!webhook) {
                webhook = await (targetChannel as TextChannel | NewsChannel | VoiceChannel).createWebhook({
                    name: "Log Auto-Uploader",
                });
            }

            const userText = message.content.trim();
            const content = userText
                ? `${userText}\n**Log uploaded:** ${mclogsUrl}`
                : `📄 **Log uploaded:** ${mclogsUrl}`;

            await webhook.send({
                content,
                username: message.member?.displayName || message.author.username,
                avatarURL: message.author.displayAvatarURL(),
                threadId: channel.isThread() ? channel.id : undefined,
            });

            await message.delete().catch(() => {});
        } catch (err) {
            console.error(`❌ Error processing log attachment in message ${message.id}:`, err);
        }
    },
} as Cmd;