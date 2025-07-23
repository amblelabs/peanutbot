import { ActivityType, Client, Events, GatewayIntentBits, MessageComponentInteraction, REST, Routes, SlashCommandBuilder } from 'discord.js';
import config from '../config.json.js';
import type { Cmd, Ctx } from './util/base.ts';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './util/logger.ts';
import wrath from './util/angry.ts';
import { Sequelize } from 'sequelize';
import wikisearch from './util/wikisearch.ts';

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

	wakeUp: () => {
		ctx.sleeping = false;
		ctx.client.user?.setStatus('online');
		ctx.client.user?.setPresence({ 
			status: 'online', 
			activities: [{ 
				name: '?help', 
				type: ActivityType.Watching 
			}]
		});
	},
	fallAsleep: () => {
		ctx.sleeping = true;
		ctx.client.user?.setPresence({ 
			status: 'idle', 
			activities: [{ 
				name: 'dreams...', 
				type: ActivityType.Watching 
			}]
		});
	},
};

ctx.client.once(Events.ClientReady, async readyClient => {
	for (const cmd of Object.values(handlers)) {
		if (cmd?.setup)
			cmd.setup(ctx);
	}

	ctx.sql.authenticate();
	ctx.wakeUp();
	
	logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
});

const handlers: Dict<Cmd> = {};
const slashCommands: any[] = [];

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath).default;
		
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if (command?.data) {
			handlers[command.data.name] = command;
			
			if (command.slash)
				slashCommands.push(command.slash(
					new SlashCommandBuilder().setName(command.data.name)).toJSON());
		} else {
			logger.warn(`The command at ${filePath} is missing a required "data" and "execute" property.`);
		}
	}
}

const rest = new REST().setToken(config.token);

// and deploy your commands!
(async () => {
	try {
		logger.info(`Started refreshing application (/) commands.`);

		for (const guildId of config.guildId) {
		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(config.clientId, guildId),
			{ body: slashCommands },
		) as any[];
		logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
	}

	} catch (error) {
		// And of course, make sure you catch and log any errors!
		logger.error(error);
	}
})();

ctx.client.on(Events.MessageCreate, async message => {
	if (message.content.charAt(0) !== '?') {
		const content = message.content;
		if (ctx.sleeping && content.length > 1 && content === content.toUpperCase() && content.includes('!')) {
			ctx.wakeUp();
			message.channel.send({stickers: [config.fun.fall_asleep.awake_sticker]});
		}
		
		for (const handler of Object.values(handlers)) {
			if (handler?.onMessage)
				handler.onMessage(ctx, message);
		}

		return;
	}

	ctx.lastUse = Date.now();
	
	const command = message.content.substring(1);
	const args = command.split(' ');
	const first = args[0];

	const handler = handlers[first];
	
	async function handleCommand(handler?: Cmd) {
		if (handler?.execute) handler.execute(ctx, message, args.slice(1));
	}
	
	if (ctx.sleeping) {
		ctx.wakeUp();
		message.channel.send({stickers: [config.fun.fall_asleep.awake_sticker]});
		message.channel.send('...');
		setTimeout(async () => handleCommand(handler), config.fun.fall_asleep.cmd_delay * 1000);
	} else {
		handleCommand(handler);
	}
});

ctx.client.on(Events.InteractionCreate, async interaction => {
	if (ctx.sleeping) {
		ctx.wakeUp();
	}

	ctx.lastUse = Date.now();

	let handlerId: string | undefined;
	if (interaction.isButton()) {
		const ic = interaction.customId.indexOf(':');
		handlerId = interaction.customId.substring(0, ic);
	} else if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
		handlerId = interaction.commandName;
	}

	if (!handlerId)
		return;

	let handler = handlers[handlerId];
	if (handler?.onInteraction) handler.onInteraction(ctx, interaction);
});

function tickMinute() {
	const now = Date.now();
	if (now - ctx.lastUse > config.fun.fall_asleep.sleep_timer * 60 * 1000) {
		ctx.fallAsleep();
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
setInterval(tickSleepSticker, 60*61*1000); // every hour

// Log in to Discord with your client's token
ctx.client.login(config.token);