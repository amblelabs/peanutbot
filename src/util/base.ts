import type { CacheType, Client, Interaction, Message, MessageCreateOptions, MessagePayload, PartialTextBasedChannelFields, SendableChannels, SharedSlashCommand, SlashCommandBuilder } from "discord.js";
import type { Sequelize } from "sequelize";

export type CmdData = {
    name: string,
};

export type Cmd = {
    data: CmdData,
    setup?: (ctx: Ctx) => Promise<void> | void,
    execute?: (ctx: Ctx, message: Message, channel: SendableChannels, args: string[]) => Promise<void> | void,
    onInteraction?: (ctx: Ctx, interaction: Interaction) => Promise<void> | void,
    onMessage?: (ctx: Ctx, message: Message) => Promise<void> | void,
    slash?: (builder: SlashCommandBuilder) => SharedSlashCommand,
};

export type Ctx = {
    client: Client,
    sleeping: boolean,
    sql: Sequelize,
    lastUse: number,

    wakeUp: (message?: Message) => void,
    fallAsleep: () => void,
};