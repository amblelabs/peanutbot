import config from "config.json";
import type { Interaction, Message, SendableChannels, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"

const data: CmdData = {
    name: 'eta',
};

function makeReply(): string {
    return config.texts.eta_text;
}

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    await message.reply(makeReply());
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('When is the mod gonna be out?');
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
} as Cmd