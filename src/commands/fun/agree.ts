import config from "config.json";
import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import rnd from "~/util/rnd";

const data: CmdData = {
  name: "agree_with_me",
};

async function onMessage(ctx: Ctx, message: Message) {
  if (!message.channel.isSendable() || !message.mentions.has(ctx.client.user!))
    return;

  let content = message.content.toLowerCase();

  if (content.includes("?") && content.includes("agree"))
    message.reply(rnd.pickRandom(config.fun.highfives));
}

export default {
  data,
  onMessage,
} as Cmd;
