import { ActivityType, Client, Events, GatewayIntentBits, MessageComponentInteraction } from 'discord.js';
import config from '../config.json.js';
import type { Cmd, Ctx } from './util/base.ts';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './util/logger.ts';
import wrath from './util/angry.ts';
import { Sequelize } from 'sequelize';

// Create a new client instance
const dbPath = path.resolve(__dirname, '../database.sqlite');

const ctx: Ctx = {
	client: new Client({ 
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
	}),
	sql: new Sequelize({
		dialect: 'sqlite',
		logging: (sql) => logger.debug(sql),
		storage: dbPath,
	}),
	sleeping: false,
	lastUse: Date.now(),
};

function wakeUp() {
	ctx.sleeping = false;
	ctx.client.user?.setStatus('online');
	ctx.client.user?.setActivity('?help', { type: ActivityType.Watching });
}

function fallAsleep() {
	ctx.sleeping = true;
	ctx.client.user?.setStatus('idle');
	ctx.client.user?.setActivity('dreams...', { type: ActivityType.Watching });
}

ctx.client.once(Events.ClientReady, readyClient => {
	for (const cmd of Object.values(commands)) {
		if (cmd?.setup)
			cmd.setup(ctx);
	}

	ctx.sql.authenticate();
	wakeUp();
	
	logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
});

const commands: Dict<Cmd> = {};

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath).default;
		
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if (command?.data && command?.execute) {
			commands[command.data.name] = command;
		} else {
			logger.warn(`The command at ${filePath} is missing a required "data" and "execute" property.`);
		}
	}
}

ctx.client.on(Events.MessageCreate, async message => {
	if (message.content.charAt(0) !== '?') {
		if (ctx.sleeping && message.content === message.content.toUpperCase() && message.content.includes('!')) {
			wakeUp();
			message.channel.send({stickers: [config.fun.fall_asleep.awake_sticker]});
		}
		return;
	}

	ctx.lastUse = Date.now();
	
	const command = message.content.substring(1);
	const args = command.split(' ');
	const first = args[0];

	if (config.fun.fall_asleep.enabled && first === 'sleep' && message.channel.isSendable()) {
		const hasRole = message.member?.roles.cache.has(config.fun.fall_asleep.force_role);
		
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
		if (handler) await handler.execute(ctx, message, args.slice(1));
	}
	
	if (ctx.sleeping) {
		wakeUp();
		message.channel.send({stickers: [config.fun.fall_asleep.awake_sticker]});
		message.channel.send('...');
		setTimeout(async () => await handleCommand(handler), config.fun.fall_asleep.cmd_delay * 1000);
	} else {
		handleCommand(handler);
	}
});

ctx.client.on('interactionCreate', async interaction => {
	if (!(interaction instanceof MessageComponentInteraction))
		return;

	if (ctx.sleeping) {
		wakeUp();
	}

	ctx.lastUse = Date.now();

	const ic = interaction.customId.indexOf(':');
	const id = interaction.customId.substring(0, ic);

	const handler = commands[id];

	if (handler?.onInteraction) {
		await handler.onInteraction(ctx, interaction);
	}
});

function tickMinute() {
	const now = Date.now();
	if (now - ctx.lastUse > config.fun.fall_asleep.sleep_timer * 60 * 1000) {
		fallAsleep();
	}
}

async function tickSleepSticker() {
	if (ctx.sleeping) {
		const channel = ctx.client.channels.cache.get(config.fun.fall_asleep.channel);
		if (channel?.isSendable())
			await channel.send({stickers: [config.fun.fall_asleep.sleep_sticker]})
	}
}

process.on('uncaughtException', (err) => {
	logger.fatal('Uncaught Exception:');
	logger.fatal(err);
	
	// Perform cleanup, log the error, send alerts, etc.
	process.exit(1); // Exit the process after handling
});

setInterval(tickMinute, 60 * 1000); // every minute
setInterval(tickSleepSticker, 60*60*1000); // every hour

// Log in to Discord with your client's token
ctx.client.login(config.token);