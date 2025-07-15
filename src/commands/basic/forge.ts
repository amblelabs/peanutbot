import config from "config.json";
import type { Interaction, Message, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import type { CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'forge',
};

function makeReply() {
    return config.texts.forge_faq;
}

async function execute(ctx: Ctx, message: Message, args: string[]) {
    await message.reply(makeReply());
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('I use a forge build btw.');
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