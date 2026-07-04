import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    GuildMember,
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
import { format } from "~/util/base";
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
const STARTING_BALANCE = 10;

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
                            .addIntegerOption(option =>
                                option.setName("seconds")
                                    .setDescription("How many seconds should the table stay open? (Default: 60)")
                                    .setRequired(false)
                                    .setMinValue(15)
                                    .setMaxValue(1800)
                            )
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
                const hasBypassRole = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
                    interaction.member.roles.cache.has(roleId)
                );
                const isExplicitAdmin = interaction.inCachedGuild() && interaction.member.permissions.has("Administrator");

                if (!hasBypassRole && !isExplicitAdmin && !config.economy.gambleChannel.includes(interaction.channelId)) {
                    const allowedList = config.economy.gambleChannel.map((id: string) => `<#${id}>`).join(", ");

                    return interaction.reply({
                        content: `❌ Gambling commands can only be used in ${allowedList}`,
                        ephemeral: true
                    });
                }

                switch (sub) {
                    case "coinflip":
                        return await handleGambleCoinflip(interaction);
                    case "dice":
                        return await handleGambleDice(interaction);
                    case "roulette":
                        return await handleGambleRoulette(interaction);
                }
                return;

            case null:
            default:
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
    const targetUser = interaction.options.getUser("user") || interaction.user;

    const balance = (await EconomyProfile.findOne({
        where: {
            guildId: interaction.guildId!,
            userId: targetUser.id
        }
    }))?.balance ?? STARTING_BALANCE;

    await interaction.reply({
        content: `💰 <@${targetUser.id}> currently has **$${balance}**.`,
        ephemeral: true
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

    if (item.stock > 0) {
        item.stock -= 1;
        await item.save();
    }
    profile.balance -= item.price;
    if (item.roleId) {
        if (interaction.member instanceof GuildMember) {
            try {
                if (item.durationDays) {
                    const timeToAdd = item.durationDays * 24 * 60 * 60 * 1000;

                    let tempRole = await TempRole.findOne({
                        where: { guildId: interaction.guildId!, userId: interaction.user.id, roleId: item.roleId }
                    });

                    if (tempRole) {
                        tempRole.expiresAt = new Date(tempRole.expiresAt.getTime() + timeToAdd);
                        await tempRole.save();
                    } else {
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

    const allShopItems = await ShopItem.findAll({
        where: { guildId: interaction.guildId! }
    });

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
    const isStaff = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
        interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff) {
        return interaction.reply({
            content: "❌ You do not have a required staff role to use this command.",
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (amount <= 0 || amount > 1000000) {
        return interaction.reply({
            content: "❌ Please use an integer smaller than or equal to 1,000,000 and bigger than 0",
            ephemeral: true
        });
    }

    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: targetUser.id },
        defaults: { guildId: interaction.guildId!, userId: targetUser.id, balance: 100 }
    });

    profile.balance += amount;
    await profile.save();

    const formattedAmount = format(config.economy.currencyFormat, amount);
    const formattedBalance = format(config.economy.currencyFormat, profile.balance);

    const replyMessage = format(
        config.economy.addMoney,
        formattedAmount,
        targetUser.username,
        formattedBalance,
        config.economy.coinEmoji
    );

    await interaction.reply(replyMessage);
}

async function handleSetBalance(interaction: ChatInputCommandInteraction) {
    const isStaff = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
        interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff) {
        return interaction.reply({
            content: "❌ You do not have a required staff role to use this command.",
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (amount < 0 || amount > 2_000_000_000) {
        return interaction.reply({ content: "❌ Invalid amount range (0 to 2B).", ephemeral: true });
    }

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
    const isStaff = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
        interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff) {
        return interaction.reply({
            content: "❌ You do not have a required staff role to use this command.",
            ephemeral: true
        });
    }

    const itemId = interaction.options.getString("id", true).toLowerCase();
    const name = interaction.options.getString("name", true);
    const price = interaction.options.getInteger("price", true);
    const description = interaction.options.getString("description", true);
    const role = interaction.options.getRole("role", false);
    const stock = interaction.options.getInteger("stock") ?? -1;

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
            stock: stock
        }
    });

    if (!created) {
        return interaction.reply({ content: `❌ An item with the ID \`${itemId}\` already exists!`, ephemeral: true });
    }

    const stockMsg = stock === -1 ? "Infinite" : stock.toString();
    await interaction.reply({ content: `✅ Created new shop item: **${name}** for \`$${price}\` (Stock: ${stockMsg}).` });
}

async function handleRemoveShopItem(interaction: ChatInputCommandInteraction) {
    const isStaff = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
        interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff) {
        return interaction.reply({
            content: "❌ You do not have a required staff role to use this command.",
            ephemeral: true
        });
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

interface RouletteBet {
    userId: string;
    username: string;
    amount: number;
    betType: "red" | "black" | "even" | "odd";
}

async function handleGambleRoulette(interaction: ChatInputCommandInteraction) {
    // ⏱️ Defer here directly since roulette takes time to process threads and is a public game
    await interaction.deferReply();

    const customSeconds = interaction.options.getInteger("seconds") || 60;
    const timeMs = customSeconds * 1000;

    const initialReply = await interaction.editReply({
        content: `🎰 **${interaction.user.username}** opened a Roulette Table for **${customSeconds} seconds**! Join the thread below to place your bets.`
    });

    const thread = await initialReply.startThread({
        name: `🎰 Roulette Table - ${interaction.user.username}`,
        autoArchiveDuration: 60,
        reason: "Roulette Game Room"
    });

    const bets: RouletteBet[] = [];

    await thread.send(
        `🎡 **Roulette Table Opened!** (Closes in ${customSeconds} seconds)\n\n` +
        `To enter, type your bet choice followed by your amount. **Example: \`red 250\`**\n` +
        `• \`red <amount>\` (2x payout)\n` +
        `• \`black <amount>\` (2x payout)\n` +
        `• \`even <amount>\` (2x payout)\n` +
        `• \`odd <amount>\` (2x payout)\n\n` +
        `👍 _The bot will react with ✅ if your bet is accepted, or ❌ if something is wrong._\n` +
        `👑 **<@${interaction.user.id}>**, type \`spin\` when everyone is ready!`
    );

    const collector = thread.createMessageCollector({
        filter: (m) => !m.author.bot,
        time: timeMs
    });

    collector.on("collect", async (message) => {
        const args = message.content.trim().toLowerCase().split(/\s+/);
        const commandOrType = args[0];

        if (commandOrType === "spin") {
            if (message.author.id !== interaction.user.id) {
                return void await message.react("❌");
            }
            if (bets.length === 0) {
                return void await message.react("❌");
            }

            collector.stop("spun");
            return;
        }

        const validBetTypes = ["red", "black", "even", "odd"];
        if (validBetTypes.includes(commandOrType)) {
            const amountStr = args[1];

            if (!amountStr) return void await message.react("❌");

            const amount = parseInt(amountStr, 10);
            if (isNaN(amount) || amount <= 0) return void await message.react("❌");

            const [profile] = await EconomyProfile.findOrCreate({
                where: { guildId: interaction.guildId!, userId: message.author.id },
                defaults: { guildId: interaction.guildId!, userId: message.author.id, balance: STARTING_BALANCE }
            });

            if (profile.balance < amount) return void await message.react("❌");

            profile.balance -= amount;
            await profile.save();

            bets.push({
                userId: message.author.id,
                username: message.author.username,
                amount: amount,
                betType: commandOrType as any
            });

            await message.react("✅");
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason !== "spun") {
            await thread.send("⏰ Table closed automatically due to inactivity.");
            for (const bet of bets) {
                const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: bet.userId } });
                if (profile) {
                    profile.balance += bet.amount;
                    await profile.save();
                }
            }
            await thread.setLocked(true);
            await thread.setArchived(true);
            return;
        }

        const winningNumber = Math.floor(Math.random() * 37);
        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

        let color: "green" | "red" | "black" = "green";
        if (winningNumber > 0) {
            color = redNumbers.includes(winningNumber) ? "red" : "black";
        }

        const isEven = winningNumber > 0 && winningNumber % 2 === 0;
        const isOdd = winningNumber > 0 && winningNumber % 2 !== 0;

        await thread.send("✨ *The wheel is spinning...* ✨");

        const userBreakdowns = new Map<string, string[]>();
        const userNetTotals = new Map<string, number>();

        for (const bet of bets) {
            let won = false;

            if (bet.betType === "red" && color === "red") won = true;
            if (bet.betType === "black" && color === "black") won = true;
            if (bet.betType === "even" && isEven) won = true;
            if (bet.betType === "odd" && isOdd) won = true;

            const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: bet.userId } });

            const currentNet = userNetTotals.get(bet.userId) ?? 0;
            if (!userBreakdowns.has(bet.userId)) {
                userBreakdowns.set(bet.userId, []);
            }

            const formattedBetAmount = format(config.economy.currencyFormat, bet.amount);

            if (won && profile) {
                const winnings = bet.amount * 2;
                profile.balance += winnings;
                await profile.save();

                const formattedWinnings = format(config.economy.currencyFormat, winnings);
                userBreakdowns.get(bet.userId)!.push(`${bet.betType}: Won ${formattedWinnings}`);
                userNetTotals.set(bet.userId, currentNet + bet.amount);
            } else {
                userBreakdowns.get(bet.userId)!.push(`${bet.betType}: Lost ${formattedBetAmount}`);
                userNetTotals.set(bet.userId, currentNet - bet.amount);
            }
        }

        const emoji = color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢";
        let outputMessage = `🏁 **The wheel landed on ${winningNumber} ${color.toUpperCase()} ${emoji} !**\n\n`;

        for (const [userId, breakdownArray] of userBreakdowns.entries()) {
            const member = await thread.guild.members.fetch(userId).catch(() => null);
            const displayName = member ? member.displayName : `User(${userId})`;

            const netValue = userNetTotals.get(userId) ?? 0;
            let netStatus = "Broke Even!";

            if (netValue > 0) {
                netStatus = `Won Net ${format(config.economy.currencyFormat, netValue)}!`;
            } else if (netValue < 0) {
                netStatus = `Lost Net ${format(config.economy.currencyFormat, Math.abs(netValue))}!`;
            }

            const betHistoryStr = breakdownArray.join(" ");
            outputMessage += `**${displayName}**: ${betHistoryStr} | **${netStatus}**\n`;
        }

        await thread.send(outputMessage);
        await thread.setLocked(true);
        await thread.setArchived(true);
    });
}

async function seedDefaultShopItems(guildId: string) {
    for (const item of config.economy.shopItems) {
        await ShopItem.findOrCreate({
            where: {guildId: guildId, name: item.name},
            defaults: {
                guildId: guildId,
                itemId: item.itemId,
                name: item.name,
                price: item.price,
                description: item.description,
                roleId: item.roleId || null,
                durationDays: item.durationDays || null,
                stock: item.stock
            }
        });
    }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
    // ⏱️ Defer explicitly here as ephemeral since leaderboard is highly customized
    await interaction.deferReply({ ephemeral: true });

    const PAGE_SIZE = 10;
    let currentPage = 1;

    const actualCount = await EconomyProfile.count({ where: { guildId: interaction.guildId! } });
    const totalProfiles = Math.min(actualCount, 100);
    if (totalProfiles === 0) {
        return interaction.editReply("📉 The economy is completely empty. Nobody has any money yet!");
    }
    const maxPage = Math.ceil(totalProfiles / PAGE_SIZE);

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

        const descriptionLines = topProfiles.map((profile) => {
            const rank = profile.get('rank') as number;
            const userMention = `<@${profile.userId}>`;

            let rankEmoji = "🔹";
            if (rank === 1) rankEmoji = "🥇";
            else if (rank === 2) rankEmoji = "🥈";
            else if (rank === 3) rankEmoji = "🥉";
            else rankEmoji = `**#${rank}**`;

            return `${rankEmoji} ${userMention} — **$${profile.balance}**`;
        });
        const description = descriptionLines.join("\n") || "No players found.";

        return new EmbedBuilder()
            .setTitle("🏆 Economy Leaderboard")
            .setDescription(description)
            .setColor(0xFFD700)
            .setFooter({ text: `Page ${page} of ${maxPage} | Total Players: ${totalProfiles}` });
    };

    const generateButtons = (page: number) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === maxPage)
        );
        return row;
    };

    const initialEmbed = await generatePage(currentPage);
    const components = maxPage > 1 ? [generateButtons(currentPage)] : [];

    const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: components
    });

    if (maxPage <= 1) return;

    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
    });

    collector.on("collect", async (i) => {
        await i.deferUpdate();
        if (i.customId === 'prev_page') currentPage--;
        if (i.customId === 'next_page') currentPage++;

        const newEmbed = await generatePage(currentPage);
        const newButtons = generateButtons(currentPage);

        await i.editReply({
            embeds: [newEmbed],
            components: [newButtons]
        });
    });

    collector.on("end", async () => {
        const disabledRow = generateButtons(currentPage);
        disabledRow.components.forEach(c => c.setDisabled(true));

        await interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
}