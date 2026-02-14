import config from "config.json";
import type {
  Interaction,
  Message,
  SendableChannels,
  SharedSlashCommand,
  SlashCommandBuilder,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
  name: "forge",
};

function makeReply() {
  return config.support.short.forge;
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
  return builder.setDescription("I use a forge build btw.");
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
