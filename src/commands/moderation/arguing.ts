import config from "config.json";
import type { GuildMember, Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
    name: 'internal/arguing',
}

async function onMessage(ctx: Ctx, message: Message) {
    if (message.channelId !== config.arguing.channel_id)
        return;

    const content = message.content.toLowerCase();
    if (!message.mentions.has(ctx.client.user!) || !content.includes("arguing") 
        || !content.includes("dev") || !content.includes("chat"))
        return;

    const oneHourAgo = Date.now() - config.arguing.message_period;
    const messages = await message.channel.messages.fetch({ limit: config.arguing.message_count });
    
    for (const [, msg] of messages) {
        if (msg.createdTimestamp < oneHourAgo) {
            message.reply('No arguing detected.');
            return;
        }
    }
    
    const guild = message.guild;
    const members: Set<string> = new Set();

    messages.map(m => m.member).filter(m => m !== null)
        .filter(m => m.id !== config.clientId)
        .forEach(m => members.add(m.id));
    

    for (const memberId of members) {
        try {
            const member = await guild?.members.fetch(memberId);
            if (!member) return;
            
            await member.timeout(config.arguing.timeout_period, 'peanut: arguing');
        } catch (e) { }
    }
}

export default {
    data,
    onMessage,
} as Cmd