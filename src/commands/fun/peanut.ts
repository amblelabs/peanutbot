import config from "config.json";
import type {
  Interaction,
  Message,
  SendableChannels,
  SharedSlashCommand,
  SlashCommandBuilder,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import rnd from "~/util/rnd";

const data: CmdData = {
  name: "peanut",
};

function makeReply(): string {
  return rnd.pickRandom(config.fun.peanuts);
}

async function execute(
  _ctx: Ctx,
  message: Message,
  _channel: SendableChannels,
  _args: string[],
) {
  await message.reply({ stickers: [makeReply()] });
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder.setDescription("peanut");
}

async function onInteraction(_ctx: Ctx, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();
  await interaction.deleteReply();

  if (interaction.channel?.isSendable())
    await interaction.channel.send({ stickers: [makeReply()] });
}

export default {
  data,
  slash,
  execute,
  onInteraction,
} as Cmd;
