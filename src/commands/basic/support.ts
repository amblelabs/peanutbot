import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, Message, MessageFlags, SharedSlashCommand, SlashCommandBuilder, type Channel, type Interaction, type Snowflake } from "discord.js";

import support from "~/util/support";
import search from "./search";
import config from "config.json";
import type { CmdData, Ctx } from "~/util/base";
import { logger } from "~/util/logger";

function makePingButtons(): ActionRowBuilder<ButtonBuilder> {
    const confirm = new ButtonBuilder()
        .setCustomId('support:ping/confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirm);
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    async function pingSupport() {
        const sent = await message.reply({
            content: config.texts.ping_support,
            components: [makePingButtons()],
        });

        setTimeout(async () => {
            try {
                await sent.delete();
            } catch(error) { }
        }, 5000);
    }

    if (!args[0] || args[0] === 'ping') {
        pingSupport();
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
        
        await pingSupport();
    }
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('Provides support.')
        .addSubcommand(input => input.setName('ping').setDescription('Ping the support team.'))
        .addSubcommand(input => input.setName('search').setDescription('Search for the solution.')
            .addStringOption(option =>
                option.setName('query')
                    .setRequired(false)
                    .setDescription('Describe your problem here.')
        ));
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'ping') {
            await interaction.reply({
                content: config.texts.ping_support, 
                components: [makePingButtons()],
                flags: [MessageFlags.Ephemeral],
            });
        } else if (subcommand === 'search') {
            const query = interaction.options.getString('query', true);
    
            const start = performance.now();
            const [success, resMsg] = await support.provideSupport(query);
            const end = performance.now();

            logger.debug(`Provided support in ${end - start}ms.`);
            
            await interaction.reply(resMsg);

            if (!success && config.support.do_wikisearch) {
                await interaction.followUp(await search.printSearchResults(query));
                
                await interaction.followUp(`Query: ${query}`)
                await interaction.followUp({
                    content: config.texts.ping_support,
                    components: [makePingButtons()],
                    flags: [MessageFlags.Ephemeral],
                });
            }
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'support:ping/confirm') {
            const ogReply = `<@&${config.texts.support_id}>`;

            if (interaction.message.reference) {
                const ref = await interaction.message.fetchReference();
                await ref.reply(ogReply);
                
                interaction.reply({content: 'Pinged support!', flags: [MessageFlags.Ephemeral]});
            } else {
                interaction.reply(ogReply);
            }
           
            if (!interaction.message.flags.has(MessageFlags.Ephemeral)) {
                try {
                    interaction.message.delete();
                } catch (e) { }
            }
        }
    }
}

function isFromSupportChanel(channelId: Snowflake): boolean {
    for (const supportChId of config.support.channels) {
        if (supportChId === channelId)
            return true;
    }

    return false;
}

async function setup(ctx: Ctx) {
    ctx.client.on(Events.ThreadCreate, async event => {
        if (!event.parentId || !isFromSupportChanel(event.parentId))
            return;

        const message = await event.fetchStarterMessage();

        if (!message)
            return;
        
        const start = performance.now();
        const [, resMsg] = await support.provideSupport(message.content);
        const end = performance.now();

        logger.debug(`Provided support in ${end - start}ms.`);
        
        const target = message.reference ? await message.fetchReference() : message;
        await target.reply(resMsg);

        if (config.support.do_wikisearch) {
            await search.searchByQuery(ctx, message, message.content);
        }

        await message.reply({
            content: config.texts.ping_support,
            components: [makePingButtons()],
        });
    });
}

const data: CmdData = {
    name: 'support',
};

export default {
    data,
    setup,
    slash,
    execute,
    onInteraction,
}