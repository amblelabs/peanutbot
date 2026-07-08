import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    AutocompleteInteraction,
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
import rnd from "~/util/rnd";
import config from "config.json";
import { randomInt } from "crypto";
import { paginate } from "../../util/paginator2.ts";

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
                    .addStringOption((opt) => opt.setName("item").setDescription("The ID of the item you want to buy (e.g. 'vip_role')").setRequired(true).setAutocomplete(true))
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
        if (interaction.isAutocomplete()) {
            if (!interaction.guildId) return void await interaction.respond([]);

            const sub = interaction.options.getSubcommand(false);
            if (sub === "buy") {
                const focusedValue = interaction.options.getFocused().toLowerCase();

                // Fetch the active shop products for this server
                const items = await ShopItem.findAll({ where: { guildId: interaction.guildId } });

                // Filter choices against both item name and itemId configurations
                const filtered = items.filter(item =>
                    item.name.toLowerCase().includes(focusedValue) ||
                    item.itemId.toLowerCase().includes(focusedValue)
                );

                // Respond to Discord (capped at API maximum of 25 choices)
                return void await interaction.respond(
                    filtered.slice(0, 25).map(item => ({
                        name: `${item.name} — $${item.price}`,
                        value: item.itemId
                    }))
                );
            }
            void await interaction.respond([]);
        }

        if (!interaction.isChatInputCommand()) return;

        const EPHEMERAL_MAPPING: Record<string, boolean> = {
            "balance": true,
            "leaderboard": true,
            "inventory": true,
            "wage": true,
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
                    case "inflation": return await handleInflation(interaction);
                    case "leaderboard": return await handleLeaderboard(interaction);
                    case "wage": return await handleWage(interaction)
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

function calculateWage(member: GuildMember): number {
    const wageConfig = config.economy.wages;

    // 1. Start with an array containing just the baseline default wage
    const matchingSalaries: number[] = [wageConfig.defaultAmount];

    // 2. Map through the config roles. If the member has the role, push its salary to the array
    for (const [roleId, salary] of Object.entries(wageConfig.roleSalaries)) {
        if (member.roles.cache.has(roleId)) {
            matchingSalaries.push(salary as number);
        }
    }

    // 3. Return the absolute highest value found.
    // If they have no special roles, Math.max(100) safely returns 100!
    return Math.max(...matchingSalaries);
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
    if (!interaction.inCachedGuild()) return;

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId, userId: interaction.user.id } });
    if (!profile) {
        profile = await EconomyProfile.create({ guildId: interaction.guildId, userId: interaction.user.id, balance: STARTING_BALANCE });
    }

    const now = new Date();
    const cooldownMs = WAGE_COOLDOWN_HOURS * 60 * 60 * 1000;

    // 1. Check Cooldown
    if (profile.lastWageClaim) {
        const timeSinceLastClaim = now.getTime() - profile.lastWageClaim.getTime();
        if (timeSinceLastClaim < cooldownMs) {
            const remainingMs = cooldownMs - timeSinceLastClaim;
            const remainingHours = (remainingMs / (1000 * 60 * 60)).toFixed(1);
            return void await interaction.editReply({
                content: `⏳ You are still on cooldown! Please wait **${remainingHours} hours** before claiming your next wage.`
            });
        }
    }

    // 2. THIS IS WHERE calculateWage IS USED! 🚀
    const salaryAmount = calculateWage(interaction.member);

    // 3. Apply the money and reset the cooldown timer
    profile.balance += salaryAmount;
    profile.lastWageClaim = now;
    await profile.save();

    const formattedSalary = format(config.economy.currencyFormat, { amount: salaryAmount });
    const formattedBalance = format(config.economy.currencyFormat, { amount: profile.balance });

    await interaction.editReply({
        content: `💵 You worked a hard shift and claimed your wage of **${formattedSalary}**!\n🏦 **New Balance:** ${formattedBalance}`
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

    const embed = new EmbedBuilder().setTitle(`🎒 <@${interaction.user.id}>'s Inventory`).setDescription(inventoryList).setColor(0x00ae86);
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
        content: `📦 **<@${interaction.user.id}>** used a **${shopItem.name}**!\n\n${customReply}`
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
        user: targetUser.id,
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

    await interaction.editReply({ content: format(config.economy.setBalance.setTo, {user: targetUser.id, amount: amount}) });
}

async function handleGambleCoinflip(interaction: ChatInputCommandInteraction) {
    const betAmount = interaction.options.getInteger("amount", true);
    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const currentBalance = profile?.balance ?? STARTING_BALANCE;

    if (!(await hasSufficientFunds(interaction, currentBalance, betAmount))) return;

    if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: interaction.user.id, balance: STARTING_BALANCE });

    const isWinner = randomInt(0,2);

    if (isWinner == 1) {
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

    const diceRoll = randomInt(1, 7);

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
        content: `🎰 **<@${interaction.user.id}>** opened a Roulette Table for **${customSeconds} seconds**! Join the thread below to place your bets.`
    });

    const thread = await initialReply.startThread({
        name: `🎰 Roulette Table - <@${interaction.user.id}>`,
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


        const winningNumber = randomInt(0, 37);
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
    // 1. Fetch all profiles in the current guild, sorted by balance descending
    const profiles = await EconomyProfile.findAll({
        where: { guildId: interaction.guildId! },
        order: [["balance", "DESC"]]
    });

    if (profiles.length === 0) {
        return void await interaction.editReply({
            content: "📉 The leaderboard is currently empty! No one has a bank account yet."
        });
    }

    const USERS_PER_PAGE = 10;
    const pages: EmbedBuilder[] = [];
    const totalPages = Math.ceil(profiles.length / USERS_PER_PAGE);

    // 2. Loop through profiles and slice them into chunks of 10
    for (let i = 0; i < profiles.length; i += USERS_PER_PAGE) {
        const chunk = profiles.slice(i, i + USERS_PER_PAGE);
        const currentPage = Math.floor(i / USERS_PER_PAGE) + 1;

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${interaction.guild?.name || "Server"} Wealth Leaderboard`)
            .setColor("#F1C40F") // Clean Gold Color
            .setTimestamp();

        let description = "";

        // 3. Build the text rows for the current page chunk
        chunk.forEach((profile, index) => {
            const globalRank = i + index + 1;
            let rankDisplay = `**#${globalRank}**`;

            // Style up the top 3 with shiny medals
            if (globalRank === 1) rankDisplay = "🥇";
            else if (globalRank === 2) rankDisplay = "🥈";
            else if (globalRank === 3) rankDisplay = "🥉";

            const formattedBalance = format(config.economy.currencyFormat, { amount: profile.balance });
            description += `${rankDisplay} <@${profile.userId}> — **${formattedBalance}**\n`;
        });

        embed.setDescription(description);
        embed.setFooter({ text: `Page ${currentPage} of ${totalPages} • Total Players: ${profiles.length}` });

        pages.push(embed);
    }

    // 4. Pass the array of embeds into your pagination utility!
    await paginate(interaction, pages);
}