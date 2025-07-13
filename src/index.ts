import { ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, Client, Events, GatewayIntentBits, MessageFlags, MessageManager } from 'discord.js';
import config from '../config.json.js';
import support from './support.ts';

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

client.on(Events.MessageCreate, message => {
	if (message.content.charAt(0) !== '?') return;

	const command = message.content.substring(1);
	const args = command.split(' ');
	const first = args[0];

	switch (first) {
		case "forge":
			message.reply(config.texts.forge_faq);
			break;
			
		case "eta":
			message.reply(config.texts.eta_text);
			break;
		
		case "peanut":
			message.reply({stickers: [pickRandom(config.texts.peanuts)]});
			break;

		case "help":	
			message.reply({ content: config.texts.help_text })
			break;

		default:
			if (first === "wiki") {
				if (args[1] === "stargate") {
					message.reply(config.texts.stargate_wiki);
					return;
				}
				
				message.reply(config.texts.ait_wiki);
			} else if (first === "bug") {
				if (args[1] === "stargate") {
					message.reply(config.texts.stargate_bug);
					return;
				}

				message.reply(config.texts.ait_bug);
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

						const sent = message.reply({
							content: config.texts.ping_support,
							components: [row],
						});

						setTimeout(async () => {
							await (await sent).delete();
						}, 5000);
					break;

					default:
						support.provideSupport(message);
						break;
				}
			}
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;

	if (interaction.customId.startsWith('support/ping/')) {
		if (interaction.customId.endsWith('cancel')) {
			interaction.reply({content: 'Cancelled.', flags: [MessageFlags.Ephemeral]});
			interaction.message.delete();
		} else if (interaction.customId.endsWith('confirm')) {
			const ref = await interaction.message.fetchReference();
			ref.reply(`<@&${config.texts.support_id}>`);

			interaction.reply({content: 'Pinged support!', flags: [MessageFlags.Ephemeral]});
			interaction.message.delete();
		}
	}
});

// Log in to Discord with your client's token
client.login(config.token);