import { ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, Client, Events, GatewayIntentBits, MessageFlags, MessageManager } from 'discord.js';
import config from '../config.json.js';
import support from './support.ts';
import wikisearch from './wikisearch.ts';

function getRandomIntInclusive(min: number, max: number): number {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(c: T[]): T {
	return c[getRandomIntInclusive(0, c.length - 1)];
}

// Create a new client instance
const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	readyClient.user.setActivity('?help', { type: ActivityType.Watching });
});

client.on(Events.MessageCreate, async message => {
	if (message.content.charAt(0) !== '?') return;

	const command = message.content.substring(1);
	const args = command.split(' ');
	const first = args[0];

	switch (first) {
		case "forge":
			await message.reply(config.texts.forge_faq);
			break;
			
		case "eta":
			await message.reply(config.texts.eta_text);
			break;
		
		case "peanut":
			await message.reply({stickers: [pickRandom(config.texts.peanuts)]});
			break;

		case "help":	
			await message.reply({ content: config.texts.help_text })
			break;

		case "search":
			const result = await wikisearch.search(command);

			const msgBuilder = [
				config.texts.searching_header
			];

			for (const res of result) {
				const title = res.prefix ?? res.children.title;
				msgBuilder.push(`- [${title}](<${config.wikisearch.base_url}${res.route}>)`);

				let content = res.children.content;

				if (content.length > config.wikisearch.max_length)
					content = content.substring(0, config.wikisearch.max_length);

				content = content + '...';
				msgBuilder.push(`> ${content}\n`);
			}

			await message.reply(msgBuilder.join('\n'));
			break;

		default:
			if (first === "wiki") {
				if (args[1] === "stargate") {
					await message.reply(config.texts.stargate_wiki);
					return;
				}
				
				await message.reply(config.texts.ait_wiki);
			} else if (first === "bug") {
				if (args[1] === "stargate") {
					await message.reply(config.texts.stargate_bug);
					return;
				}

				await message.reply(config.texts.ait_bug);
			} else if (first === "support") {
				const type = args[1] ?? 'ping';

				switch (type) {
					case 'ping':
						const confirm = new ButtonBuilder()
							.setCustomId('support/ping/confirm')
							.setLabel('Confirm')
							.setStyle(ButtonStyle.Success);

						const cancel = new ButtonBuilder()
							.setCustomId('support/ping/cancel')
							.setLabel('Cancel')
							.setStyle(ButtonStyle.Secondary);

						const row = new ActionRowBuilder<ButtonBuilder>()
							.addComponents(confirm, cancel);

						const sent = await message.reply({
							content: config.texts.ping_support,
							components: [row],
						});

						setTimeout(async () => {
							await sent.delete();
						}, 5000);
					break;

					default:
						const start = performance.now();
						const response = await support.provideSupport(message.content);
						const end = performance.now();

						console.log(`Provided support in ${end - start}ms.`)						
						await message.reply(response);
						break;
				}
			}
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;

	if (interaction.customId.startsWith('support/ping/')) {
		if (interaction.customId.endsWith('cancel')) {
			await interaction.reply({content: 'Cancelled.', flags: [MessageFlags.Ephemeral]});
			await interaction.message.delete();
		} else if (interaction.customId.endsWith('confirm')) {
			const ref = await interaction.message.fetchReference();
			await ref.reply(`<@&${config.texts.support_id}>`);

			await interaction.reply({content: 'Pinged support!', flags: [MessageFlags.Ephemeral]});
			await interaction.message.delete();
		}
	}
});

// Log in to Discord with your client's token
client.login(config.token);