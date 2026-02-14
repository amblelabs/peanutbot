import config from "config.json";
import type {
  Client,
  Interaction,
  Message,
  SendableChannels,
  SharedSlashCommand,
  SlashCommandBuilder,
} from "discord.js";
import {
  DataTypes,
  Model,
  Op,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";
import type { Cmd, CmdData, Ctx } from "~/util/base";
import { logger } from "~/util/logger";

const regex = new RegExp(
  "(?:([0-9]{1,2}d))?(?:([0-9]{1,2}h))?(?:([0-9]{1,2}m))?",
);

const data: CmdData = {
  name: "memo",
};

class Memos extends Model<
  InferAttributes<Memos>,
  InferCreationAttributes<Memos>
> {
  declare id: CreationOptional<number>;
  declare owner: string;
  declare text: string;
  declare timeout: number;
}

function makeReply(
  timestamp: string | undefined,
  owner: string,
  text: string,
): string {
  if (!timestamp) return config.memos.invalidTimestamp;

  const res = regex.exec(timestamp);

  if (!res) {
    return config.memos.invalidTimestamp;
  }

  try {
    const days = parseInt(res[1] ?? 0);
    const hours = parseInt(res[2] ?? 0) + days * 24;
    const minutes = parseInt(res[3] ?? 0) + hours * 60;

    const totalTime = Date.now() + minutes * 60 * 1000;

    Memos.create({
      owner,
      text,
      timeout: totalTime,
    });

    return config.memos.success
      .replaceAll("$DAYS", res[1] ?? 0)
      .replaceAll("$HOURS", res[2] ?? 0)
      .replaceAll("$MINUTES", res[3] ?? 0);
  } catch (error) {
    return config.memos.badNumbers;
  }
}

async function execute(
  ctx: Ctx,
  message: Message,
  channel: SendableChannels,
  args: string[],
) {
  await message.reply(
    makeReply(args[0], message.author.id, args.slice(1).join(" ")),
  );
}

async function tickMinute(client: Client) {
  const now = Date.now();

  const results = await Memos.findAll({
    where: {
      timeout: {
        [Op.lt]: now,
      },
    },
  });

  results.forEach(async (memo) => {
    const user = await client.users.fetch(memo.owner);

    try {
      user?.send(config.memos.reminder.replaceAll("$TEXT", memo.text));
    } catch (e) {}

    memo.destroy();
  });
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder
    .setDescription("Handles, remind me...")
    .addStringOption((option) =>
      option
        .setName("timeout")
        .setDescription(
          "After how much time to send the memo? ([]d[]h[]m format).",
        )
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("What to remind?")
        .setRequired(true),
    );
}

async function onInteraction(ctx: Ctx, interaction: Interaction) {
  if (interaction.isAutocomplete()) {
    await interaction.respond([{ name: "0d0h0m", value: "0d0h0m" }]);
  }

  if (!interaction.isChatInputCommand()) return;

  const timeout = interaction.options.getString("timeout", true);
  const text = interaction.options.getString("text", true);

  logger.debug(`Reminded ${interaction.user.globalName}`);
  await interaction.reply(makeReply(timeout, interaction.user.id, text));
}

async function setup(ctx: Ctx) {
  Memos.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      owner: DataTypes.STRING,
      text: DataTypes.TEXT,
      timeout: DataTypes.INTEGER.UNSIGNED,
    },
    { sequelize: ctx.sql },
  );

  Memos.sync();
  setInterval(async () => tickMinute(ctx.client), 60 * 1000);
}

export default {
  data,
  slash,
  execute,
  onInteraction,
  setup,
} as Cmd;
