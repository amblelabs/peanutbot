import config from "config.json";
import type { Message, SendableChannels } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"
import wrath from "~/util/angry";

const data: CmdData = {
    name: 'sleep'
};

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    if (config.fun.fall_asleep.enabled) {
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
} as Cmd