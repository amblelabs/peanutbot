import {type Client} from "discord.js";
import config from "../../../config.json";

export default async function promo(client: Client) {
    const channel = await client.channels.fetch(config.auto.promo.channel);
    if (!channel || !channel.isTextBased() || channel.isDMBased())
        return;
    await channel.send(config.auto.promo.message);
}