import type { Message } from "discord.js";
import config from "../config.json";

async function provideSupport(message: Message) {
    const content = message.content.toLowerCase();
    let qi = 1;

    for (const [k, v] of Object.entries(config.support.types)) {
        const keywordBuilder = [];
        let valid = true;

        for (const keyword of v.keywords) {
            if (!content.includes(keyword)) {
                valid = false;
                break;
            }

            keywordBuilder.push(config.support.format.keywords.replaceAll('$KEYWORD', keyword));
        }

        if (!valid)
            continue;
        
        const msgBuilder = [config.support.format.header];
        msgBuilder.push(`\`Q${qi}:\` ${v.question}`);

        for (let ai = 0; ai < v.answers.length; ai++) {
            msgBuilder.push(`\`A${ai + 1}:\` ${v.answers[ai]}`);
        }

        const footer = config.support.format.footer.replaceAll('$TYPE', k)
            .replaceAll('$KEYWORDS', keywordBuilder.toString());;
        
        msgBuilder.push(footer);

        await message.reply(msgBuilder.join('\n'));
        qi++;
    }
}

export default {
    provideSupport
}