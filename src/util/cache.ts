import { AttachmentBuilder, type BaseMessageOptions, type Message } from "discord.js";

type CachedUrl = [ time: number, url: string ];

const lifetime = 24 * 60 * 60 * 1000; // 24 hours
const cache: Dict<CachedUrl> = {};

function cacheFiles(url: string, message: Message) {
    message.attachments.forEach((v) => {
        cache[url] = [Date.now(), v.url];
    });
}

async function uncache(url: string, send: (options: BaseMessageOptions) => Promise<Message>) {
    const now = Date.now();
    const cached = cache[url];

    if (!cached || now > cached[0] + lifetime) {
        const msg = await send({ files: [new AttachmentBuilder(url)] });
        cacheFiles(url, msg);
        
        return;
    }

    return { content: cached[1] };
}

export default {
    uncache,
}