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
  name: "wiki",
};

function makeReply(type?: string): string {
  return config.support.short.wiki;
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  await message.reply(config.support.short.wiki);
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder.setDescription("Sends a link to the wiki.");
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  await interaction.reply(config.support.short.wiki);
}

export default {
  data,
  slash,
  execute,
  onInteraction,
} as Cmd;
