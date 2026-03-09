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
  name: "dontask",
};

function makeReply(): string {
  return "[Don't ask to ask](https://dontasktoask.com/)[, just ask](https://cdn.discordapp.com/attachments/1213989170964340883/1480647617514836238/image.png?ex=69b0700d&is=69af1e8d&hm=3544630a7e734655a9474ef0aadc0c3a0d0b8655a8b5a0faf9e201f4d1182997)";
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  await message.reply();
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder
    .setDescription("Don't ask to ask.");
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
