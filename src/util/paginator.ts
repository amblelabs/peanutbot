import type { Interaction, Message, RepliableInteraction } from "discord.js";

const MESSAGE_CHAR_LIMIT = 2000;

export function paginate(message: string | string[]): string[] {
  if (message.length < MESSAGE_CHAR_LIMIT) {
    return typeof message === "string" ? [message] : message;
  }

  if (Array.isArray(message)) message = message.join("\n");
  const lines = message.split("\n");

  const result: string[] = [];
  let messageBuilder: string[] = [];

  for (const line of lines) {
    if (messageBuilder.length + line.length > MESSAGE_CHAR_LIMIT) {
      result.push(messageBuilder.join("\n"));
      messageBuilder = [line];
    } else {
      messageBuilder.push(line);
    }
  }

  return result;
}

export async function paginateReplyMessage(
  message: Message,
  content: string | string[],
) {
  const result = paginate(content);
  if (!message.channel.isSendable()) return;

  await message.reply(result[0]);

  for (let i = 1; i < result.length; i++) {
    await message.channel.send(result[i]);
  }
}

export async function paginateReply(
  interaction: RepliableInteraction,
  message: string | string[],
  follow: boolean = false,
) {
  const result = paginate(message);

  if (follow) {
    await interaction.followUp(result[0]);
  } else {
    await interaction.reply(result[0]);
  }

  for (let i = 1; i < result.length; i++) {
    await interaction.followUp(result[i]);
  }
}
