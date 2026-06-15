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

// 1. MODIFIED: Combines stickers and videos into a single pool to pick from
function makeReplyPayload() {
  // Pull lists safely from config (fallback to empty arrays if they don't exist yet)
  const stickers = config.fun.peanuts || [];
  const videos = config.fun.peanutV || [];

  // Combine both types into objects that remember what they are
  const pool = [
    ...stickers.map(id => ({ type: "sticker" as const, value: id })),
    ...videos.map(path => ({ type: "video" as const, value: path }))
  ];

  if (pool.length === 0) return { content: "No peanuts found!" };

  const picked = rnd.pickRandom(pool);

  // Return the exact layout Discord expects based on the asset type
  if (picked.type === "sticker") {
    return { stickers: [picked.value] };
  } else {
    return { files: [picked.value] }; // Sends local files or direct URL videos
  }
}

async function execute(
    _ctx: Ctx,
    message: Message,
    _channel: SendableChannels,
    _args: string[],
) {
  // 2. MODIFIED: Passes the generated payload directly
  await message.reply(makeReplyPayload());
}

function slash(builder: SlashCommandBuilder): SharedSlashCommand {
  return builder.setDescription("peanut");
}

async function onInteraction(_ctx: Ctx, interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();
  await interaction.deleteReply();

  // 3. MODIFIED: Passes the generated payload to the channel instead
  if (interaction.channel?.isSendable())
    await interaction.channel.send(makeReplyPayload());
}

export default {
  data,
  slash,
  execute,
  onInteraction,
} as Cmd;