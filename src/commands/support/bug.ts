import config from "config.json";
import type { Interaction, Message, SendableChannels, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'bug',
};

function makeReply(type?: string): string {
    if (type === 'stargate') {
        return config.texts.stargate_bug;
    }

    if (type === 'timeless' || type == 'heroes' || type == 'th') {
        return config.texts.th_bug;
    }
    
    return config.texts.ait_bug;
}

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    await message.reply(makeReply(args[0]));
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('Sends a bug report form.')
        .addStringOption(option => 
            option.setName('target')
            .setDescription('Which mod?')
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
} as Cmd