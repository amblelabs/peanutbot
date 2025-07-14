import type { CacheType, Interaction, Message, MessageComponentInteraction } from "discord.js";

export type CmdData = {
    name: string,
};

export type Cmd = {
    data: CmdData,
    execute: (message: Message, args: string[]) => Promise<void> | void,
    onInteraction?: (interaction: MessageComponentInteraction<CacheType>) => Promise<void> | void,
};