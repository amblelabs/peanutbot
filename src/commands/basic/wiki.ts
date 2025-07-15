import config from "config.json";
import type { Interaction, Message, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'wiki',
};

function makeReply(type?: string): string {
    if (type === 'stargate') {
        return config.texts.stargate_wiki;
    }
    
    if (type === 'timeless' || type === 'heroes' || type === 'th') {
        return config.texts.th_wiki;
    }
    
    return config.texts.ait_wiki;
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    await message.reply(makeReply(args[0]));
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('Sends a link to the wiki.')
        .addStringOption(option => 
            option.setName('target')
            .setDescription('Which wiki?')
            .setChoices({name: 'Adventures in Time', value: 'ait'}, {name: 'Stargate', value: 'stargate'}, {name: 'Timeless Heroes', value: 'th'})
        );
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const type = interaction.options.getString('target');
    await interaction.reply(makeReply(type ?? undefined));
}

export default {
    data,
    slash,
    execute,
    onInteraction,
}