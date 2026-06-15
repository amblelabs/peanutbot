import { Client, GatewayIntentBits, type TextChannel } from "discord.js";
import env from "../../env.json"; // Adjust this path to your config file if needed
import { logger } from "./logger";
// Grab the channel ID and message from the terminal command
const channelId = process.argv[2];
const message = process.argv.slice(3).join(" "); // Joins all words after the ID

if (!channelId || !message) {
    console.log("Missing info! Usage: bun run src/say.ts  ");
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
    try {
        // Tell TypeScript "Treat this exactly like a TextChannel"
        const channel = await client.channels.fetch(channelId) as TextChannel;

        if (channel && typeof channel.send === 'function') {
            await channel.send(message);
            logger.info(`Message sent to channel #${channel.name}!`);
            console.log(`Message sent to channel #${channel.name}!`);
        } else {
            logger.info("That channel cannot accept text messages.")
            console.log("That channel cannot accept text messages.");
        }
    } catch (error) {
        logger.info("Failed to send:", error);
        console.error("Failed to send:", error);
    }

    client.destroy();
    process.exit(0);
});

// Make sure your config file actually stores the token like this!
client.login(env.token);