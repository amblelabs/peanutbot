import { ActivityType, Client, Events, GatewayIntentBits, MessageComponentInteraction, MessageFlags } from 'discord.js';
import config from '../config.json.js';
import type { Cmd } from './util/base.ts';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './util/logger.ts';

// Create a new client instance
const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.once(Events.ClientReady, readyClient => {
	logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
	readyClient.user.setActivity('?help', { type: ActivityType.Watching });
});

const commands: Dict<Cmd> = {};

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = (await import(filePath)).default;
		
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if (command?.data && command?.execute) {
			commands[command.data.name] = command;
		} else {
			logger.warn(`The command at ${filePath} is missing a required "data" and "execute" property.`);
		}
	}
}

client.on(Events.MessageCreate, async message => {
	if (message.content.charAt(0) !== '?') return;

	const command = message.content.substring(1);
	const args = command.split(' ');
	const first = args[0];

	const handler = commands[first];

	if (handler) {
		await handler.execute(message, args.slice(1));
	}
});

client.on('interactionCreate', async interaction => {
	if (!(interaction instanceof MessageComponentInteraction))
		return;

	const ic = interaction.customId.indexOf(':');
	const id = interaction.customId.substring(0, ic);

	const handler = commands[id];

	if (handler?.onInteraction) {
		await handler.onInteraction(interaction);
	}
});

// Log in to Discord with your client's token
client.login(config.token);