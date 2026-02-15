import config from "config.json";
import {
  EmbedBuilder,
  Events,
  WebhookClient,
  type HexColorString,
} from "discord.js";
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

  constructor(idOrURL: string, instanceURL = "https://api.revolt.chat/") {
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

const dismoji2Stoatmoji = Object.entries(config.bridge.emojis);
const stoatmoji2Dismoji = dismoji2Stoatmoji.map(([key, val]) => [val, key]);
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

      let content = message.content;

      for (const [stoatmoji, dismoji] of stoatmoji2Dismoji) {
        content = content.replaceAll(stoatmoji, dismoji);
      }

      const embeds = [];

      if (message.replyIds) {
        const replies = await Promise.all(
          message.replyIds.map(
            (val) =>
              client.messages.get(val) || message.channel?.fetchMessage(val),
          ),
        );

        for (const reply of replies) {
          if (!reply) continue;

          embeds.push(
            new EmbedBuilder()
              .setAuthor({
                iconURL: reply.author?.avatarURL || reply.avatarURL,
                name: reply.author?.displayName || reply.username || "unknown",
              })
              .setColor(
                message.roleColour
                  ? (message.roleColour as HexColorString)
                  : null,
              )
              .setDescription(reply.content),
          );
        }
      }

      if (message.mentionIds && message.server) {
        const members = await Promise.all(
          message.mentionIds.map(
            (mention) =>
              message.server!.getMember(mention) ||
              message.server!.fetchMember(mention),
          ),
        );

        for (const member of members) {
          content = content.replaceAll(
            `<@${member.id.user}>`,
            `\`@${member?.displayName}\``,
          );
        }
      }

      if (embeds.length > 0) {
        await webhook.send({
          content: "-# ↪ Reply:",
          embeds: embeds,
          avatarURL: message.author.avatarURL || message.avatarURL,
          username:
            (message.author.displayName || message.username || "unknown") +
            " (stoat)",
        });
      }
      await webhook.send({
        content: content,
        avatarURL: message.author.avatarURL || message.avatarURL,
        username:
          (message.author.displayName || message.username || "unknown") +
          " (stoat)",
      });
    });

    logger.info("Waiting 10s to start stoat bot...");
    setTimeout(() => {
      client.loginBot(config.bridge.stoat.token);
    }, 10000);

    ctx.client.on(Events.MessageCreate, async (event) => {
      if (event.webhookId || !event.inGuild() || !event.member) return;

      if (!(event.channelId in discord2Stoat)) return;

      const stoatChannel = discord2Stoat[event.channelId];
      const webhook = stoat2Webhook[stoatChannel];

      let content = event.content;

      for (const [dismoji, stoatmoji] of dismoji2Stoatmoji) {
        content = content.replaceAll(dismoji, stoatmoji);
      }

      for (const mention of event.mentions.members) {
        content = content.replaceAll(
          `<@${mention[0]}>`,
          `\`@${mention[1].displayName}\``,
        );
      }

      if (event.reference) {
        const reply = await event.fetchReference();

        content =
          `Reply to \`@${reply.author.displayName}\`\n` +
          reply.content
            .split("\n")
            .map((val) => "> " + val)
            .join("\n") +
          "\n" +
          content;
      }

      logger.info(
        await webhook.send({
          content: content,
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
