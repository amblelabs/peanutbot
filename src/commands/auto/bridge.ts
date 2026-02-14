import config from "config.json";
import { Events, GuildChannel, WebhookClient } from "discord.js";
import { Client } from "stoat.js";
import type { Cmd, Ctx } from "~/util/base";
import { logger } from "~/util/logger";

interface RevoltMasqueradeOptions {
  name?: string;
  avatar?: string;
  colour?: string;
}

interface WebhookMessageOptions {
  content?: string;
  masquerade?: RevoltMasqueradeOptions;
  embeds?: any[]; // Revolt embed objects
  attachments?: any[]; // For file uploads (more complex)
}

class RevoltWebhookClient {
  private latter: string;
  private baseURL: string;

  constructor(idOrURL: string, instanceURL = "https://app.revolt.chat/api") {
    this.latter = idOrURL;
    this.baseURL = instanceURL;
  }

  /**
   * Send a message via the webhook.
   */
  async send(options: string | WebhookMessageOptions) {
    let payload;
    if (typeof options === "string") {
      if (!options) return;

      payload = { content: options };
    } else {
      if (!options.attachments && !options.content && !options.embeds) return;

      payload = options;
    }

    const response = await fetch(`${this.baseURL}/webhooks/${this.latter}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Revolt webhook error (${response.status}): ${error}`);
    }

    return response.json(); // Returns the created message object
  }
}

const discord2Webhook = Object.fromEntries(
  Object.entries(config.bridge.discord.webhooks).map(([key, val]) => [
    key,
    new WebhookClient({ url: `https://discord.com/api/webhooks/${val}` }),
  ]),
);

const stoat2Webhook = Object.fromEntries(
  Object.entries(config.bridge.stoat.webhooks).map(([key, val]) => [
    key,
    new RevoltWebhookClient(val),
  ]),
);

const discord2Stoat: Record<string, string> = config.bridge.channels;
const stoat2Discord = Object.fromEntries(
  Object.entries(discord2Stoat).map(([key, val]) => [val, key]),
);

const client = new Client();

export default {
  data: {
    name: "bridge",
  },
  async setup(ctx: Ctx) {
    client.on("ready", async () => {
      await client.user!.edit({ status: { presence: "Busy" } });
      logger.info(`(stoat) Logged in as ${client.user!.username}!`);
    });

    client.on("messageCreate", async (message) => {
      if (!message.author || message.author.bot) return;

      if (!(message.channelId in stoat2Discord)) return;

      const discordChannel = stoat2Discord[message.channelId];
      const webhook = discord2Webhook[discordChannel];

      logger.info("(stoat) message: " + message.content);
      await webhook.send({
        content: message.content,
        avatarURL: message.author.avatarURL,
        username: message.author.displayName + " (stoat)",
      });
    });

    client.loginBot(config.bridge.stoat.token);

    ctx.client.on(Events.MessageCreate, async (event) => {
      if (event.webhookId || !event.inGuild() || !event.member) return;

      if (!(event.channelId in discord2Stoat)) return;

      console.log("1");
      const stoatChannel = discord2Stoat[event.channelId];
      const webhook = stoat2Webhook[stoatChannel];

      logger.info(
        await webhook.send({
          content: event.content,
          masquerade: {
            avatar: event.member.displayAvatarURL(),
            name: event.member.displayName + " (discord)",
            colour: event.member.displayHexColor,
          },
        }),
      );
    });
  },
} as Cmd;
