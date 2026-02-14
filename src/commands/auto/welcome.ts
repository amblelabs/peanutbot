import config from "config.json";
import {
  Message,
  Events,
  GuildMember,
  TextChannel,
  type SendableChannels,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";

const data: CmdData = {
  name: "welcome",
};

async function welcome(channel: SendableChannels, member: GuildMember) {
  await channel.send(config.welcome.message.replaceAll("$USER", member.id));
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  if (message.reference) {
    const og = await message.fetchReference();

    if (og.member) welcome(channel, og.member);
  }
}

async function setup(ctx: Ctx) {
  setTimeout(async () => {
    ctx.client.on(Events.GuildMemberAdd, async (ctx) => {
      const welcomeChannel = await ctx.guild.channels.fetch(
        config.welcome.channel,
      );

      if (welcomeChannel?.isSendable()) await welcome(welcomeChannel, ctx);
    });
  }, 10 * 1000);
}

export default {
  data,
  setup,
  execute,
} as Cmd;
