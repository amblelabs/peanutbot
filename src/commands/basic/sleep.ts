import config from "config.json";
import type { Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"
import wrath from "~/util/angry";

const data: CmdData = {
    name: 'sleep'
};

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (config.fun.fall_asleep.enabled && message.channel.isSendable()) {
		const hasRole = message.member?.roles.cache.has(config.fun.fall_asleep.force_role);
		
		if (!hasRole) {
			wrath.sendAngry(message);
			return;
		}
		
		ctx.fallAsleep();

		await message.reply('_Zzz...._');
    }
}

export default {
    data,
    execute,
}