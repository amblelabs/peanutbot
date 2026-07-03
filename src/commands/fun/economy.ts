import {EmbedBuilder, ChatInputCommandInteraction, GuildMember, Message, type TextChannel} from "discord.js";
import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";
import type { Cmd } from "~/util/base";
import randomUtils from "~/util/rnd";
// 1. Define the Shop Items
const SHOP_ITEMS = [
    { id: "cookie", name: "🍪 Cookie", price: 10, description: "A delicious chocolate chip cookie." },
    { id: "bronze_medal", name: "🥉 Bronze Medal", price: 150, description: "A basic medal to show off your presence." },
    { id: "gold_shield", name: "🛡️ Gold Shield", price: 500, description: "The ultimate flex of wealth and protection." },
    { id: "super_role", name: "👑 VIP Custom Role", price: 2500, description: "Redeemable for a unique colored role!", roleId: "1510652320432521327" }
];

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
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}
export default {
    data: { name: "economy" },

    setup: async (ctx) => {
        // Initialize Economy Profiles (Composite Primary Key of Guild + User)
        EconomyProfile.init(
            {
                guildId: { type: DataTypes.STRING, primaryKey: true },
                userId: { type: DataTypes.STRING, primaryKey: true },
                balance: { type: DataTypes.INTEGER, defaultValue: 10 },
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
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE,
            },
            { sequelize: ctx.sql }
        );

        // Establish relationships
        EconomyProfile.hasMany(Inventory, { foreignKey: "userId", sourceKey: "userId", onDelete: "CASCADE" });
        Inventory.belongsTo(EconomyProfile, { foreignKey: "userId", targetKey: "userId" });

        await ctx.sql.sync();
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
                        opt.setName("user").setDescription("The user to check").setRequired(true),
                    ),
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
                            .setDescription("The item you want to buy")
                            .setRequired(true)
                            .addChoices(
                                ...SHOP_ITEMS.map((item) => ({
                                    name: `${item.name} ($${item.price})`,
                                    value: item.id,
                                })),
                            ),
                    ),
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

        if (group === "gamble") {
            // Route gambling games
            if (sub === "coinflip") await handleGambleCoinflip(interaction);
            else if (sub === "dice") await handleGambleDice(interaction);
            else if (sub === "roulette") await handleGambleRoulette(interaction);
        }
        else if (sub === "balance") await handleBalance(interaction);
        else if (sub === "shop") await handleShop(interaction);
        else if (sub === "buy") await handleBuy(interaction);
        else if (sub === "inventory") await handleInventory(interaction);
        else if (sub === "add-money") await handleAddMoney(interaction);
        else if (sub === "set-balance") await handleSetBalance(interaction);
        else if (sub === "add-item") await handleAddShopItem(interaction);
        else if (sub === "remove-item") await handleRemoveShopItem(interaction);
    },
} as Cmd;

// ── SUBCOMMAND HANDLERS ──────────────────────────────────────────────────

async function handleBalance(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user") || interaction.user;

    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: targetUser.id },
        defaults: { guildId: interaction.guildId!, userId: targetUser.id, balance: 100 }
    });

    const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Vault`)
        .setDescription(`💵 **Balance:** \`$${profile.balance}\``)
        .setColor(0x00ae86)
        .setThumbnail(targetUser.displayAvatarURL());

    await interaction.reply({ embeds: [embed] });
}


async function handleShop(interaction: ChatInputCommandInteraction) {
    const items = await ShopItem.findAll({ where: { guildId: interaction.guildId! } });

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
    const itemKey = interaction.options.getString("item_id", true).toLowerCase();

    // 👇 Fetch the specific item from the database
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

    // ─── ADD THE ROLE LOGIC HERE ────────────────────────────────────────

    let roleGrantedMessage = "";

    // Check if this item is configured to give a role
    if (item.roleId) {
        if (interaction.member instanceof GuildMember) {
            try {
                // Check if they already have the role so they don't waste money
                if (interaction.member.roles.cache.has(item.roleId)) {
                    return interaction.reply({
                        content: `❌ You already have the role granted by this item!`,
                        ephemeral: true
                    });
                }

                // Give them the role
                await interaction.member.roles.add(item.roleId, `Purchased ${item.name} from the shop.`);
                roleGrantedMessage = ` and granted you the <@&${item.roleId}> role`;
            } catch (error) {
                // If the bot's role is lower than the target role, this will fail
                console.error("Failed to assign shop role:", error);
                return interaction.reply({
                    content: `❌ Internal Error: I couldn't assign the role. Please make sure my bot role is positioned ABOVE the shop role in Server Settings.`,
                    ephemeral: true
                });
            }
        }
    }

    // ─── RESUME NORMAL INVENTORY & BALANCE SAVING ───────────────────────

    if (item.stock > 0) {
        item.stock -= 1;
        await item.save();
    }
    // Deduct money from account
    profile.balance -= item.price;
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

    // Map database entries to their descriptive shop names
    const itemManifest = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i.name]));

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
    if (interaction.member instanceof GuildMember && !interaction.member.roles.cache.has("1262624821582364703")) {
        return interaction.reply({
            content: "❌ You do not have the required staff role to grant currency.",
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    // Prevent staff from entering negative numbers to steal money
    if (amount <= 0) {
        return interaction.reply({
            content: "❌ Please specify an amount greater than 0.",
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
    if (interaction.member instanceof GuildMember && !interaction.member.roles.cache.has("1262624821582364703")) {
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
    if (interaction.member instanceof GuildMember && !interaction.member.roles.cache.has("1234")) {
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
    if (interaction.member instanceof GuildMember && !interaction.member.roles.cache.has("1262624821582364703")) {
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

async function handleGambleRoulette(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
        content: "🎡 **MULTIPLAYER ROULETTE IS OPEN!**\n\n" +
            "**Anyone** can jump in! Valid bets: `red`, `black`, `even`, `odd`, or a number `1` through `24`.\n" +
            "**How to bet:** Type your bet and amount (e.g., `red 50`, `14 100`).\n" +
            "**When ready:** Anyone can type `spin` to roll the wheel! (Auto-spins in 60s)."
    });

    // 👇 1. Update the state to track WHO made the bet
    const bets: { userId: string; username: string; type: string; amount: number }[] = [];

    // 👇 2. Change the filter to allow ANY human (ignore bots)
    const filter = (m: Message) => !m.author.bot;

    const channel = interaction.channel as TextChannel;
    const collector = channel.createMessageCollector({ filter, time: 60000 });

    collector.on("collect", async (m) => {
        const input = m.content.toLowerCase().trim();

        if (input === "spin") {
            collector.stop("user_spun");
            return;
        }

        const args = input.split(" ");
        if (args.length !== 2) return;

        const betType = args[0];
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) return;

        const validTextBets = ["red", "black", "even", "odd"];
        const betNumber = parseInt(betType);
        const isValidNumber = !isNaN(betNumber) && betNumber >= 1 && betNumber <= 24;

        if (!validTextBets.includes(betType) && !isValidNumber) return;

        // 👇 3. Fetch the profile of the person who TYPED the message (not just the host)
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

        // Save the bet with their user ID and username
        bets.push({ userId: m.author.id, username: m.author.username, type: betType, amount });
        m.react("✅").catch(() => null);
    });

    collector.on("end", async () => {
        if (bets.length === 0) {
            return interaction.followUp("⏳ The table closed because no bets were placed.");
        }

        await interaction.followUp("🎡 **NO MORE BETS!** Spinning the wheel...");

        const roll = randomUtils.getRandomIntInclusive(1, 24);
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23];
        const rollColor = redNumbers.includes(roll) ? "red" : "black";
        const rollParity = roll % 2 === 0 ? "even" : "odd";
        const colorEmoji = rollColor === "red" ? "🔴" : "⚫";

        // Track total winnings per user for a clean summary
        const playerResults: Record<string, { username: string, totalWon: number, summary: string }> = {};

        for (const bet of bets) {
            if (!playerResults[bet.userId]) {
                playerResults[bet.userId] = { username: bet.username, totalWon: 0, summary: "" };
            }

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

        // Process payouts and build the final message
        let finalMessage = `### The wheel landed on **${roll} ${rollColor.toUpperCase()}** ${colorEmoji}!\n\n`;

        for (const [userId, result] of Object.entries(playerResults)) {
            if (result.totalWon > 0) {
                const [profile] = await EconomyProfile.findOrCreate({
                    where: { guildId: interaction.guildId!, userId: userId }
                });

                profile.balance += result.totalWon;
                await profile.save();
            }

            finalMessage += `**${result.username}**:\n${result.summary}`;
            if (result.totalWon > 0) {
                finalMessage += `💰 *Total Payout: $${result.totalWon}*\n`;
            } else {
                finalMessage += `💸 *Bust!*\n`;
            }
            finalMessage += `\n`;
        }

        await interaction.followUp({ content: finalMessage });
    });
}