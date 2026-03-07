import config from "config.json";
import {
  Message,
  Events,
  GuildMember,
  TextChannel,
  type SendableChannels,
} from "discord.js";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import { logger } from "~/util/logger";

const data: CmdData = {
  name: "perform_edit",
};

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  // guild:   01KHEFHPG0YC7PWE8JF78ZBS0E
  // channel: 01KHEGJB9KF5Y8PWXQJBP5DF4H
  // message: 01KHEZ6BF0DR3D6EQPAS9SX2JK
  // 0-9, A-Z = 10 + 26 = 36
  //
  //
  return;
  logger.info("editing... %s", JSON.stringify(message.toJSON()));
  const newMsg = await message.edit({
    flags: "2048",
    components: [],

    allowedMentions: {
      roles: ["01KHEZ6BF0DR3D6EQPAS9SX2JK"],
    },
    options: {
      nonce: "123",
      allowedMentions: {
        roles: ["01KHEZ6BF0DR3D6EQPAS9SX2JK"],
      },
    },
    body: {
      nonce: "123",
      allowed_mentions: {
        roles: ["01KHEZ6BF0DR3D6EQPAS9SX2JK"],
      },
    },
  });
  logger.info("new:       %s", JSON.stringify(newMsg.toJSON()));
}

export default {
  data,
  execute,
} as Cmd;
