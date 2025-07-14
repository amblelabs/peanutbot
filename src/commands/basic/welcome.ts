import config from "config.json";
import { Message, Events, GuildMember } from "discord.js";
import type { CmdData, Ctx } from "~/util/base";

const data: CmdData = {
    name: 'welcome',
};

async function welcome(member: GuildMember) {
    const welcomeChannel = member.guild.channels.cache.get(config.texts.welcome_channel);
    
    if (!welcomeChannel?.isSendable())
        return;

    await welcomeChannel.send(config.texts.welcome_message
        .replaceAll('$USER', member.id));
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (message.reference) {
        const og = await message.fetchReference();

        if (og.member)
            welcome(og.member);
    }
}

async function setup(ctx: Ctx) {
    setTimeout(async () => {
        ctx.client.on(Events.GuildMemberAdd, welcome);
    }, 10*1000);
}

export default {
    data,
    setup,
    execute,
}