import config from "config.json";
import {
  SharedSlashCommand,
  SlashCommandBuilder,
  type Interaction,
  type Message,
  type SendableChannels,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
  name: "help",
};

function makeReply(): string {
  return config.help.message;
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  await message.reply(makeReply());
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder.setDescription("Help!");
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
} as Cmd;
