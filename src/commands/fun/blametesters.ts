import config from "config.json";
import type { Message } from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base"
import rnd from "~/util/rnd";

const data: CmdData = {
    name: 'blame',
};

async function onMessage(ctx: Ctx, message: Message) {
    if (!message.channel.isSendable() || message.author.bot) return;

    async function process(c: string) {
      const responsible = message.mentions.has(ctx.client.user!) && (c.includes("who") && (c.includes("responsible") || c.includes("blame")));
    
      if (responsible) {
          message.reply(rnd.pickRandom(config.fun.blame.antifun.concat(config.fun.blame.noUpdates)));
          return;
      }

      const misc = ((c.includes("gamebreaking") || c.includes("game-breaking") || c.includes("game breaking")) && c.includes("bug"))
          || (c.includes("release") || c.includes("mod") || c.includes("upate")) && (c.includes("lag") || c.includes("bug"));
    
    
      if (misc) {
          message.reply(rnd.pickRandom(config.fun.blame.antifun));
          return;
      }

      const noUpdates = c.includes("no updates") || c.includes("release was") || c.includes("update was");

      if (noUpdates)
          message.reply(rnd.pickRandom(config.fun.blame.noUpdates));
      }
    }

    const content = message.content.toLowerCase();
    process(content);
}

export default {
    data,
    onMessage,
} as Cmd
