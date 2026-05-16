import config from "config.json";
import {
  SharedSlashCommand,
  SlashCommandBuilder,
  type Interaction,
  type Message,
  type SendableChannels,
} from "discord.js";
import { format, type Cmd, type CmdData, type Ctx } from "~/util/base";

const data: CmdData = {
  name: "serverisdown",
};

let cooldown = 0;

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder.setDescription("Help! The server is down!");
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (
    !interaction.isChatInputCommand() ||
    !config.support.serverIsDown.enabled
  ) {
    if (interaction.isRepliable())
      await interaction.reply({
        content: "Notified MC admins!",
        flags: ["Ephemeral"],
      });
    return;
  }

  if (Date.now() - cooldown < config.support.serverIsDown.cooldown) {
    const timestamp = `<t:${Math.floor((Date.now() + config.support.serverIsDown.cooldown) / 1000)}:R>`;

    await interaction.reply({
      content: format(config.support.serverIsDown.format.cooldown, timestamp),
      flags: ["Ephemeral"],
    });

    return;
  }

  const channel = await ctx.client.channels.fetch(
    config.support.serverIsDown.channel,
  );

  if (!channel || !channel.isSendable()) {
    await interaction.reply({
      content: config.support.serverIsDown.format.error,
      flags: ["Ephemeral"],
    });

    return;
  }

  await channel.send(
    format(config.support.serverIsDown.format.ping, interaction.user.id),
  );

  await interaction.reply({
    content: config.support.serverIsDown.format.success,
    flags: ["Ephemeral"],
  });

  cooldown = Date.now() + config.support.serverIsDown.cooldown;
}

export default {
  data,
  slash,
  onInteraction,
} as Cmd;
