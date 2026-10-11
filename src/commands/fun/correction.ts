import type { Message } from "discord.js";
import type { Cmd, Ctx } from "~/util/base";
import config from "config.json";

export default {
    data: { name: "wordcorrector" },

    onMessage: async (ctx: Ctx, message: Message) => {
        // Ignore bot messages to prevent infinite loops
        if (message.author.bot || !message.content) return;

        const corrections: Record<string, string> = config.fun.correction

        const foundCorrections: string[] = [];

        for (const [trigger, replacement] of Object.entries(corrections)) {
            const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const wordRegex = new RegExp(`\\b${escapedTrigger}\\b`);

            if (wordRegex.test(message.content)) {
                foundCorrections.push(`*${replacement}`);
            }
        }

        if (foundCorrections.length > 0) {
            await message.reply{ content: foundCorrections.join("\n") }).catch(() => {});
        }
    },
} as Cmd;
