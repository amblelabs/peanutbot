import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    Message,
    type TextChannel,
    ComponentType,
    ButtonStyle,
    ButtonBuilder,
    ActionRowBuilder,
    MessageFlags
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
    declare lastWageClaim: CreationOptional<Date | null>;
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
    declare useMessage: CreationOptional<string | null>;
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
const WAGE_AMOUNT = 50;
const WAGE_COOLDOWN_HOURS = 24;

export default {
    data: { name: "economy" },

    setup: async (ctx) => {
        EconomyProfile.init(
            {
                guildId: { type: DataTypes.STRING, primaryKey: true },
                userId: { type: DataTypes.STRING, primaryKey: true },
                balance: { type: DataTypes.INTEGER, defaultValue: STARTING_BALANCE },
                lastWageClaim: { type: DataTypes.DATE, allowNull: true },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE,
            },
            { sequelize: ctx.sql },
        );

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
                itemId: { type: DataTypes.STRING, primaryKey: true },
                name: { type: DataTypes.STRING, allowNull: false },
                description: { type: DataTypes.STRING, allowNull: false },
                price: { type: DataTypes.INTEGER, allowNull: false },
                roleId: { type: DataTypes.STRING, allowNull: true },
                stock: { type: DataTypes.INTEGER, defaultValue: -1 },
                durationDays: { type: DataTypes.INTEGER, allowNull: true },
                useMessage: { type: DataTypes.STRING, allowNull: true },
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

        EconomyProfile.hasMany(Inventory, { foreignKey: "userId", sourceKey: "userId", onDelete: "CASCADE" });
        Inventory.belongsTo(EconomyProfile, { foreignKey: "userId", targetKey: "userId" });

        await ctx.sql.sync();

        const guilds = ctx.client.guilds.cache;
        for (const [guildId, guild] of guilds) {
            await seedDefaultShopItems(guildId);
        }
        setInterval(async () => {
            try {
                const now = new Date();
                const expiredPasses = await TempRole.findAll({
                    where: { expiresAt: { [Op.lte]: now } }
                });

                for (const record of expiredPasses) {
                    const guild = ctx.client.guilds.cache.get(record.guildId);
                    if (guild) {
                        const member = await guild.members.fetch(record.userId).catch(() => null);
                        if (member && member.roles.cache.has(record.roleId)) {
                            await member.roles.remove(record.roleId, "🕒 Temporary shop item duration expired.");
                        }
                    }
                    await record.destroy(); // Purge record from DB
                }
            } catch (err) {
                console.error("[Sweeper Worker Error]:", err);
            }
        }, 3600000);
    },

    slash: (builder) => {
        return builder
            .setName("economy")
            .setDescription("Manage your pocket change and inventory")
            .addSubcommand((sub) =>
                sub
                    .setName("balance")
                    .setDescription("Check your current balance or another user's balance")
                    .addUserOption((opt) => opt.setName("user").setDescription("The user to check").setRequired(false)),
            )
            .addSubcommand(sub => sub.setName("wage").setDescription("Collect your regular salary!"))
            .addSubcommand(sub => sub.setName("leaderboard").setDescription("View the leaderboard"))
            .addSubcommand((sub) => sub.setName("shop").setDescription("View available items for purchase"))
            .addSubcommand((sub) =>
                sub
                    .setName("buy")
                    .setDescription("Purchase an item from the shop")
                    .addStringOption((opt) => opt.setName("item").setDescription("The ID of the item you want to buy (e.g. 'vip_role')").setRequired(true))
                    .addIntegerOption((opt) => opt.setName("quantity").setDescription("How many to buy?").setMinValue(1))
            )
            .addSubcommand((sub) =>
                sub
                    .setName("use")
                    .setDescription("Use a consumable item from your inventory")
                    .addStringOption((opt) => opt.setName("item").setDescription("The ID of the item you want to use").setRequired(true))
                   )
            .addSubcommand((sub) => sub.setName("inventory").setDescription("View items you currently own"))
            .addSubcommand((sub) =>
                sub
                    .setName("add-money")
                    .setDescription("Add money to a user's balance (Admin/Staff Only)")
                    .addUserOption((opt) => opt.setName("user").setDescription("The user receiving the money").setRequired(true))
                    .addIntegerOption((opt) => opt.setName("amount").setDescription("The amount of money to add").setRequired(true)),
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
                    .setName("inflation")
                    .setDescription("Increase all shop prices by a percentage to combat wealth (Staff Only)")
                    .addNumberOption((opt) => opt.setName("percentage").setDescription("Percentage to increase (e.g. 10 for 10%)").setRequired(true))
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

        const EPHEMERAL_MAPPING: Record<string, boolean> = {
            "balance": true,
            "wage": true,
            "leaderboard": true,
            "inventory": true,
            "buy": false,
            "add-money": true,
            "set-balance": true,
            "inflation": true,

            // Set these to false so they are wide open to the public channel
            "shop": false,
            "coinflip": false,
            "dice": false,
            "roulette": false,
            "use": false,
        };

        const sub = interaction.options.getSubcommand(true); // Changed to true because a subcommand is guaranteed
        const group = interaction.options.getSubcommandGroup(false);

        // 1. FAST SYNC CHECK: Check gambling permissions BEFORE deferring anything
        if (group === "gamble") {
            const hasBypassRole = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
                interaction.member.roles.cache.has(roleId)
            );
            const isExplicitAdmin = interaction.inCachedGuild() && interaction.member.permissions.has("Administrator");

            if (!hasBypassRole && !isExplicitAdmin && !config.economy.gambleChannel.includes(interaction.channelId)) {
                const allowedList = config.economy.gambleChannel.map((id: string) => `<#${id}>`).join(", ");
                return void await interaction.reply({
                    content: `❌ Gambling commands can only be used in ${allowedList}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // 2. INDIVIDUAL VISIBILITY LOOKUP: Safely uses the guaranteed sub string
        const isEphemeral = EPHEMERAL_MAPPING[sub] ?? false;

        // 3. SAFE DEFER: Instantly secure the connection before any heavy logic
        await interaction.deferReply({
            flags: isEphemeral ? MessageFlags.Ephemeral : undefined
        });

        // 4. ROUTE SAFELY TO HANDLERS
        switch (group) {
            case "gamble": {
                switch (sub) {
                    case "coinflip": return await handleGambleCoinflip(interaction);
                    case "dice": return await handleGambleDice(interaction);
                    case "roulette": return await handleGambleRoulette(interaction);
                }
                return;
            }

            case null:
            default: {
                switch (sub) {
                    case "wage": return await handleWage(interaction);
                    case "inflation": return await handleInflation(interaction);
                    case "leaderboard": return await handleLeaderboard(interaction);
                    case "balance": return await handleBalance(interaction);
                    case "shop": return await handleShop(interaction);
                    case "buy": return await handleBuy(interaction);
                    case "use": return await handleUse(interaction);
                    case "inventory": return await handleInventory(interaction);
                    case "add-money": return await handleAddMoney(interaction);
                    case "set-balance": return await handleSetBalance(interaction);
                }
                return;
            }
        }
    },
} as Cmd;

// ── UTILITY ──────────────────────────────────────────────────────────────

async function hasSufficientFunds(
    interaction: ChatInputCommandInteraction,
    currentBalance: number,
    amountNeeded: number,
    customErrorMessage?: string
): Promise<boolean> {
    if (currentBalance < amountNeeded) {
        const msg = customErrorMessage || format(config.economy.cantAfford, {userBalance: currentBalance});
        await interaction.editReply({ content: msg });
        return false;
    }
    return true;
}

/**
 * Checks if the user has a required staff role. If not, it replies with an error and returns false.
 */
async function hasStaffPermission(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const isStaff = interaction.inCachedGuild() && config.economy.teamRole.some((roleId: string) =>
        interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff) {
        await interaction.editReply({ content: config.economy.isntStaff });
        return false;
    }

    return true;
}
// ── SUBCOMMAND HANDLERS ──────────────────────────────────────────────────

async function handleWage(interaction: ChatInputCommandInteraction) {
    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const now = new Date();

    if (profile && profile.lastWageClaim) {
        const diffMs = now.getTime() - profile.lastWageClaim.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < WAGE_COOLDOWN_HOURS) {
            const remainingHours = Math.ceil(WAGE_COOLDOWN_HOURS - diffHours);
            return void await interaction.editReply({
                content: `⏳ You have already collected your wage recently! Come back in **${remainingHours} hours**.`
            });
        }
    }

    if (!profile) {
        profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: interaction.user.id, balance: STARTING_BALANCE });
    }

    profile.balance += WAGE_AMOUNT;
    profile.lastWageClaim = now;
    await profile.save();

    await interaction.editReply({
        content: `💵 You clocked in and collected your wage of **$${WAGE_AMOUNT}**! Your new balance is **$${profile.balance}**.`
    });
}

async function handleInflation(interaction: ChatInputCommandInteraction) {
    if (!(await hasStaffPermission(interaction))) return;

    const percentage = interaction.options.getNumber("percentage", true);

    if (percentage <= 0) {
        return void await interaction.editReply({ content: "❌ Please provide a percentage greater than 0." });
    }

    const items = await ShopItem.findAll({ where: { guildId: interaction.guildId! } });

    if (items.length === 0) {
        return void await interaction.editReply({ content: "❌ There are no items in the shop to inflate." });
    }

    const multiplier = 1 + (percentage / 100);

    for (const item of items) {
        item.price = Math.round(item.price * multiplier);
        await item.save();
    }

    await interaction.editReply({
        content: `📈 **Inflation Applied!** All shop items have been increased in price by **${percentage}%**.`
    });
}

async function handleBalance(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user") || interaction.user;

    const balance = (await EconomyProfile.findOne({
        where: { guildId: interaction.guildId!, userId: targetUser.id }
    }))?.balance ?? STARTING_BALANCE;

    await interaction.editReply({ content: format(config.economy.balanceMessage,{
            emoji: config.economy.coinEmoji,
            targetUser:targetUser.id,
            balance:balance
        })
    });
}

async function handleShop(interaction: ChatInputCommandInteraction) {
    const items = await ShopItem.findAll({ where: { guildId: interaction.guildId! } });
    const embed = new EmbedBuilder()
        .setTitle("🛒 The Server Shop")
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

    await interaction.editReply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
    const itemKey = interaction.options.getString("item", true).toLowerCase();
    // 1. Fetch the quantity option from the command (defaults to 1 if empty)
    const quantity = interaction.options.getInteger("quantity") ?? 1;

    const item = await ShopItem.findOne({ where: { guildId: interaction.guildId!, itemId: itemKey } });
    if (!item) return void await interaction.editReply({ content: config.economy.shop.notItem });

    // 2. Check if the shop has enough stock for the requested quantity
    if (item.stock !== -1 && item.stock < quantity) {
        if (item.stock === 0) {
            return void await interaction.editReply({ content: format(config.economy.shop.soldOut, {name: item.name}) });
        }
        return void await interaction.editReply({ content: format(config.economy.shop.notEnough, {stock: item.stock} )});
    }

    // 3. Safeguard: Prevent ordering multiples of items that immediately grant roles
    if (item.roleId && quantity > 1) {
        return void await interaction.editReply({ content: config.economy.shop.notMultiple });
    }

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const currentBalance = profile?.balance ?? STARTING_BALANCE;

    // 4. Calculate total cost for the order
    const totalCost = item.price * quantity;

    const shopErrorMessage = format(config.economy.shop.cantAfford,{
        name: quantity > 1 ? `${quantity}x ${item.name}` : item.name,
        price: totalCost,
        balance: currentBalance,
    });
    if (!(await hasSufficientFunds(interaction, currentBalance, totalCost, shopErrorMessage))) return;

    if (!profile) {
        profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: interaction.user.id, balance: STARTING_BALANCE });
    }

    let roleGrantedMessage = "";

    // 5. Apply the correct stock deductions
    if (item.stock > 0) {
        item.stock -= quantity;
        await item.save();
    }
    profile.balance -= totalCost;

    // 6. Role Assignment Logic (Safe because quantity is guaranteed to be 1 here)
    if (item.roleId && interaction.member instanceof GuildMember) {
        try {
            if (item.durationDays) {
                const timeToAdd = item.durationDays * 24 * 60 * 60 * 1000;
                let tempRole = await TempRole.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id, roleId: item.roleId } });

                if (tempRole) {
                    tempRole.expiresAt = new Date(tempRole.expiresAt.getTime() + timeToAdd);
                    await tempRole.save();
                } else {
                    await TempRole.create({
                        guildId: interaction.guildId!, userId: interaction.user.id,
                        roleId: item.roleId, expiresAt: new Date(Date.now() + timeToAdd)
                    });
                }

                await interaction.member.roles.add(item.roleId, `Purchased ${item.durationDays} day pass.`);
                roleGrantedMessage = format(config.economy.shop.tempRole, {roleId: item.roleId, durationDays: item.durationDays});

                // INSTANT REMOVAL TIMER
                const msRemaining = item.durationDays * 24 * 60 * 60 * 1000;
                const memberRef = interaction.member;
                const targetRoleId = item.roleId;
                const targetGuildId = interaction.guildId!;
                const targetUserId = interaction.user.id;

                setTimeout(async () => {
                    try {
                        const currentRecord = await TempRole.findOne({ where: { guildId: targetGuildId, userId: targetUserId, roleId: targetRoleId } });
                        if (currentRecord && currentRecord.expiresAt <= new Date()) {
                            if (memberRef.roles.cache.has(targetRoleId)) {
                                await memberRef.roles.remove(targetRoleId, "🕒 Temporary shop item duration expired.");
                            }
                            await currentRecord.destroy();
                        }
                    } catch (err) {
                        console.error("[Instant Timer Error] Failed to remove role:", err);
                    }
                }, msRemaining);

            } else {
                if (interaction.member.roles.cache.has(item.roleId)) {
                    return void await interaction.editReply({ content: config.economy.shop.permRoleOwned });
                }
                await interaction.member.roles.add(item.roleId, `Purchased permanent role.`);
                roleGrantedMessage = format(config.economy.shop.permaRole, {roleId: item.roleId});
            }
        } catch (error) {
            console.error("Failed to assign shop role:", error);
        }
    }

    await profile.save();

    // 7. Save the bulk amount into the inventory cleanly
    const [invItem, created] = await Inventory.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey, quantity: quantity }
    });

    if (!created) {
        invItem.quantity += quantity;
        await invItem.save();
    }

    // 8. Inform the user with total price breakdown
    await interaction.editReply({ content: format(config.economy.shop.successBuy, {
            name: quantity > 1 ? `${quantity}x ${item.name}` : item.name,
            price: totalCost,
            message: roleGrantedMessage,
            balance: profile.balance
        })
    });
}

async function handleInventory(interaction: ChatInputCommandInteraction) {
    const items = await Inventory.findAll({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    if (items.length === 0) return void await interaction.editReply({ content: config.economy.inv.empty });

    const allShopItems = await ShopItem.findAll({ where: { guildId: interaction.guildId! } });
    const itemManifest = Object.fromEntries(allShopItems.map((i) => [i.itemId, i.name]));

    const inventoryList = items.map((item) => {
        const visualName = itemManifest[item.itemKey] || `⚙️ Unknown Item (${item.itemKey})`;
        return `${visualName} x\`${item.quantity}\``;
    }).join("\n");

    const embed = new EmbedBuilder().setTitle(`🎒 ${interaction.user.username}'s Inventory`).setDescription(inventoryList).setColor(0x00ae86);
    await interaction.editReply({ embeds: [embed] });
}

async function handleUse(interaction: ChatInputCommandInteraction) {
    const itemKey = interaction.options.getString("item", true).toLowerCase();

    // 1. Check if the user actually owns the item
    const invItem = await Inventory.findOne({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey }
    });

    if (!invItem || invItem.quantity <= 0) {
        return void await interaction.editReply({
            content: format(config.economy.inv.lack, {item: itemKey})
        });
    }

    // 2. Fetch the item's data to get the custom useMessage
    const shopItem = await ShopItem.findOne({
        where: { guildId: interaction.guildId!, itemId: itemKey }
    });

    if (!shopItem) {
        return void await interaction.editReply({ content: config.economy.inv.nonexistent });
    }

    // 3. Check if it's actually a usable item
    if (!shopItem.useMessage) {
        return void await interaction.editReply({
            content: format(config.economy.inv.nonconsumable, {name: shopItem.name})
        });
    }

    // 4. Consume the item from their inventory
    invItem.quantity -= 1;
    if (invItem.quantity <= 0) {
        await invItem.destroy(); // Remove the row completely if they are out
    } else {
        await invItem.save(); // Otherwise just save the lowered quantity
    }

    // 5. Send the custom message!
    // (Bonus: We replace "{user}" so you can dynamically ping the user in the custom message!)
    const customReply = shopItem.useMessage.replace(/{user}/g, `<@${interaction.user.id}>`);

    await interaction.editReply({
        content: `📦 **<&${interaction.user.id}>** used a **${shopItem.name}**!\n\n${customReply}`
    });
}

async function handleAddMoney(interaction: ChatInputCommandInteraction) {
    if (!(await hasStaffPermission(interaction))) return;
    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (amount <= 0 || amount > 1000000000) return void await interaction.editReply({ content: config.economy.limit });

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: targetUser.id } });
    if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: targetUser.id, balance: STARTING_BALANCE });

    profile.balance += amount;
    await profile.save();

    // 👇 Changed to pass the named object to format()
    const formattedAmount = format(config.economy.currencyFormat, { amount: amount });
    const formattedBalance = format(config.economy.currencyFormat, { amount: profile.balance });
    const replyMessage = format(config.economy.addMoney, {
        emoji: config.economy.coinEmoji,
        added: formattedAmount,
        user: targetUser.username,
        newBalance: formattedBalance
    });

    await interaction.editReply({ content: replyMessage });
}

async function handleSetBalance(interaction: ChatInputCommandInteraction) {
    if (!(await hasStaffPermission(interaction))) return;
    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (amount < 0 || amount > 2_000_000_000) return void await interaction.editReply({ content: config.economy.setBalance.invalid });

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: targetUser.id } });
    if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: targetUser.id, balance: STARTING_BALANCE });

    profile.balance = amount;
    await profile.save();

    await interaction.editReply({ content: format(config.economy.setBalance.setTo, {username: targetUser.username, amount: amount}) });
}

async function handleGambleCoinflip(interaction: ChatInputCommandInteraction) {
    const betAmount = interaction.options.getInteger("amount", true);
    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const currentBalance = profile?.balance ?? STARTING_BALANCE;

    if (!(await hasSufficientFunds(interaction, currentBalance, betAmount))) return;

    if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: interaction.user.id, balance: STARTING_BALANCE });

    const isWinner = randomUtils.pickRandom([true, false]);

    if (isWinner) {
        profile.balance += betAmount;
        await profile.save();
        await interaction.editReply({ content: format(config.economy.betWin, {thing: "coin", betAmount: betAmount, emoji: config.economy.coinEmoji, balance: profile.balance, dice: ""}) });
    } else {
        profile.balance -= betAmount;
        await profile.save();
        await interaction.editReply({ content: format(config.economy.betLost, {dice: "", betAmount: betAmount, emoji: config.economy.coinEmoji, balance: profile.balance}) });
    }
}

async function handleGambleDice(interaction: ChatInputCommandInteraction) {
    const betAmount = interaction.options.getInteger("amount", true);
    const guess = interaction.options.getInteger("guess", true);

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const currentBalance = profile?.balance ?? STARTING_BALANCE;

    if (!(await hasSufficientFunds(interaction, currentBalance, betAmount))) return;

    if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: interaction.user.id, balance: STARTING_BALANCE });

    const diceRoll = randomUtils.getRandomIntInclusive(1, 6);

    if (guess === diceRoll) {
        const winnings = betAmount * 5;
        profile.balance += winnings;
        await profile.save();
        await interaction.editReply({ content: format(config.economy.betWin, {thing: "dice", betAmount: betAmount, emoji: config.economy.coinEmoji, balance: profile.balance, dice: `It rolled a ${diceRoll}`}) });
    } else {
        profile.balance -= betAmount;
        await profile.save();
        await interaction.editReply({ content: format(config.economy.betLost, {dice: `The dice rolled ${diceRoll} while you guessed ${guess}`, betAmount: betAmount, emoji: config.economy.coinEmoji, balance: profile.balance}) });
    }
}

interface RouletteBet {
    userId: string;
    username: string;
    amount: number;
    betType: "red" | "black" | "even" | "odd" | "number" | "green";
    betNumber?: number;
}

async function handleGambleRoulette(interaction: ChatInputCommandInteraction) {
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
        `• \`0-36 <amount>\` (8x payout)\n` +
        `• \`green <amount>\` (8x payout) 🟢\n` + // 👈 Added to instructions
        `• \`red <amount>\` (2x payout) 🔴\n` +
        `• \`black <amount>\` (2x payout) ⚫\n` +
        `• \`even <amount>\` (2x payout)\n` +
        `• \`odd <amount>\` (2x payout)\n\n` +
        `👍 _The bot will react with ✅ if your bet is accepted, or ❌ if something is wrong._\n` +
        `👑 **<@${interaction.user.id}>**, type \`spin\` when everyone is ready!`
    );

    const collector = thread.createMessageCollector({ filter: (m) => !m.author.bot, time: timeMs });

    collector.on("collect", async (message) => {
        const args = message.content.trim().toLowerCase().split(/\s+/);
        const commandOrType = args[0];

        if (commandOrType === "spin") {
            if (message.author.id !== interaction.user.id) return void await message.react("❌");
            if (bets.length === 0) return void await message.react("❌");
            collector.stop("spun");
            return;
        }

        // 👈 Added "green" to the allowed string types here
        const validBetTypes = ["red", "black", "even", "odd", "green"];
        const parsedNumber = parseInt(commandOrType, 10);
        const isNumberBet = !isNaN(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 36;

        if (validBetTypes.includes(commandOrType) || isNumberBet) {
            const amountStr = args[1];
            if (!amountStr) return void await message.react("❌");

            const amount = parseInt(amountStr, 10);
            if (isNaN(amount) || amount <= 0) return void await message.react("❌");

            let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: message.author.id } });
            const currentBalance = profile?.balance ?? STARTING_BALANCE;

            if (currentBalance < amount) return void await message.react("❌");

            if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: message.author.id, balance: STARTING_BALANCE });

            profile.balance -= amount;
            await profile.save();

            bets.push({
                userId: message.author.id,
                username: message.author.username,
                amount: amount,
                betType: isNumberBet ? "number" : (commandOrType as any),
                betNumber: isNumberBet ? parsedNumber : undefined
            });
            await message.react("✅");
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason !== "spun") {
            await thread.send("⏰ Table closed automatically due to inactivity.");
            for (const bet of bets) {
                const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: bet.userId } });
                if (profile) { profile.balance += bet.amount; await profile.save(); }
            }
            await thread.setLocked(true);
            await thread.setArchived(true);
            return;
        }

        const winningNumber = Math.floor(Math.random() * 37);
        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        let color: "green" | "red" | "black" = "green";
        if (winningNumber > 0) color = redNumbers.includes(winningNumber) ? "red" : "black";

        const isEven = winningNumber > 0 && winningNumber % 2 === 0;
        const isOdd = winningNumber > 0 && winningNumber % 2 !== 0;

        await thread.send("✨ *The wheel is spinning...* ✨");

        const userBreakdowns = new Map<string, string[]>();
        const userNetTotals = new Map<string, number>();

        for (const bet of bets) {
            let won = bet.betType === color || (bet.betType === "even" && isEven) || (bet.betType === "odd" && isOdd) || bet.betNumber === winningNumber;

            // 👈 Update payout check so BOTH number bets and explicit "green" bets reward 36x payout
            let payoutMultiplier = (bet.betType === "number" || bet.betType === "green") ? 36 : 2;
            let betDisplay = bet.betType === "number" ? `Number ${bet.betNumber}` : bet.betType;

            const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: bet.userId } });
            const currentNet = userNetTotals.get(bet.userId) ?? 0;
            if (!userBreakdowns.has(bet.userId)) userBreakdowns.set(bet.userId, []);

            const formattedBetAmount = format(config.economy.currencyFormat, { amount: bet.amount });

            if (won && profile) {
                const winnings = bet.amount * payoutMultiplier;
                profile.balance += winnings;
                await profile.save();
                const formattedWinnings = format(config.economy.currencyFormat, { amount: winnings });
                userBreakdowns.get(bet.userId)!.push(`${betDisplay}: Won ${formattedWinnings}`);
                userNetTotals.set(bet.userId, currentNet + (winnings - bet.amount));
            } else {
                userBreakdowns.get(bet.userId)!.push(`${betDisplay}: Lost ${formattedBetAmount}`);
                userNetTotals.set(bet.userId, currentNet - bet.amount);
            }
        }

        const emoji = color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢";
        let outputMessage = `🏁 **The wheel landed on ${winningNumber} ${color.toUpperCase()} ${emoji} !**\n\n`;

        for (const [userId, breakdownArray] of userBreakdowns.entries()) {
            const userMention = `<@${userId}>`;
            const netValue = userNetTotals.get(userId) ?? 0;
            let netStatus = "Broke Even!";

            if (netValue > 0) netStatus = `Won Net ${format(config.economy.currencyFormat, { amount: netValue })}!`;
            else if (netValue < 0) netStatus = `Lost Net ${format(config.economy.currencyFormat, { amount: Math.abs(netValue) })}!`;

            outputMessage += `**${userMention}**:\n${breakdownArray.join("\n")} | **${netStatus}**\n`;
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
                useMessage: item.useMessage || null,
                stock: item.stock
            }
        });
    }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
    const PAGE_SIZE = 10;
    let currentPage = 1;

    const actualCount = await EconomyProfile.count({ where: { guildId: interaction.guildId! } });
    const totalProfiles = Math.min(actualCount, 100);
    if (totalProfiles === 0) return void await interaction.editReply("📉 The economy is completely empty. Nobody has any money yet!");
    const maxPage = Math.ceil(totalProfiles / PAGE_SIZE);

    const generatePage = async (page: number) => {
        const offset = (page - 1) * PAGE_SIZE;
        const topProfiles = await EconomyProfile.findAll({
            where: { guildId: interaction.guildId! },
            attributes: { include: [[Sequelize.literal('(RANK() OVER (ORDER BY balance DESC))'), 'rank']] },
            order: [['balance', 'DESC']], limit: PAGE_SIZE, offset: offset
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

        return new EmbedBuilder()
            .setTitle("🏆 Economy Leaderboard")
            .setDescription(descriptionLines.join("\n") || "No players found.")
            .setColor(0xFFD700)
            .setFooter({ text: `Page ${page} of ${maxPage} | Total Players: ${totalProfiles}` });
    };

    const generateButtons = (page: number) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        row.addComponents(
            new ButtonBuilder().setCustomId('economy:prev_page').setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
            new ButtonBuilder().setCustomId('economy:next_page').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(page === maxPage)
        );
        return row;
    };

    const initialEmbed = await generatePage(currentPage);
    const components = maxPage > 1 ? [generateButtons(currentPage)] : [];

    const message = await interaction.editReply({ embeds: [initialEmbed], components: components });
    if (maxPage <= 1) return;

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on("collect", async (i) => {
        await i.deferUpdate();
        if (i.customId === 'economy:prev_page') currentPage--;
        if (i.customId === 'economy:next_page') currentPage++;

        await i.editReply({ embeds: [await generatePage(currentPage)], components: [generateButtons(currentPage)] });
    });

    collector.on("end", async () => {
        const disabledRow = generateButtons(currentPage);
        disabledRow.components.forEach(c => c.setDisabled(true));
        await interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
}