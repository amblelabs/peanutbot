import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import Typo from "typo-js";
import path from "node:path";
import fs from "node:fs";
import config from "config.json"

const data: CmdData = {
    name: "autocorrect",
};

// 1. Load BOTH dictionaries
const dictionaryPath = path.resolve(__dirname, "../../../assets/dictionaries");
const usAffPath = path.join(dictionaryPath, "en_US.aff");
const usDicPath = path.join(dictionaryPath, "en_US.dic");

const gbAffPath = path.join(dictionaryPath, "en_GB.aff");
const gbDicPath = path.join(dictionaryPath, "en_GB.dic");


const usAffData = fs.readFileSync(usAffPath, "utf8");
const usDicData = fs.readFileSync(usDicPath, "utf8");

const gbAffData = fs.readFileSync(gbAffPath, "utf8");
const gbDicData = fs.readFileSync(gbDicPath, "utf8");

const dictUS = new Typo("en_US", usAffData, usDicData);
const dictGB = new Typo("en_GB", gbAffData, gbDicData);

const TARGET_ROLE_ID = config.fun.realCorrection;

async function onMessage(_ctx: Ctx, message: Message) {
    if (message.author.bot || message.content.trim().startsWith("?")) return;
    if (!message.member?.roles.cache.has(TARGET_ROLE_ID)) {
        return;
    }
    const words = message.content
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"島]/g, "")
        .split(/\s+/);

    const corrections: string[] = [];

    for (const word of words) {
        if (!word || !isNaN(Number(word)) || word.startsWith("<") || word.startsWith("http")) {
            continue;
        }
        // 2. Check US first
        let isCorrect = dictUS.check(word);
        // 3. check GB.
        if (!isCorrect) {
            isCorrect = dictGB.check(word);
        }

        if (!isCorrect) {
            // Get suggestions from US by default (or combine them)
            const suggestions = dictUS.suggest(word);

            if (suggestions.length > 0) {
                corrections.push(`${suggestions[0]}`);
            }
        }
    }

    if (corrections.length > 0) {
        try {
            await message.reply({
                content: `*${corrections.join(", ")}`,
                allowedMentions: { repliedUser: false }
            });
        } catch (error) {
            console.error(error);
        }
    }
}

export default { data, onMessage } as Cmd;
