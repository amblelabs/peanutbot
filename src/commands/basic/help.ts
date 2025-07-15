import config from "config.json";
import { SharedSlashCommand, SlashCommandBuilder, type Interaction, type Message } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'help',
};

function makeReply(): string {
    return config.texts.help_text;
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    await message.reply(makeReply());
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('Help!');
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.reply(makeReply());
}

export default {
    data,
    slash,
    execute,
    onInteraction,
}