import config from "config.json";
import type { Interaction, Message, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'peanut',
};

function makeReply(): string {
    return rnd.pickRandom(config.texts.peanuts);
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    await message.reply({stickers: [makeReply()]});
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('peanut');
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();
    await interaction.deleteReply();
    
    if (interaction.channel?.isSendable())
        await interaction.channel.send({stickers: [makeReply()]});
}

export default {
    data,
    slash,
    execute,
    onInteraction,
}