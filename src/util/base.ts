import {
  type Client,
  type Interaction,
  type Message,
  MessageReaction,
  Partials,
  type SendableChannels,
  type SharedSlashCommand,
  type SlashCommandBuilder,
  type User,
} from "discord.js";
import type { Sequelize } from "sequelize";
import type { SearchClient } from "./wikisearch2";

export type CmdData = {
  name: string;
};

export type Cmd = {
  data: CmdData;
  setup?: (ctx: Ctx) => Promise<void> | void;
  execute?: (
    ctx: Ctx,
    message: Message,
    channel: SendableChannels,
    args: string[],
  ) => Promise<void> | void;
  onInteraction?: (ctx: Ctx, interaction: Interaction) => Promise<void> | void;
  onMessage?: (ctx: Ctx, message: Message) => Promise<void> | void;
  onMessageReactionAdd?: (ctx: Ctx, reaction: MessageReaction, user: User) => Promise<void> | void;
  onMessageReactionRemove?: (ctx: Ctx, reaction: MessageReaction, user: User) => Promise<void> | void;
  slash?: (builder: SlashCommandBuilder) => SharedSlashCommand;
};

export type Ctx = {
  client: Client;
  sleeping: boolean;
  sql: Sequelize;
  lastUse: number;

  wakeUp: (message?: Message) => void;
  fallAsleep: () => void;

  search: SearchClient;
};

export function format(str: string, ...values: any[]) {
  if (values) {
    var t = typeof values[0];
    var key;
    var args: any[] =
      "string" === t || "number" === t ? values.slice() : values[0];

    for (key in args) {
      str = str.replace(new RegExp(`\\{${key}\\}`, "gi"), args[key]);
    }
  }

  return str;
}
