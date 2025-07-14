import { ActivityType, AttachmentBuilder, Client, Events, GatewayIntentBits, MessageComponentInteraction } from 'discord.js';
import config from '../config.json.js';
import type { Cmd } from './util/base.ts';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './util/logger.ts';
import wrath from './util/angry.ts';

// Create a new client instance
const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

function wakeUp() {
	sleeping = false;
	client.user?.setStatus('online');
	client.user?.setActivity('?help', { type: ActivityType.Watching });
}

function fallAsleep() {
	sleeping = true;
	client.user?.setStatus('idle');
	client.user?.setActivity('dreams...', { type: ActivityType.Watching });
}

client.once(Events.ClientReady, readyClient => {
	logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
	wakeUp();
});

const commands: Dict<Cmd> = {};
let sleeping = false;

let lastUse = new Date().getTime();

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
			if (command.setup)
				command.setup(client)
			
			commands[command.data.name] = command;
		} else {
			logger.warn(`The command at ${filePath} is missing a required "data" and "execute" property.`);
		}
	}
}

client.on(Events.MessageCreate, async message => {
	if (message.content.charAt(0) !== '?') return;

	lastUse = new Date().getTime();
	
	const command = message.content.substring(1);
	const args = command.split(' ');
	const first = args[0];

	if (config.fun.fall_asleep.enabled && first === 'sleep' && message.channel.isSendable()) {
		const hasRole = message.member?.roles.cache.some(role => role.id === config.fun.fall_asleep.force_role);
		
		if (!hasRole) {
			await wrath.sendAngry(message);
			return;
		}
		
		fallAsleep();

		await message.reply('_Zzz...._');
		return;
	}

	const handler = commands[first];
	
	async function handleCommand(handler?: Cmd) {
		if (handler) await handler.execute(message, args.slice(1));
	}
	
	if (sleeping) {
		wakeUp();
		message.channel.send({stickers: [config.fun.fall_asleep.sticker]});
		message.channel.send('...');
		setTimeout(async () => await handleCommand(handler), config.fun.fall_asleep.cmd_delay * 1000);
	} else {
		handleCommand(handler);
	}
});

client.on('interactionCreate', async interaction => {
	if (!(interaction instanceof MessageComponentInteraction))
		return;

	if (sleeping) {
		wakeUp();
	}

	lastUse = new Date().getTime();

	const ic = interaction.customId.indexOf(':');
	const id = interaction.customId.substring(0, ic);

	const handler = commands[id];

	if (handler?.onInteraction) {
		await handler.onInteraction(interaction);
	}
});

function tickMinute() {
	const now = new Date().getTime();
	if (now - lastUse > config.fun.fall_asleep.sleep_timer * 60 * 1000) {
		fallAsleep();
	}
}

setInterval(tickMinute, 60 * 1000);

// Log in to Discord with your client's token
client.login(config.token);