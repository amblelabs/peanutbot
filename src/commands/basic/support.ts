import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, MessageComponentInteraction, MessageFlags, type CacheType, type Interaction } from "discord.js";

import support from "~/util/support";
import search from "./search";
import config from "config.json";
import type { CmdData, Ctx } from "~/util/base";
import { logger } from "~/util/logger";

async function execute(ctx: Ctx, message: Message, args: string[]) {
    if (!args[0] || args[0] === 'ping') {
        const confirm = new ButtonBuilder()
            .setCustomId('support:ping/confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const cancel = new ButtonBuilder()
            .setCustomId('support:ping/cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirm, cancel);

        const sent = await message.reply({
            content: config.texts.ping_support,
            components: [row],
        });

        setTimeout(async () => {
            try {
                await sent.delete();
            } catch(error) { }
        }, 5000);

        return;
    }
    
    const start = performance.now();
    const [success, resMsg] = await support.provideSupport(args.join(' '));
    const end = performance.now();

    logger.debug(`Provided support in ${end - start}ms.`);
    
    const target = message.reference ? await message.fetchReference() : message;
    await target.reply(resMsg);

    if (!success && config.support.do_wikisearch) {
        await search.execute(ctx, message, args);
    }
}

async function onInteraction(ctx: Ctx, interaction: MessageComponentInteraction<CacheType>) {
    if (!interaction.isButton()) return;
	
    if (interaction.customId.startsWith('support:ping/')) {
		if (interaction.customId.endsWith('cancel')) {
			await interaction.reply({content: 'Cancelled.', flags: [MessageFlags.Ephemeral]});
			await interaction.message.delete();
		} else if (interaction.customId.endsWith('confirm')) {
			const ref = await interaction.message.fetchReference();
			await ref.reply(`<@&${config.texts.support_id}>`);

			await interaction.reply({content: 'Pinged support!', flags: [MessageFlags.Ephemeral]});
			await interaction.message.delete();
		}
	}
}

const data: CmdData = {
    name: 'support',
};

export default {
    data,
    execute,
    onInteraction,
}