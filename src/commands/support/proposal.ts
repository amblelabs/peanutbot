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
  name: "proposals",
};

const propRe = /ait-(\d+)/gi;

async function onMessage(
  ctx: Ctx,
  message: Message,
) {
  async function process(content: string) {
    for (const propNum in content.match(propRe)) {
      message.reply(`**Proposal ${propNum}**: [ait-next/${propNum}](https://github.com/amblelabs/ait-next/issues/${propNum})`);
    }
  }

  process(message.content);
}

export default {
  data,
  onMessage,
} as Cmd;
