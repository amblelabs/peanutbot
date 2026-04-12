import type { Message, RepliableInteraction } from "discord.js";

const MESSAGE_CHAR_LIMIT = 2000;

export function paginate(message: string | string[]): string[] {
  if (Array.isArray(message)) message = message.join("\n");

  if (message.length < MESSAGE_CHAR_LIMIT) {
    return [message];
  }

  const lines = message.split("\n");

  const result: string[] = [];
  let messageBuilder: string = "";

  for (const line of lines) {
    if (messageBuilder.length + line.length + 1 > MESSAGE_CHAR_LIMIT) {
      result.push(messageBuilder);
      messageBuilder = line;
    } else {
      messageBuilder += "\n" + line;
    }
  }

  result.push(messageBuilder);
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
  first: "reply" | "follow" | "send" = "reply",
  other: "send" | "follow" = "send",
) {
  const result = paginate(message);

  if (first === "reply") {
    await interaction.reply(result[0]);
  } else if (first === "follow") {
    await interaction.followUp(result[0]);
  } else if (first === "send" && interaction.channel?.isSendable()) {
    await interaction.channel.send(result[0]);
  }

  if (other === "send" && interaction.channel?.isSendable()) {
    for (let i = 1; i < result.length; i++) {
      await interaction.channel.send(result[i]);
    }
  } else if (other === "follow") {
    for (let i = 1; i < result.length; i++) {
      await interaction.followUp(result[i]);
    }
  }
}
