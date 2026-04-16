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
  name: "serverisdown",
};

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder.setDescription("Help! The server is down!");
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (!interaction.isChatInputCommand() || !config.support.serverIsDown.enabled)
    return;

  const channel = await ctx.client.channels.fetch(
    config.support.serverIsDown.channel,
  );

  if (!channel || !channel.isSendable()) return;

  await channel.send(
    `<@&${config.support.serverIsDown.role}> by <@${interaction.user.id}>`,
  );
}

export default {
  data,
  slash,
  onInteraction,
} as Cmd;
