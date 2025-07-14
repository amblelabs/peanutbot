import type { CacheType, Client, Interaction, Message, MessageComponentInteraction } from "discord.js";

export type CmdData = {
    name: string,
};

export type Cmd = {
    data: CmdData,
    setup?: (client: Client) => Promise<void> | void,
    execute: (message: Message, args: string[]) => Promise<void> | void,
    onInteraction?: (interaction: MessageComponentInteraction<CacheType>) => Promise<void> | void,
};