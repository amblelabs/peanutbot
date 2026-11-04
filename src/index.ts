import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Message,
  MessageComponentInteraction,
  type MessageReaction,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import config from "../config.json.js";
import env from "../env.json.js";
import type { Cmd, Ctx } from "./util/base.ts";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./util/logger.ts";
import { Sequelize } from "sequelize";
import { oramaStaticClient } from "./util/wikisearch2.ts";
import { create as createOrama } from "@orama/orama";
import {createActivityServer} from "~/activity.ts";
import promo from "src/commands/auto/promo.ts"

// Create a new client instance
const dbPath = path.resolve(__dirname, "../database.sqlite");

const ctx: Ctx = {
  client: new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User],
  }),
  sql: new Sequelize({
    dialect: "sqlite",
    logging: (sql) => logger.debug(sql),
    storage: dbPath,
  }),
  sleeping: false,
  lastUse: Date.now(),

  wakeUp: (message?: Message) => {
    ctx.sleeping = false;
    ctx.client.user?.setStatus("online");
    ctx.client.user?.setPresence({
      status: "online",
      activities: [
        {
          name: "?help",
          type: ActivityType.Watching,
        },
      ],
    });

    if (message && message.channel.isSendable())
      message.channel.send({ stickers: [config.fun.sleep.awakeSticker] });
  },
  fallAsleep: () => {
    ctx.sleeping = true;
    ctx.client.user?.setPresence({
      status: "idle",
      activities: [
        {
          name: "dreams...",
          type: ActivityType.Watching,
        },
      ],
    });
  },

  search: oramaStaticClient({
    initOrama: () => {
      return createOrama({
        schema: { _: "string" },
        // https://docs.orama.com/docs/orama-js/supported-languages
        language: "english",
      });
    },
    locale: "en",
    from: config.wikisearch.baseUrl + config.wikisearch.index,
  }),
};

ctx.client.once(Events.ClientReady, async (readyClient) => {
  for (const cmd of Object.values(handlers)) {
    if (cmd?.setup) cmd.setup(ctx);
  }

  ctx.sql.authenticate();
  ctx.wakeUp();

  logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
  await promo(ctx.client)
});

const handlers: Dict<Cmd> = {};
const slashCommands: any[] = [];

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".ts"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath).default;

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if (command?.data) {
      handlers[command.data.name] = command;

      if (command.slash)
        slashCommands.push(
          command
            .slash(new SlashCommandBuilder().setName(command.data.name))
            .toJSON(),
        );
    } else {
      logger.warn(
        `The command at ${filePath} is missing a required "data" and "execute" property.`,
      );
    }
  }
}

const rest = new REST().setToken(env.token);

// and deploy your commands!
(async () => {
  try {
    logger.info(`Started refreshing application (/) commands.`);

    for (const guildId of config.guildId) {
      // The put method is used to fully refresh all commands in the guild with the current set
      const data = (await rest.put(
        Routes.applicationGuildCommands(config.clientId, guildId),
        { body: slashCommands },
      )) as any[];

      logger.info(`Reloaded ${data.length} application (/) commands.`);
    }
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    logger.error(error);
  }
})();

ctx.client.on(Events.MessageCreate, async (message) => {
  if (message.content.charAt(0) !== "?") {
    const content = message.content;
    if (
      ctx.sleeping &&
      content.length > 1 &&
      content === content.toUpperCase() &&
      content.includes("!")
    ) {
      ctx.wakeUp(message);
    }

    for (const handler of Object.values(handlers)) {
      if (handler?.onMessage) await handler.onMessage(ctx, message);
    }

    return;
  }

  ctx.lastUse = Date.now();

  if (!message.channel.isSendable()) return;

  const command = message.content.substring(1);
  const args = command.split(" ");
  const first = args[0];

  const handler = handlers[first];

  async function handleCommand(handler?: Cmd) {
    if (handler?.execute)
      handler.execute(ctx, message, message.channel, args.slice(1));
  }

  if (ctx.sleeping) {
    ctx.wakeUp();
    message.channel.send("...");
    setTimeout(
      async () => handleCommand(handler),
      config.fun.sleep.cmdDelay * 1000,
    );
  } else {
    handleCommand(handler);
  }
});

ctx.client.on(Events.InteractionCreate, async (interaction) => {
  if (ctx.sleeping) {
    ctx.wakeUp();
  }

  ctx.lastUse = Date.now();

  let handlerId: string | undefined;
  if (interaction.isButton() || interaction.isModalSubmit()) {
    const ic = interaction.customId.indexOf(":");
    handlerId = interaction.customId.substring(0, ic);
  } else if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    handlerId = interaction.commandName;
  }

  if (!handlerId) return;

  let handler = handlers[handlerId];
  if (handler?.onInteraction) handler.onInteraction(ctx, interaction);
});

ctx.client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error(`Failed to fetch reaction partial details: ${error}`);
      return;
    }
  }

  // Ensure we pass a complete User object if it started as an uncached partial
  if (user.partial) {
    try {
      user = await user.fetch();
    } catch (error) {
      logger.error(`Failed to fetch user partial details: ${error}`);
      return;
    }
  }
  //unsleeps
  ctx.lastUse = Date.now();
  if (ctx.sleeping) {
    ctx.wakeUp();
  }

  // Dispatches event data across all commands implementing the reaction hook
  for (const handler of Object.values(handlers)) {
    if (handler?.onMessageReactionAdd) {
      try {
        await handler.onMessageReactionAdd(ctx, reaction as MessageReaction, user);
      } catch (error) {
        logger.error(`Error executing reaction hook in command "${handler.data.name}":`, error);
      }
    }
  }
});

ctx.client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error(`Failed to fetch reaction partial details: ${error}`);
      return;
    }
  }

  // Ensure we pass a complete User object if it started as an uncached partial
  if (user.partial) {
    try {
      user = await user.fetch();
    } catch (error) {
      logger.error(`Failed to fetch user partial details: ${error}`);
      return;
    }
  }
  //unsleeps
  ctx.lastUse = Date.now();
  if (ctx.sleeping) {
    ctx.wakeUp();
  }

  // Dispatches event data across all commands implementing the reaction hook
  for (const handler of Object.values(handlers)) {
    if (handler?.onMessageReactionRemove) {
      try {
        await handler.onMessageReactionRemove(ctx, reaction as MessageReaction, user);
      } catch (error) {
        logger.error(`Error executing reaction remove hook in command "${handler.data.name}":`, error);
      }
    }
  }
});

function tickMinute() {
  const now = Date.now();
  if (now - ctx.lastUse > config.fun.sleep.timer * 60 * 1000) {
    ctx.fallAsleep();
  }
}

async function tickSleepSticker() {
  if (ctx.sleeping) {
    const channel = ctx.client.channels.cache.get(config.fun.sleep.channel);
    if (channel?.isSendable())
      await channel.send({ stickers: [config.fun.sleep.sticker] });
  }
}

process.on("uncaughtException", (err) => {
  logger.fatal("Uncaught Exception:");
  logger.error(err);

  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  logger.fatal("Unhandled Rejection:");
  logger.error(err);

  process.exit(1);
});

setInterval(tickMinute, 60 * 1000); // every minute
setInterval(tickSleepSticker, 60 * 61 * 1000); // every hour

const PORT = Number(process.env.PORT) || 7681;
const app = createActivityServer(ctx.client);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Port is ${PORT}`);
});

// Log in to Discord with your client's token
ctx.client.login(env.token);
