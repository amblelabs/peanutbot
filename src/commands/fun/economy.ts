import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    Message,
    type TextChannel,
    ComponentType,
    ButtonStyle, ButtonBuilder, ActionRowBuilder
} from "discord.js";
import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
    Op, Sequelize
} from "sequelize";
import type { Cmd } from "~/util/base";
import randomUtils from "~/util/rnd";
import config from "config.json";

// 2. Define the Database Models
export class EconomyProfile extends Model<
    InferAttributes<EconomyProfile>,
    InferCreationAttributes<EconomyProfile>
> {
    declare guildId: string;
    declare userId: string;
    declare balance: CreationOptional<number>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export class Inventory extends Model<
    InferAttributes<Inventory>,
    InferCreationAttributes<Inventory>
> {
    declare id: CreationOptional<number>;
    declare guildId: string;
    declare userId: string;
    declare itemKey: string;
    declare quantity: CreationOptional<number>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export class ShopItem extends Model<
    InferAttributes<ShopItem>,
    InferCreationAttributes<ShopItem>
> {
    declare guildId: string;
    declare itemId: string;
    declare name: string;
    declare description: string;
    declare price: number;
    declare roleId: CreationOptional<string | null>;
    declare stock: CreationOptional<number>;
    declare durationDays: CreationOptional<number | null>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export class TempRole extends Model<InferAttributes<TempRole>, InferCreationAttributes<TempRole>> {
    declare id: CreationOptional<number>;
    declare guildId: string;
    declare userId: string;
    declare roleId: string;
    declare expiresAt: Date;
}
const STARTING_BALANCE = 10
export default {
    data: { name: "economy" },

    setup: async (ctx) => {
        // Initialize Economy Profiles (Composite Primary Key of Guild + User)
        EconomyProfile.init(
            {
                guildId: { type: DataTypes.STRING, primaryKey: true },
                userId: { type: DataTypes.STRING, primaryKey: true },
                balance: { type: DataTypes.INTEGER, defaultValue: STARTING_BALANCE },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE,
            },
            { sequelize: ctx.sql },
        );

        // Initialize Inventory Tracking
        Inventory.init(
            {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                guildId: { type: DataTypes.STRING, allowNull: false },
                userId: { type: DataTypes.STRING, allowNull: false },
                itemKey: { type: DataTypes.STRING, allowNull: false },
                quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE,
            },
            { sequelize: ctx.sql },
        );

        ShopItem.init(
            {
                guildId: { type: DataTypes.STRING, primaryKey: true },
                itemId: { type: DataTypes.STRING, primaryKey: true }, // The ID users type to buy
                name: { type: DataTypes.STRING, allowNull: false },
                description: { type: DataTypes.STRING, allowNull: false },
                price: { type: DataTypes.INTEGER, allowNull: false },
                roleId: { type: DataTypes.STRING, allowNull: true },
                stock: { type: DataTypes.INTEGER, defaultValue: -1 },
                durationDays: { type: DataTypes.INTEGER, allowNull: true },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE,
            },
            { sequelize: ctx.sql }
        );

        TempRole.init(
            {
                id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
                guildId: { type: DataTypes.STRING, allowNull: false },
                userId: { type: DataTypes.STRING, allowNull: false },
                roleId: { type: DataTypes.STRING, allowNull: false },
                expiresAt: { type: DataTypes.DATE, allowNull: false },
            },
            { sequelize: ctx.sql }
        );
        // Establish relationships
        EconomyProfile.hasMany(Inventory, { foreignKey: "userId", sourceKey: "userId", onDelete: "CASCADE" });
        Inventory.belongsTo(EconomyProfile, { foreignKey: "userId", targetKey: "userId" });

        await ctx.sql.sync();

        const guilds = ctx.client.guilds.cache;

        for (const [guildId, guild] of guilds) {
            // 3. Seed the default items for each server!
            await seedDefaultShopItems(guildId);
        }
    },

    slash: (builder) => {
        return builder
            .setName("economy")
            .setDescription("Manage your pocket change and inventory")
            .addSubcommand((sub) =>
                sub
                    .setName("balance")
                    .setDescription("Check your current balance or another user's balance")
                    .addUserOption((opt) =>
                        opt.setName("user").setDescription("The user to check").setRequired(false),
                    ),
            )
            .addSubcommand(sub => sub
                .setName("leaderboard")
                .setDescription("View the leaderboard")
            )
            .addSubcommand((sub) =>
                sub.setName("shop").setDescription("View available items for purchase"),
            )
            .addSubcommand((sub) =>
                sub
                    .setName("buy")
                    .setDescription("Purchase an item from the shop")
                    .addStringOption((opt) =>
                        opt
                            .setName("item")
                            .setDescription("The ID of the item you want to buy (e.g. 'vip_role')")
                            .setRequired(true)
                    )
            )
            .addSubcommand((sub) =>
                sub.setName("inventory").setDescription("View items you currently own"),
            )
            .addSubcommand((sub) =>
                sub
                    .setName("add-money")
                    .setDescription("Add money to a user's balance (Admin/Staff Only)")
                    .addUserOption((opt) =>
                        opt.setName("user").setDescription("The user receiving the money").setRequired(true),
                    )
                    .addIntegerOption((opt) =>
                        opt.setName("amount").setDescription("The amount of money to add").setRequired(true),
                    ),
            )
            .addSubcommand((sub) =>
                sub
                    .setName("set-balance")
                    .setDescription("Forcefully set a user's balance to a specific amount (Staff Only)")
                    .addUserOption((opt) => opt.setName("user").setDescription("The target user").setRequired(true))
                    .addIntegerOption((opt) => opt.setName("amount").setDescription("The exact balance to set").setRequired(true)),
            )
            .addSubcommand((sub) =>
                sub
                    .setName("add-item")
                    .setDescription("Create a new item in the server shop (Staff Only)")
                    .addStringOption((opt) => opt.setName("id").setDescription("A short ID for buying (e.g. 'cookie')").setRequired(true))
                    .addStringOption((opt) => opt.setName("name").setDescription("The display name (e.g. '🍪 Cookie')").setRequired(true))
                    .addIntegerOption((opt) => opt.setName("price").setDescription("Cost of the item").setRequired(true))
                    .addStringOption((opt) => opt.setName("description").setDescription("What the item does").setRequired(true))
                    .addRoleOption((opt) => opt.setName("role").setDescription("Optional: A role to give upon purchase").setRequired(false))
                    .addIntegerOption((opt) => opt.setName("stock").setDescription("Amount available (leave blank for infinite stock)").setRequired(false))
            )
            // 👇 Admin Command: Remove Shop Item
            .addSubcommand((sub) =>
                sub
                    .setName("remove-item")
                    .setDescription("Remove an item from the server shop (Staff Only)")
                    .addStringOption((opt) => opt.setName("id").setDescription("The ID of the item to delete").setRequired(true))
            )
            .addSubcommandGroup((group) =>
                group
                    .setName("gamble")
                    .setDescription("Risk your money on different casino games!")
                    .addSubcommand((sub) =>
                        sub
                            .setName("coinflip")
                            .setDescription("A 50/50 chance to double your money!")
                            .addIntegerOption((opt) => opt.setName("amount").setDescription("How much to bet").setRequired(true).setMinValue(1))
                    )
                    .addSubcommand((sub) =>
                        sub
                            .setName("dice")
                            .setDescription("Guess a 6-sided die roll. Win 5x your bet!")
                            .addIntegerOption((opt) => opt.setName("amount").setDescription("How much to bet").setRequired(true).setMinValue(1))
                            .addIntegerOption((opt) => opt.setName("guess").setDescription("Your guess (1-6)").setRequired(true).setMinValue(1).setMaxValue(6))
                    )
                    .addSubcommand((sub) =>
                        sub
                            .setName("roulette")
                            .setDescription("Open a roulette table and place multiple bets! (1-24, Red/Black, Even/Odd)")
                    )
            );

    },

    onInteraction: async (ctx, interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        // Handle the entire Gamble Group
        switch (group) {

            case "gamble":
                // Guard: Check if the current channel is in our allowed list
                if (!config.economy.gambleChannel.includes(interaction.channelId)) {
                    const allowedList = config.economy.gambleChannel.map((id: string) => `<#${id}>`).join(", ");

                    return interaction.reply({
                        content: `❌ Gambling commands can only be used in ${allowedList}`,
                        ephemeral: true
                    });
                }

                // Inner switch for the casino games
                switch (sub) {
                    case "coinflip":
                        return await handleGambleCoinflip(interaction);
                    case "dice":
                        return await handleGambleDice(interaction);
                    case "roulette":
                        return await handleGambleRoulette(interaction);
                }
                return; // Exits the gamble case

            case null:
            default:
                // 👇 Inner switch for all base economy commands (where group is null)
                switch (sub) {
                    case "leaderboard":
                        return await handleLeaderboard(interaction);
                    case "balance":
                        return await handleBalance(interaction);
                    case "shop":
                        return await handleShop(interaction);
                    case "buy":
                        return await handleBuy(interaction);
                    case "inventory":
                        return await handleInventory(interaction);
                    case "add-money":
                        return await handleAddMoney(interaction);
                    case "set-balance":
                        return await handleSetBalance(interaction);
                    case "add-item":
                        return await handleAddShopItem(interaction);
                    case "remove-item":
                        return await handleRemoveShopItem(interaction);
                }
                return;
        }
    },
} as Cmd;

// ── SUBCOMMAND HANDLERS ──────────────────────────────────────────────────

async function handleBalance(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser("user") || interaction.user;

    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: targetUser.id },
        defaults: { guildId: interaction.guildId!, userId: targetUser.id, balance: STARTING_BALANCE }
    });

    const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Vault`)
        .setDescription(`💵 **Balance:** \`$${profile.balance}\``)
        .setColor(0x00ae86)
        .setThumbnail(targetUser.displayAvatarURL());


    await interaction.editReply({
        embeds: [embed]
    });
}


async function handleShop(interaction: ChatInputCommandInteraction) {
    const items = await ShopItem.findAll({
        where: { guildId: interaction.guildId! }
    });

    const embed = new EmbedBuilder()
        .setTitle("🛒 The Server Marketplace")
        .setDescription("Use `/economy buy <item_id>` to purchase something!")
        .setColor(0x00ae86);

    if (items.length === 0) {
        embed.setDescription("The shop is currently empty. Admins need to add items!");
    } else {
        for (const item of items) {
            // 👇 Determine if it says "∞" or a specific number, or "OUT OF STOCK"
            let stockDisplay = item.stock === -1 ? "∞" : item.stock.toString();
            if (item.stock === 0) stockDisplay = "❌ OUT OF STOCK";

            embed.addFields({
                name: `${item.name} (\`${item.itemId}\`) — $${item.price}`,
                value: `${item.description}\n📦 **Stock:** ${stockDisplay}`,
                inline: false,
            });
        }
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
    const itemKey = interaction.options.getString("item", true).toLowerCase();

    const item = await ShopItem.findOne({
        where: { guildId: interaction.guildId!, itemId: itemKey }
    });

    if (!item) {
        return interaction.reply({ content: "That item doesn't exist in our shop.", ephemeral: true });
    }

    if (item.stock === 0) {
        return interaction.reply({ content: `❌ Sorry, **${item.name}** is completely sold out!`, ephemeral: true });
    }
    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, balance: 100 }
    });

    if (profile.balance < item.price) {
        await interaction.reply({
            content: `❌ You can't afford that! **${item.name}** costs \`$${item.price}\`, but you only have \`$${profile.balance}\`.`,
            ephemeral: true,
        });
        return;
    }

    let roleGrantedMessage = "";

    // ─── RESUME NORMAL INVENTORY & BALANCE SAVING ───────────────────────

    if (item.stock > 0) {
        item.stock -= 1;
        await item.save();
    }
    profile.balance -= item.price;
    if (item.roleId) {
        if (interaction.member instanceof GuildMember) {
            try {
                // If the item has a duration, track it!
                if (item.durationDays) {
                    const timeToAdd = item.durationDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds

                    // Check if they already have an active subscription for this role
                    let tempRole = await TempRole.findOne({
                        where: { guildId: interaction.guildId!, userId: interaction.user.id, roleId: item.roleId }
                    });

                    if (tempRole) {
                        // If they already have it, ADD the new days to their current expiration date (Stacking!)
                        tempRole.expiresAt = new Date(tempRole.expiresAt.getTime() + timeToAdd);
                        await tempRole.save();
                    } else {
                        // Start a brand new subscription
                        await TempRole.create({
                            guildId: interaction.guildId!,
                            userId: interaction.user.id,
                            roleId: item.roleId,
                            expiresAt: new Date(Date.now() + timeToAdd)
                        });
                    }

                    await interaction.member.roles.add(item.roleId, `Purchased ${item.durationDays} day pass.`);
                    roleGrantedMessage = ` and granted you the <@&${item.roleId}> role for **${item.durationDays} days**!`;

                } else {
                    // Permanent role logic
                    if (interaction.member.roles.cache.has(item.roleId)) {
                        return interaction.reply({ content: `❌ You already have this permanent role!`, ephemeral: true });
                    }
                    await interaction.member.roles.add(item.roleId, `Purchased permanent role.`);
                    roleGrantedMessage = ` and granted you the <@&${item.roleId}> role permanently!`;
                }
            } catch (error) {
                console.error("Failed to assign shop role:", error);
                return interaction.reply({ content: `❌ Internal Error: Please make sure my bot role is ABOVE the shop role in Server Settings.`, ephemeral: true });
            }
        }
    }
    await profile.save();

    // Add item to inventory database
    const [invItem, created] = await Inventory.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey, quantity: 1 }
    });

    if (!created) {
        invItem.quantity += 1;
        await invItem.save();
    }

    await interaction.reply({
        content: `🎉 Success! You bought **${item.name}** for \`$${item.price}\`${roleGrantedMessage}. Your remaining balance is \`$${profile.balance}\`.`,
    });
}

async function handleInventory(interaction: ChatInputCommandInteraction) {
    const items = await Inventory.findAll({
        where: { guildId: interaction.guildId!, userId: interaction.user.id }
    });

    if (items.length === 0) {
        await interaction.reply({ content: "🎒 Your inventory is completely empty. Go buy something!", ephemeral: true });
        return;
    }

    // 👇 Fetch all shop items from the DB to figure out their display names
    const allShopItems = await ShopItem.findAll({
        where: { guildId: interaction.guildId! }
    });

    // 👇 Map database entries to their descriptive shop names dynamically
    const itemManifest = Object.fromEntries(allShopItems.map((i) => [i.itemId, i.name]));

    const inventoryList = items
        .map((item) => {
            const visualName = itemManifest[item.itemKey] || `⚙️ Unknown Item (${item.itemKey})`;
            return `${visualName} x\`${item.quantity}\``;
        })
        .join("\n");

    const embed = new EmbedBuilder()
        .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
        .setDescription(inventoryList)
        .setColor(0x00ae86);

    await interaction.reply({ embeds: [embed] });
}

async function handleAddMoney(interaction: ChatInputCommandInteraction) {
    // 👇 Your exact role-check logic (Replace "1234" with your real Staff role ID)
    if (!interaction.inCachedGuild() || !interaction.member.roles.cache.has(config.economy.teamRole)) {
        return interaction.reply({
            content: "❌ You do not have the required staff role to grant currency.",
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    // Prevent staff from entering negative and/or too big numbers to steal money
    if (amount <= 0 || amount > 1000000) {
        return interaction.reply({
            content: "❌ Please use an integer smaller than 1,000,000 and bigger than 0",
            ephemeral: true
        });
    }

    // Fetch their profile, or create it if they've never interacted with the economy system
    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: targetUser.id },
        defaults: { guildId: interaction.guildId!, userId: targetUser.id, balance: 100 }
    });

    // Credit the money and save back to the database
    profile.balance += amount;
    await profile.save();

    await interaction.reply({
        content: `🪙 **Transaction Complete:** Successfully added \`$${amount}\` to ${targetUser.username}'s profile. Their new balance is \`$${profile.balance}\`.`,
    });
}
async function handleSetBalance(interaction: ChatInputCommandInteraction) {
    // Your exact staff role protection check
    if (!interaction.inCachedGuild() || !interaction.member.roles.cache.has(config.economy.teamRole)) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    }

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (amount < 0 || amount > 2_000_000_000) {
        return interaction.reply({ content: "❌ Invalid amount range (0 to 2B).", ephemeral: true });
    }

    // Update or insert into the database
    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: targetUser.id },
        defaults: { guildId: interaction.guildId!, userId: targetUser.id, balance: amount }
    });

    profile.balance = amount;
    await profile.save();

    await interaction.reply({
        content: `⚙️ **Database Updated:** ${targetUser.username}'s balance has been explicitly set to \`$${amount}\`.`,
    });
}
async function handleAddShopItem(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild() || !interaction.member.roles.cache.has(config.economy.teamRole)) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    }

    const itemId = interaction.options.getString("id", true).toLowerCase();
    const name = interaction.options.getString("name", true);
    const price = interaction.options.getInteger("price", true);
    const description = interaction.options.getString("description", true);
    const role = interaction.options.getRole("role", false);
    const stock = interaction.options.getInteger("stock") ?? -1; // 👇 Grab the stock, default to -1

    if (price < 0) return interaction.reply({ content: "❌ Price cannot be negative.", ephemeral: true });

    const [item, created] = await ShopItem.findOrCreate({
        where: { guildId: interaction.guildId!, itemId: itemId },
        defaults: {
            guildId: interaction.guildId!,
            itemId: itemId,
            name: name,
            price: price,
            description: description,
            roleId: role?.id || null,
            stock: stock // 👇 Save the stock to the DB
        }
    });

    if (!created) {
        return interaction.reply({ content: `❌ An item with the ID \`${itemId}\` already exists!`, ephemeral: true });
    }

    const stockMsg = stock === -1 ? "Infinite" : stock.toString();
    await interaction.reply({ content: `✅ Created new shop item: **${name}** for \`$${price}\` (Stock: ${stockMsg}).` });
}

async function handleRemoveShopItem(interaction: ChatInputCommandInteraction) {
    // Staff Check
    if (!interaction.inCachedGuild() || !interaction.member.roles.cache.has(config.economy.teamRole)) {
        return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    }

    const itemId = interaction.options.getString("id", true).toLowerCase();

    const deleted = await ShopItem.destroy({
        where: { guildId: interaction.guildId!, itemId: itemId }
    });

    if (deleted === 0) {
        return interaction.reply({ content: `❌ Could not find an item with the ID \`${itemId}\`.`, ephemeral: true });
    }

    await interaction.reply({ content: `🗑️ Successfully removed \`${itemId}\` from the shop.` });
}

async function handleGambleCoinflip(interaction: ChatInputCommandInteraction) {
    const betAmount = interaction.options.getInteger("amount", true);

    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, balance: 100 }
    });

    if (profile.balance < betAmount) {
        return interaction.reply({
            content: `❌ You can't afford that! You only have \`$${profile.balance}\` to your name.`,
            ephemeral: true,
        });
    }

    // 👇 Use your pickRandom utility to pull a random boolean from an array
    const isWinner = randomUtils.pickRandom([true, false]);

    if (isWinner) {
        profile.balance += betAmount;
        await profile.save();
        await interaction.reply({
            content: `🎰 **JACKPOT!** The coin landed in your favor. You won \`$${betAmount}\`!\n💰 Your new balance is \`$${profile.balance}\`.`
        });
    } else {
        profile.balance -= betAmount;
        await profile.save();
        await interaction.reply({
            content: `📉 **Bust!** Lady Luck was not on your side today. You lost \`$${betAmount}\`.\n💸 Your remaining balance is \`$${profile.balance}\`.`
        });
    }
}

async function handleGambleDice(interaction: ChatInputCommandInteraction) {
    const betAmount = interaction.options.getInteger("amount", true);
    const guess = interaction.options.getInteger("guess", true);

    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, balance: 100 }
    });

    if (profile.balance < betAmount) {
        return interaction.reply({
            content: `❌ You only have \`$${profile.balance}\`. You can't bet what you don't own!`,
            ephemeral: true,
        });
    }

    // 👇 Use your getRandomIntInclusive utility for a perfect 1-6 roll
    const diceRoll = randomUtils.getRandomIntInclusive(1, 6);

    if (guess === diceRoll) {
        const winnings = betAmount * 5;
        profile.balance += winnings;
        await profile.save();
        await interaction.reply({
            content: `🎲 The die rolled a **${diceRoll}**!\n🎉 **INCREDIBLE!** You guessed correctly and won \`$${winnings}\`!\n💰 Your new balance is \`$${profile.balance}\`.`
        });
    } else {
        profile.balance -= betAmount;
        await profile.save();
        await interaction.reply({
            content: `🎲 The die rolled a **${diceRoll}**...\n📉 You guessed ${guess}. You lost your bet of \`$${betAmount}\`.\n💸 Your remaining balance is \`$${profile.balance}\`.`
        });
    }
}

// 👇 Track which channels currently have an active game running
const activeRouletteChannels = new Set<string>();

async function handleGambleRoulette(interaction: ChatInputCommandInteraction) {
    // 👇 Guard: Prevent multiple tables in the same channel
    if (activeRouletteChannels.has(interaction.channelId)) {
        return interaction.reply({
            content: "❌ There is already an active roulette table in this channel! Please wait for the current spin to finish.",
            ephemeral: true
        });
    }

    // Lock the channel
    activeRouletteChannels.add(interaction.channelId);

    await interaction.reply({
        content: "🎡 **MULTIPLAYER ROULETTE IS OPEN!**\n\n" +
            "**Anyone** can jump in! Valid bets: `red`, `black`, `even`, `odd`, or a number `1` through `24`.\n" +
            "**How to bet:** Type `bet <choice> <amount>` (e.g., `bet red 50`, `bet 14 100`).\n" +
            "**When ready:** Anyone can type `spin` to roll the wheel! (Auto-spins in 60s)."
    });

    const bets: { userId: string; username: string; type: string; amount: number }[] = [];
    const filter = (m: Message) => !m.author.bot;
    const channel = interaction.channel as TextChannel;
    if (!interaction.channel || !interaction.channel.isTextBased()) {
        return interaction.reply({
            content: "❌ This command can only be played in standard text channels!",
            ephemeral: true
        });
    }
    const collector = channel.createMessageCollector({ filter, time: 60000 });

    collector.on("collect", async (m) => {
        const input = m.content.toLowerCase().trim();

        if (input === "spin") {
            collector.stop("user_spun");
            return;
        }

        // 👇 Guard: Force users to start their message with "bet" so innocent messages are ignored
        const args = input.split(" ");
        if (args.length !== 3 || args[0] !== "bet") return;

        const betType = args[1];
        const amount = parseInt(args[2]);

        if (isNaN(amount) || amount <= 0) return;

        const validTextBets = ["red", "black", "even", "odd"];
        const betNumber = parseInt(betType);
        const isValidNumber = !isNaN(betNumber) && betNumber >= 1 && betNumber <= 24;

        if (!validTextBets.includes(betType) && !isValidNumber) return;

        const [profile] = await EconomyProfile.findOrCreate({
            where: { guildId: interaction.guildId!, userId: m.author.id },
            defaults: { guildId: interaction.guildId!, userId: m.author.id, balance: 100 }
        });

        if (profile.balance < amount) {
            const errorMsg = await m.reply(`❌ You only have \`$${profile.balance}\`.`);
            setTimeout(() => errorMsg.delete().catch(() => null), 3000);
            return;
        }

        // Deduct money instantly
        profile.balance -= amount;
        await profile.save();

        // Save the bet
        bets.push({ userId: m.author.id, username: m.author.username, type: betType, amount });
        m.react("✅").catch(() => null);
    });

    collector.on("end", async () => {
        // 👇 Unlock the channel so a new game can be started
        activeRouletteChannels.delete(interaction.channelId);

        if (bets.length === 0) {
            return interaction.followUp("⏳ The table closed because no bets were placed.");
        }

        await interaction.followUp("🎡 **NO MORE BETS!** Spinning the wheel...");

        const roll = randomUtils.getRandomIntInclusive(1, 24);
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23];
        const rollColor = redNumbers.includes(roll) ? "red" : "black";
        const rollParity = roll % 2 === 0 ? "even" : "odd";
        const colorEmoji = rollColor === "red" ? "🔴" : "⚫";

        // 👇 Track total winnings AND total bets for the net profit math
        const playerResults: Record<string, { username: string, totalWon: number, totalBet: number, summary: string }> = {};

        for (const bet of bets) {
            if (!playerResults[bet.userId]) {
                playerResults[bet.userId] = { username: bet.username, totalWon: 0, totalBet: 0, summary: "" };
            }

            // Accumulate everything they spent
            playerResults[bet.userId].totalBet += bet.amount;

            let won = false;
            let multiplier = 0;

            if (bet.type === rollColor) { won = true; multiplier = 2; }
            else if (bet.type === rollParity) { won = true; multiplier = 2; }
            else if (!isNaN(parseInt(bet.type)) && parseInt(bet.type) === roll) { won = true; multiplier = 24; }

            if (won) {
                const winAmount = bet.amount * multiplier;
                playerResults[bet.userId].totalWon += winAmount;
                playerResults[bet.userId].summary += `✅ \`${bet.type}\`: Won **$${winAmount}**\n`;
            } else {
                playerResults[bet.userId].summary += `❌ \`${bet.type}\`: Lost\n`;
            }
        }

        let finalMessage = `### The wheel landed on **${roll} ${rollColor.toUpperCase()}** ${colorEmoji}!\n\n`;

        for (const [userId, result] of Object.entries(playerResults)) {
            if (result.totalWon > 0) {
                const [profile] = await EconomyProfile.findOrCreate({
                    where: { guildId: interaction.guildId!, userId: userId }
                });

                profile.balance += result.totalWon;
                await profile.save();
            }

            // 👇 Calculate actual Net Profit
            const netProfit = result.totalWon - result.totalBet;

            finalMessage += `**${result.username}**:\n${result.summary}`;

            if (netProfit > 0) {
                finalMessage += `📈 *Net Profit: +$${netProfit}*\n`;
            } else if (netProfit < 0) {
                finalMessage += `📉 *Net Loss: -$${Math.abs(netProfit)}*\n`;
            } else {
                finalMessage += `⚖️ *Broke Even!*\n`;
            }
            finalMessage += `\n`;
        }

        await interaction.followUp({ content: finalMessage });
    });
}

async function seedDefaultShopItems(guildId: string) {
    for (const item of config.economy.shopItems) {
        await ShopItem.findOrCreate({
            // It searches the DB to see if this specific guild already has an item with this name
            where: {guildId: guildId, name: item.name},

            // If it doesn't exist, it creates it using the data from config.json
            defaults: {
                guildId: guildId,
                itemId: item.itemId,
                name: item.name,
                price: item.price,
                description: item.description,
                roleId: item.roleId || null,
                durationDays: item.durationDays || null, // 👇 Add this
                stock: item.stock
            }
        });
    }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const PAGE_SIZE = 10;
    let currentPage = 1;

    // 👇 1. Get the total number of players to calculate max pages
    const actualCount = await EconomyProfile.count({ where: { guildId: interaction.guildId! } });
    const totalProfiles = Math.min(actualCount, 100);
    if (totalProfiles === 0) {
        return interaction.editReply("📉 The economy is completely empty. Nobody has any money yet!");
    }
    const maxPage = Math.ceil(totalProfiles / PAGE_SIZE);

    // 👇 2. Helper function to fetch and format a specific page
    const generatePage = async (page: number) => {
        const offset = (page - 1) * PAGE_SIZE;

        const topProfiles = await EconomyProfile.findAll({
            where: { guildId: interaction.guildId! },
            attributes: {
                include: [
                    [Sequelize.literal('(RANK() OVER (ORDER BY balance DESC))'), 'rank']
                ]
            },
            order: [['balance', 'DESC']],
            limit: PAGE_SIZE,
            offset: offset
        });
        // Instead of waiting for User 1, then User 2, we use Promise.all to fetch all 20 concurrently.
        const formatPromises = topProfiles.map(async (profile) => {
            // Extract the rank that the database calculated for us
            const rank = profile.get('rank') as number;

            let username = "Unknown User";
            try {
                const user = await interaction.client.users.fetch(profile.userId);
                username = user.username;
            } catch {
                username = "*Departed User*";
            }

            let rankEmoji = "🔹";
            if (rank === 1) rankEmoji = "🥇";
            else if (rank === 2) rankEmoji = "🥈";
            else if (rank === 3) rankEmoji = "🥉";
            else rankEmoji = `**#${rank}**`;

            return `${rankEmoji} ${username} — **$${profile.balance}**`;
        });

        // Wait for all 20 formatting promises to finish, then join them with newlines
        const descriptionLines = await Promise.all(formatPromises);
        const description = descriptionLines.join("\n") || "No players found.";

        return new EmbedBuilder()
            .setTitle("🏆 Economy Leaderboard")
            .setDescription(description)
            .setColor(0xFFD700)
            .setFooter({ text: `Page ${page} of ${maxPage} | Total Players: ${totalProfiles}` });
    };

    // 👇 3. Helper function to generate the Prev/Next buttons
    const generateButtons = (page: number) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 1), // Disabled on page 1
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === maxPage) // Disabled on the last page
        );
        return row;
    };

    // 👇 4. Send the first page
    const initialEmbed = await generatePage(currentPage);

    // Only show buttons if there is more than 1 page
    const components = maxPage > 1 ? [generateButtons(currentPage)] : [];

    const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: components
    });

    if (maxPage <= 1) return; // Exit early if no pagination is needed

    // 👇 5. Create the Button Collector
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // Buttons stay active for 60 seconds
    });

    collector.on("collect", async (i) => {
        // Security check: Only the person who ran the command can click the buttons
        await i.deferUpdate();
        if (i.customId === 'prev_page') currentPage--;
        if (i.customId === 'next_page') currentPage++;

        const newEmbed = await generatePage(currentPage);
        const newButtons = generateButtons(currentPage);

        // Instantly update the message with the new page
        await i.editReply({
            embeds: [newEmbed],
            components: [newButtons]
        });
    });

    collector.on("end", async () => {
        // When the 60 seconds are up, disable the buttons so they don't sit there active forever
        const disabledRow = generateButtons(currentPage);
        disabledRow.components.forEach(c => c.setDisabled(true));

        await interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
}