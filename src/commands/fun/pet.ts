import config from "config.json";
import { SharedSlashCommand, SlashCommandBuilder, type Interaction, type Message, type SendableChannels } from "discord.js"
import type { Cmd, CmdData, Ctx } from "~/util/base"
import cache from "~/util/cache";

const url = "http://raw.githubusercontent.com/amblelabs/peanutbot/master/assets/peanut_pet_1.webm";

const data: CmdData = {
    name: 'pet',
}

async function play(channel: SendableChannels) {
    cache.uncache(url, m => channel.send(m));
}

async function execute(ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) {
    if (config.fun.pet.enabled) {
        await play(channel);
    } 
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
    return builder.setDescription('pet');
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
    if (!interaction.isChatInputCommand() || !config.fun.pet.enabled) return;

    await interaction.deferReply();
    await interaction.deleteReply();

    if (interaction.channel?.isSendable())
        await play(interaction.channel);
}

export default {
    data,
    slash,
    execute,
    onInteraction,
} as Cmd