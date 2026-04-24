import config from "config.json";
import {
  type Interaction,
  type Message,
  type SendableChannels,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
  name: "claude",
};

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  await message.reply(config.fun.claude);
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (interaction.isChatInputCommand())
    await interaction.reply(config.fun.claude);
}

export default {
  data,
  execute,
  onInteraction,
} as Cmd;
