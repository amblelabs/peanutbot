import type { CacheType, Client, Message, MessageComponentInteraction } from "discord.js";
import type { Sequelize } from "sequelize";

export type CmdData = {
    name: string,
};

export type Cmd = {
    data: CmdData,
    setup?: (ctx: Ctx) => Promise<void> | void,
    execute: (ctx: Ctx, message: Message, args: string[]) => Promise<void> | void,
    onInteraction?: (ctx: Ctx, interaction: MessageComponentInteraction<CacheType>) => Promise<void> | void,
};

export type Ctx = {
    client: Client,
    sleeping: boolean,
    sql: Sequelize,
    lastUse: number,
}