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
