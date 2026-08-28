import {
    ButtonBuilder,
    EmbedBuilder,
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    ButtonStyle,
    ComponentType,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SectionBuilder,
    InteractionContextType, PermissionFlagsBits
} from "discord.js";
import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
    Op, Sequelize, Transaction
} from "sequelize";
import type { Cmd } from "~/util/base";
import { format } from "~/util/base";
import config from "config.json";
import { randomInt } from "crypto";
import { paginate } from "~/util/paginator2";

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
    declare stock: number;
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
                stock: { type: DataTypes.INTEGER, allowNull: false },
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
                    await record.destroy();
                }
            } catch (err) {
                console.error("[Sweeper Worker Error]:", err);
            }
        }, 60 * 1000);
    },

    slash: (builder) => {
        return builder
            .setName("economy")
            .setDescription("Manage your pocket change and inventory")
            .setContexts(InteractionContextType.Guild)
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
                    .addIntegerOption((opt) => opt.setName("quantity").setDescription("How many to buy?").setMinValue(1).setMaxValue(10000000))
            )
            .addSubcommand((sub) =>
                sub
                    .setName("use")
                    .setDescription("Use a consumable item from your inventory")
                    .addStringOption((opt) => opt.setName("item").setDescription("The ID of the item you want to use").setRequired(true).setAutocomplete(true))
            )
            .addSubcommand((sub) =>
                sub
                    .setName("refill")
                    .setDescription("Refill the stock of a specific shop item.")
                    .addStringOption(option =>
                        option.setName("item")
                            .setDescription("The ID of the item to refill")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option =>
                        option.setName("amount")
                            .setDescription("How much stock to add")
                            .setRequired(true)
                    )
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
                            .setDescription("Open a roulette table and place multiple bets! (0-36, Red/Black, Even/Odd)")
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
            if (!interaction.guildId) return void await interaction.respond([]).catch(() => {});

            const sub = interaction.options.getSubcommand(false);
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const shopItems = config.economy.shopItems || [];

            if (sub === "buy" || sub === "refill") {
                try {
                    const dbStockRecords = await ShopItem.findAll({ where: { guildId: interaction.guildId } });
                    const stockMap = new Map(dbStockRecords.map(s => [s.itemId, s.stock]));

                    const filtered = shopItems.filter(item => {
                        const matchesFocus = item.name.toLowerCase().includes(focusedValue) ||
                            item.itemId.toLowerCase().includes(focusedValue);
                        if (!matchesFocus) return false;

                        if (sub === "refill") return item.stock !== -1;

                        const currentStock = item.stock === -1
                            ? -1
                            : (stockMap.get(item.itemId) ?? item.stock);

                        return currentStock === -1 || currentStock > 0;
                    });

                    return void await interaction.respond(
                        filtered.slice(0, 25).map(item => ({
                            name: `${item.name} — $${item.price}`,
                            value: item.itemId
                        }))
                    );
                } catch (error: any) {
                    if (error?.code !== 10062) {
                        console.error("Autocomplete execution error:", error);
                    }
                    return;
                }
            }

            if (sub === "use") {
                try {
                    const inventory = await Inventory.findAll({
                        where: { guildId: interaction.guildId, userId: interaction.user.id }
                    });

                    const itemMap = new Map(shopItems.map(i => [i.itemId, i.name]));
                    const validInventory = inventory.filter(inv => itemMap.has(inv.itemKey));

                    const filtered = validInventory.filter(inv => {
                        const name = itemMap.get(inv.itemKey) || inv.itemKey;
                        return name.toLowerCase().includes(focusedValue) || inv.itemKey.toLowerCase().includes(focusedValue);
                    });

                    return void await interaction.respond(
                        filtered.slice(0, 25).map(inv => ({
                            name: `${itemMap.get(inv.itemKey)} (Owned: ${inv.quantity})`,
                            value: inv.itemKey
                        }))
                    );
                } catch (error: any) {
                    if (error?.code !== 10062) {
                        console.error("Autocomplete execution error:", error);
                    }
                    return;
                }
            }

            return void await interaction.respond([]).catch(() => {});
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
            "refill": true,
            "shop": false,
            "coinflip": false,
            "dice": false,
            "roulette": false,
            "use": false,
        };

        const sub = interaction.options.getSubcommand(true);
        const group = interaction.options.getSubcommandGroup(false);

        try {
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

            const isEphemeral = EPHEMERAL_MAPPING[sub] ?? false;

            try {
                await interaction.deferReply({
                    flags: isEphemeral ? MessageFlags.Ephemeral : undefined
                });
            } catch (error) {
                console.warn(`[Economy Server] Interaction expired before deferral response could reach Discord Gateway for command: ${sub}.`);
                return;
            }

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
                        case "leaderboard": return await handleLeaderboard(interaction);
                        case "wage": return await handleWage(interaction)
                        case "balance": return await handleBalance(interaction);
                        case "shop": return await handleShop(interaction);
                        case "buy": return await handleBuy(interaction);
                        case "use": return await handleUse(interaction);
                        case "inventory": return await handleInventory(interaction);
                        case "add-money": return await handleAddMoney(interaction);
                        case "set-balance": return await handleSetBalance(interaction);
                        case "refill": return await handleRefillStock(interaction)
                    }
                    return;
                }
            }
        } catch (error) {
            console.error(`[Economy] Handler for "${sub}" failed:`, error);

            const failureMessage = { content: "❌ Something went wrong running that command. Please try again." };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(failureMessage).catch(() => {});
            } else {
                await interaction.reply({ ...failureMessage, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
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
    const matchingSalaries: number[] = [wageConfig.defaultAmount];

    for (const [roleId, salary] of Object.entries(wageConfig.roleSalaries)) {
        if (member.roles.cache.has(roleId)) {
            matchingSalaries.push(salary as number);
        }
    }

    return Math.max(...matchingSalaries);
}

async function fetchBalance(guildId: string, userId: string): Promise<number> {
    return (await EconomyProfile.findOne({ where: { guildId, userId } }))?.balance ?? STARTING_BALANCE;
}

async function stakeBet(interaction: ChatInputCommandInteraction, betAmount: number): Promise<boolean> {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    await EconomyProfile.findOrCreate({
        where: { guildId, userId },
        defaults: { guildId, userId, balance: STARTING_BALANCE }
    });

    const [staked] = await EconomyProfile.update(
        { balance: Sequelize.literal(`balance - ${betAmount}`) as any },
        { where: { guildId, userId, balance: { [Op.gte]: betAmount } } }
    );

    if (staked === 0) {
        await interaction.editReply({
            content: format(config.economy.cantAfford, { userBalance: await fetchBalance(guildId, userId) })
        });
        return false;
    }

    return true;
}

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

    const salaryAmount = calculateWage(interaction.member);

    const [claimed] = await EconomyProfile.update(
        { balance: Sequelize.literal(`balance + ${salaryAmount}`) as any, lastWageClaim: now },
        {
            where: {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                [Op.or]: [
                    { lastWageClaim: null },
                    { lastWageClaim: { [Op.lte]: new Date(now.getTime() - cooldownMs) } }
                ]
            }
        }
    );

    if (claimed === 0) {
        return void await interaction.editReply({
            content: "⏳ You are still on cooldown! Please wait before claiming your next wage."
        });
    }

    await interaction.editReply({
        content: format(config.economy.wages.message, {emoji: config.economy.coinEmoji, salary: salaryAmount, balance: profile.balance + salaryAmount })
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
    const shopItems = config.economy.shopItems || [];

    if (shopItems.length === 0) {
        const emptyContainer = new ContainerBuilder()
            .setAccentColor(0xd9534f)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("🛒 **The Server Shop**\nThe shop is currently empty.")
            );
        return void await interaction.editReply({
            components: [emptyContainer],
            flags: [MessageFlags.IsComponentsV2]
        });
    }

    const limitedItemIds = shopItems.filter(i => i.stock !== -1).map(i => i.itemId);
    const stockTrackers = await ShopItem.findAll({
        where: { guildId: interaction.guildId!, itemId: limitedItemIds }
    });
    const stockMap = new Map(stockTrackers.map(s => [s.itemId, s.stock]));

    const containers: any[] = [];

    let currentContainer = new ContainerBuilder()
        .setAccentColor(0x00ae86)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("🛒 **The Server Shop**\nClick the price button next to an item to purchase it instantly!")
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let componentCount = 2;

    for (const item of shopItems) {
        let currentStock = item.stock;
        if (item.stock !== -1) {
            currentStock = stockMap.has(item.itemId) ? stockMap.get(item.itemId)! : item.stock;
        }

        let stockDisplay = item.stock === -1 ? "∞" : currentStock.toString();
        const isOutOfStock = item.stock !== -1 && currentStock === 0;
        if (isOutOfStock) stockDisplay = "❌ OUT OF STOCK";

        const section = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${item.name}`),
                new TextDisplayBuilder().setContent(`${item.description}\n📦 **Stock:** ${stockDisplay}`)
            );

        const button = new ButtonBuilder()
            .setCustomId(`shop_buy_${item.itemId}`)
            .setLabel(isOutOfStock ? "Sold Out" : `${item.price.toLocaleString()}$`)
            .setEmoji(config.economy.coinEmoji)
            .setStyle(isOutOfStock ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(isOutOfStock);

        section.setButtonAccessory(button);

        const separator = new SeparatorBuilder().setDivider(true);

        if (componentCount + 2 > 10) {
            containers.push(currentContainer);
            currentContainer = new ContainerBuilder().setAccentColor(0x00ae86);
            componentCount = 0;
        }

        currentContainer.addSectionComponents(section);
        currentContainer.addSeparatorComponents(separator);
        componentCount += 2;
    }

    if (componentCount > 0) {
        containers.push(currentContainer);
    }

    const shopMessage = await interaction.editReply({
        components: containers,
        flags: [MessageFlags.IsComponentsV2],
    });

    const collector = shopMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000
    });

    collector.on("collect", async (buttonInteraction) => {
        const itemId = buttonInteraction.customId.replace("shop_buy_", "");

        try {
            await buttonInteraction.deferReply({ ephemeral: true });
        } catch (error) {
            console.warn("[Economy Shop] Button component interaction expired before defer reply completed execution.");
            return;
        }

        const buyShim = Object.create(buttonInteraction);
        buyShim.options = {
            getString: (name: string) => name === "item" ? itemId : null,
            getInteger: (name: string) => name === "quantity" ? 1 : null
        };

        try {
            await handleBuy(buyShim as unknown as ChatInputCommandInteraction);
        } catch (err) {
            console.error("[Economy Shop] Buy from shop button failed:", err);
            await buttonInteraction.editReply({ content: "❌ Purchase failed. Please try again." }).catch(() => {});
        }
    });

    collector.on("end", async () => {
        try {
            const disabledComponents = containers.map(container => {
                const json = container.toJSON();
                if (json.components) {
                    json.components.forEach((comp: any) => {
                        if (comp.type === ComponentType.Section &&
                            comp.accessory?.type === ComponentType.Button) {
                            comp.accessory.disabled = true;
                        }
                    });
                }
                return json;
            });
            await interaction.editReply({ components: disabledComponents });
        } catch {
        }
    });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
    const sequelize = EconomyProfile.sequelize;
    if (!sequelize) {
        return void await interaction.editReply({ content: "❌ Database connection error." });
    }

    const itemKey = interaction.options.getString("item", true).toLowerCase();
    const quantity = interaction.options.getInteger("quantity") ?? 1;

    const shopItems = config.economy.shopItems || [];
    const item = shopItems.find(i => i.itemId === itemKey);

    if (!item) {
        return void await interaction.editReply({ content: config.economy.shop.notItem });
    }

    if (item.roleId && quantity > 1) {
        return void await interaction.editReply({ content: config.economy.shop.notMultiple });
    }

    if (item.roleId && !item.durationDays && interaction.member instanceof GuildMember) {
        if (interaction.member.roles.cache.has(item.roleId)) {
            return void await interaction.editReply({ content: config.economy.shop.permRoleOwned });
        }
    }

    let currentStock = item.stock;
    let stockTracker = null;

    if (item.stock !== -1) {
        stockTracker = await ShopItem.findOne({ where: { guildId: interaction.guildId!, itemId: itemKey } });
        currentStock = stockTracker ? stockTracker.stock : item.stock;
    }

    if (item.stock !== -1 && currentStock < quantity) {
        if (currentStock === 0) {
            return void await interaction.editReply({ content: format(config.economy.shop.soldOut, {name: item.name}) });
        }
        return void await interaction.editReply({ content: format(config.economy.shop.notEnough, {stock: currentStock} )});
    }

    const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const currentBalance = profile?.balance ?? STARTING_BALANCE;
    const totalCost = item.price * quantity;

    const shopErrorMessage = format(config.economy.shop.cantAfford,{
        name: quantity > 1 ? `${quantity}x ${item.name}` : item.name,
        price: totalCost,
        balance: currentBalance,
    });
    if (!(await hasSufficientFunds(interaction, currentBalance, totalCost, shopErrorMessage))) return;

    let newBalance = currentBalance - totalCost;
    let roleGrantedMessage = "";

    try {
        await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
            await EconomyProfile.findOrCreate({
                where: { guildId: interaction.guildId!, userId: interaction.user.id },
                defaults: { guildId: interaction.guildId!, userId: interaction.user.id, balance: STARTING_BALANCE },
                transaction: t
            });

            if (item.stock !== -1) {
                await ShopItem.findOrCreate({
                    where: { guildId: interaction.guildId!, itemId: itemKey },
                    defaults: { guildId: interaction.guildId!, itemId: itemKey, stock: item.stock },
                    transaction: t
                });

                const [stockTaken] = await ShopItem.update(
                    { stock: Sequelize.literal(`stock - ${quantity}`) as any },
                    {
                        where: { guildId: interaction.guildId!, itemId: itemKey, stock: { [Op.gte]: quantity } },
                        transaction: t
                    }
                );

                if (stockTaken === 0) throw new Error("INSUFFICIENT_STOCK");
            }

            const [debited] = await EconomyProfile.update(
                { balance: Sequelize.literal(`balance - ${totalCost}`) as any },
                {
                    where: {
                        guildId: interaction.guildId!,
                        userId: interaction.user.id,
                        balance: { [Op.gte]: totalCost }
                    },
                    transaction: t
                }
            );

            if (debited === 0) throw new Error("INSUFFICIENT_FUNDS");

            const [invItem, created] = await Inventory.findOrCreate({
                where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey },
                defaults: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey, quantity: quantity },
                transaction: t
            });

            if (!created) {
                await invItem.increment({ quantity: quantity }, { transaction: t });
            }

            if (item.roleId && item.durationDays) {
                const timeToAdd = item.durationDays * 24 * 60 * 60 * 1000;
                const tempRole = await TempRole.findOne({
                    where: { guildId: interaction.guildId!, userId: interaction.user.id, roleId: item.roleId },
                    transaction: t
                });

                if (tempRole) {
                    tempRole.expiresAt = new Date(tempRole.expiresAt.getTime() + timeToAdd);
                    await tempRole.save({ transaction: t });
                } else {
                    await TempRole.create({
                        guildId: interaction.guildId!,
                        userId: interaction.user.id,
                        roleId: item.roleId,
                        expiresAt: new Date(Date.now() + timeToAdd)
                    }, { transaction: t });
                }
            }
        });
    } catch (error: any) {
        if (error?.message === "INSUFFICIENT_FUNDS") {
            return void await interaction.editReply({ content: shopErrorMessage });
        }
        if (error?.message === "INSUFFICIENT_STOCK") {
            return void await interaction.editReply({ content: format(config.economy.shop.soldOut, { name: item.name }) });
        }
        console.error("Buy Transaction Error:", error);
        return void await interaction.editReply({ content: "❌ Transaction failed. Please try again." });
    }

    newBalance = (await EconomyProfile.findOne({
        where: { guildId: interaction.guildId!, userId: interaction.user.id }
    }))?.balance ?? newBalance;

    if (item.roleId && interaction.member instanceof GuildMember) {
        try {
            if (item.durationDays) {
                await interaction.member.roles.add(item.roleId, `Purchased ${item.durationDays} day pass.`);
                roleGrantedMessage = format(config.economy.shop.tempRole, { roleId: item.roleId, durationDays: item.durationDays });
            } else {
                await interaction.member.roles.add(item.roleId, `Purchased permanent role.`);
                roleGrantedMessage = format(config.economy.shop.permaRole, {roleId: item.roleId});
            }
        } catch (error) {
            console.error("Failed to assign shop role:", error);

            try {
                await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE }, async (t) => {
                    await EconomyProfile.increment(
                        { balance: totalCost },
                        { where: { guildId: interaction.guildId!, userId: interaction.user.id }, transaction: t }
                    );

                    const invItem = await Inventory.findOne({
                        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey },
                        transaction: t
                    });

                    if (invItem) {
                        if (invItem.quantity <= quantity) await invItem.destroy({ transaction: t });
                        else await invItem.decrement({ quantity }, { transaction: t });
                    }

                    if (item.stock !== -1) {
                        await ShopItem.increment(
                            { stock: quantity },
                            { where: { guildId: interaction.guildId!, itemId: itemKey }, transaction: t }
                        );
                    }

                    if (item.roleId && item.durationDays) {
                        const tempRole = await TempRole.findOne({
                            where: { guildId: interaction.guildId!, userId: interaction.user.id, roleId: item.roleId },
                            transaction: t
                        });

                        if (tempRole) {
                            const rewound = tempRole.expiresAt.getTime() - item.durationDays * 24 * 60 * 60 * 1000;
                            if (rewound <= Date.now()) await tempRole.destroy({ transaction: t });
                            else {
                                tempRole.expiresAt = new Date(rewound);
                                await tempRole.save({ transaction: t });
                            }
                        }
                    }
                });
            } catch (rollbackError) {
                console.error("Refund rollback failed:", rollbackError);
            }

            return void await interaction.editReply({
                content: "❌ Failed to grant the role, refunded."
            }).catch(() => {});
        }
    }

    await interaction.editReply({
        content: format(config.economy.shop.successBuy, {
            name: quantity > 1 ? `${quantity}x ${item.name}` : item.name,
            price: totalCost,
            message: roleGrantedMessage,
            balance: newBalance
        })
    });
}

async function handleInventory(interaction: ChatInputCommandInteraction) {
    const items = await Inventory.findAll({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });

    const shopItems = config.economy.shopItems || [];
    const itemMap = new Map(shopItems.map(i => [i.itemId, i.name]));

    const validInventory = items.filter(item => itemMap.has(item.itemKey));

    if (validInventory.length === 0) return void await interaction.editReply({ content: config.economy.inv.empty });

    const inventoryList = validInventory.map((item) => {
        const visualName = itemMap.get(item.itemKey) || `⚙️ Unknown Item (${item.itemKey})`;
        return `${visualName} x\`${item.quantity}\``;
    }).join("\n");
    const responseMessage = `🎒 **<@${interaction.user.id}>'s Inventory**\n\n${inventoryList}`;

    await interaction.editReply({ content: responseMessage });
}

async function handleUse(interaction: ChatInputCommandInteraction) {
    const itemKey = interaction.options.getString("item", true).toLowerCase();

    const shopItems = config.economy.shopItems || [];
    const shopItem = shopItems.find(i => i.itemId === itemKey);

    if (!shopItem) {
        return void await interaction.editReply({ content: config.economy.inv.nonexistent }).catch(() => {});
    }

    const invItem = await Inventory.findOne({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey }
    });

    if (!invItem || invItem.quantity <= 0) {
        return void await interaction.editReply({
            content: format(config.economy.inv.lack, { item: shopItem.name })
        }).catch(() => {});
    }

    if (!shopItem.useMessage) {
        return void await interaction.editReply({
            content: format(config.economy.inv.nonconsumable, { name: shopItem.name })
        }).catch(() => {});
    }

    const [consumed] = await Inventory.update(
        { quantity: Sequelize.literal("quantity - 1") as any },
        {
            where: {
                guildId: interaction.guildId!,
                userId: interaction.user.id,
                itemKey,
                quantity: { [Op.gt]: 0 }
            }
        }
    );

    if (consumed === 0) {
        return void await interaction.editReply({
            content: format(config.economy.inv.lack, { item: shopItem.name })
        }).catch(() => {});
    }

    await Inventory.destroy({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey, quantity: { [Op.lte]: 0 } }
    });

    const customReply = shopItem.useMessage.replace(/{user}/g, `<@${interaction.user.id}>`);

    await interaction.editReply({
        content: `📦 **<@${interaction.user.id}>** used a **${shopItem.name}**!\n\n${customReply}`
    }).catch(() => {});
}

async function handleAddMoney(interaction: ChatInputCommandInteraction) {
    if (!(await hasStaffPermission(interaction))) return;
    const targetUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (amount <= 0 || amount > 1000000000) return void await interaction.editReply({ content: config.economy.limit });

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: targetUser.id } });
    if (!profile) profile = await EconomyProfile.create({ guildId: interaction.guildId!, userId: targetUser.id, balance: STARTING_BALANCE });

    await profile.increment({ balance: amount });
    const replyMessage = format(config.economy.addMoney, {
        emoji: config.economy.coinEmoji,
        added: amount,
        user: targetUser.id,
        newBalance: profile.balance + amount
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
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    if (!(await stakeBet(interaction, betAmount))) return;

    const isWinner = randomInt(0,2);

    if (isWinner == 1) {
        await EconomyProfile.increment({ balance: betAmount * 2 }, { where: { guildId, userId } });
        await interaction.editReply({ content: format(config.economy.betWin, {thing: "coin", betAmount: betAmount, emoji: config.economy.coinEmoji, balance: await fetchBalance(guildId, userId), dice: ""}) });
    } else {
        await interaction.editReply({ content: format(config.economy.betLost, {dice: "", betAmount: betAmount, emoji: config.economy.coinEmoji, balance: await fetchBalance(guildId, userId)}) });
    }
}

async function handleGambleDice(interaction: ChatInputCommandInteraction) {
    const betAmount = interaction.options.getInteger("amount", true);
    const guess = interaction.options.getInteger("guess", true);

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;

    if (!(await stakeBet(interaction, betAmount))) return;

    const diceRoll = randomInt(1, 7);

    if (guess === diceRoll) {
        await EconomyProfile.increment({ balance: betAmount * 6 }, { where: { guildId, userId } });
        await interaction.editReply({ content: format(config.economy.betWin, {thing: "dice", betAmount: betAmount, emoji: config.economy.coinEmoji, balance: await fetchBalance(guildId, userId), dice: `It rolled a ${diceRoll}`}) });
    } else {
        await interaction.editReply({ content: format(config.economy.betLost, {dice: `The dice rolled ${diceRoll} while you guessed ${guess}`, betAmount: betAmount, emoji: config.economy.coinEmoji, balance: await fetchBalance(guildId, userId)}) });
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
    if (interaction.channel?.isThread() || !interaction.appPermissions?.has(PermissionFlagsBits.CreatePublicThreads)) {
        await interaction.editReply({
            content: "❌ Roulette cannot be started inside a thread or without thread creation permissions."
        }).catch(() => {});
        return;
    }

    const customSeconds = interaction.options.getInteger("seconds") || 60;
    const timeMs = customSeconds * 1000;

    let initialReply;
    try {
        initialReply = await interaction.editReply({
            content: format(config.economy.roulette.openMessage, { userId: interaction.user.id, seconds: customSeconds })
        });
    } catch {
        return;
    }

    let thread;
    try {
        thread = await initialReply.startThread({
            name: format(config.economy.roulette.threadName, { username: interaction.user.username }),
            autoArchiveDuration: 60,
            reason: "Roulette Game Room"
        });
    } catch {
        await interaction.editReply({
            content: "❌ Failed to create the game thread. Please ensure I have proper permissions."
        }).catch(() => {});
        return;
    }

    const bets: RouletteBet[] = [];

    await thread.send({
        content: format(config.economy.roulette.guideMessage, { seconds: customSeconds, userId: interaction.user.id })
    }).catch(() => {});

    const collector = thread.createMessageCollector({ filter: (m) => !m.author.bot, time: timeMs });

    collector.on("collect", async (message) => {
        try {
            const args = message.content.trim().toLowerCase().split(/\s+/);
            const commandOrType = args[0];

            if (commandOrType === "spin") {
                if (message.author.id !== interaction.user.id) return void await message.react("❌").catch(() => {});
                if (bets.length === 0) return void await message.react("❌").catch(() => {});
                collector.stop("spun");
                return;
            }

            const validBetTypes = ["red", "black", "even", "odd", "green"];
            const parsedNumber = parseInt(commandOrType, 10);
            const isNumberBet = !isNaN(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 36;

            if (validBetTypes.includes(commandOrType) || isNumberBet) {
                const amountStr = args[1];
                if (!amountStr) return void await message.react("❌").catch(() => {});

                const amount = parseInt(amountStr, 10);
                if (isNaN(amount) || amount <= 0) return void await message.react("❌").catch(() => {});

                await EconomyProfile.findOrCreate({
                    where: { guildId: interaction.guildId!, userId: message.author.id },
                    defaults: { guildId: interaction.guildId!, userId: message.author.id, balance: STARTING_BALANCE }
                });

                const [staked] = await EconomyProfile.update(
                    { balance: Sequelize.literal(`balance - ${amount}`) as any },
                    { where: { guildId: interaction.guildId!, userId: message.author.id, balance: { [Op.gte]: amount } } }
                );

                if (staked === 0) return void await message.react("❌").catch(() => {});

                bets.push({
                    userId: message.author.id,
                    username: message.author.username,
                    amount: amount,
                    betType: isNumberBet ? "number" : (commandOrType as any),
                    betNumber: isNumberBet ? parsedNumber : undefined
                });
                await message.react("✅").catch(() => {});
            }
        } catch (err) {
            console.error("[Roulette Bet]", err);
        }
    });

    collector.on("end", async () => {
        try {
            if (bets.length === 0) {
                await thread.send({ content: config.economy.roulette.inactivityMessage }).catch(() => {});
                try {
                    await thread.setLocked(true);
                    await thread.setArchived(true);
                } catch {}
                return;
            }

            const winningNumber = randomInt(0, 37);
            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
            let color: "green" | "red" | "black" = "green";
            if (winningNumber > 0) color = redNumbers.includes(winningNumber) ? "red" : "black";

            const isEven = winningNumber > 0 && winningNumber % 2 === 0;
            const isOdd = winningNumber > 0 && winningNumber % 2 !== 0;

            await thread.send({ content: config.economy.roulette.spinningMessage }).catch(() => {});

            const userBreakdowns = new Map<string, string[]>();
            const userNetTotals = new Map<string, number>();

            for (const bet of bets) {
                let won = bet.betType === color || (bet.betType === "even" && isEven) || (bet.betType === "odd" && isOdd) || bet.betNumber === winningNumber;

                let payoutMultiplier = (bet.betType === "number" || bet.betType === "green") ? 35 : 2;
                let betDisplay = bet.betType === "number" ? `Number ${bet.betNumber}` : bet.betType;

                const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: bet.userId } });
                const currentNet = userNetTotals.get(bet.userId) ?? 0;
                if (!userBreakdowns.has(bet.userId)) userBreakdowns.set(bet.userId, []);

                const formattedBetAmount = bet.amount.toLocaleString();

                if (won && profile) {
                    const winnings = bet.amount * payoutMultiplier;
                    await profile.increment('balance', { by: winnings });

                    const formattedWinnings = winnings.toLocaleString();
                    userBreakdowns.get(bet.userId)!.push(
                        format(config.economy.roulette.betWonLine, { betDisplay, amount: formattedWinnings })
                    );
                    userNetTotals.set(bet.userId, currentNet + (winnings - bet.amount));
                } else {
                    userBreakdowns.get(bet.userId)!.push(
                        format(config.economy.roulette.betLostLine, { betDisplay, amount: formattedBetAmount })
                    );
                    userNetTotals.set(bet.userId, currentNet - bet.amount);
                }
            }

            const emoji = color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢";

            let outputMessage = format(config.economy.roulette.resultHeader, {
                number: winningNumber,
                color: color.toUpperCase(),
                emoji: emoji
            });

            for (const [userId, breakdownArray] of userBreakdowns.entries()) {
                const userMention = `<@${userId}>`;
                const netValue = userNetTotals.get(userId) ?? 0;
                let netStatus = config.economy.roulette.brokeEven;

                if (netValue > 0) {
                    netStatus = format(config.economy.roulette.wonNet, { amount: netValue.toLocaleString() });
                } else if (netValue < 0) {
                    netStatus = format(config.economy.roulette.lostNet, { amount: Math.abs(netValue).toLocaleString() });
                }

                outputMessage += format(config.economy.roulette.userSummaryRow, {
                    user: userMention,
                    breakdown: breakdownArray.join("\n"),
                    netStatus: netStatus
                });
            }

            // Chunk and send outputMessage if it exceeds 1900 characters
            const CHUNK_LIMIT = 1900;
            const lines = outputMessage.split("\n");
            let currentChunk = "";

            for (const line of lines) {
                if ((currentChunk + "\n" + line).length > CHUNK_LIMIT) {
                    if (currentChunk.trim()) {
                        await thread.send({ content: currentChunk }).catch(() => {});
                    }
                    currentChunk = line;
                } else {
                    currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
                }
            }

            if (currentChunk.trim()) {
                await thread.send({ content: currentChunk }).catch(() => {});
            }

            try {
                await thread.setLocked(true);
                await thread.setArchived(true);
            } catch {}
        } catch (err) {
            console.error("[Roulette Result]", err);
        }
    });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
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

    for (let i = 0; i < profiles.length; i += USERS_PER_PAGE) {
        const chunk = profiles.slice(i, i + USERS_PER_PAGE);
        const currentPage = Math.floor(i / USERS_PER_PAGE) + 1;

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${interaction.guild?.name || "Server"} Wealth Leaderboard`)
            .setColor("#F1C40F")
            .setTimestamp();

        let description = "";

        chunk.forEach((profile, index) => {
            const globalRank = i + index + 1;
            let rankDisplay = `**#${globalRank}**`;

            if (globalRank === 1) rankDisplay = "🥇";
            else if (globalRank === 2) rankDisplay = "🥈";
            else if (globalRank === 3) rankDisplay = "🥉";

            const formattedBalance = `${profile.balance.toLocaleString()}$`;
            description += `${rankDisplay} <@${profile.userId}> — **${formattedBalance}**\n`;
        });

        embed.setDescription(description);
        embed.setFooter({ text: `Page ${currentPage} of ${totalPages} • Total Players: ${profiles.length}` });

        pages.push(embed);
    }

    await paginate(interaction, pages);
}

async function handleRefillStock(interaction: ChatInputCommandInteraction) {
    if (!(await hasStaffPermission(interaction))) return;
    const itemKey = interaction.options.getString("item", true).toLowerCase();
    const amount = interaction.options.getInteger("amount", true);

    if (amount <= 0) {
        return void await interaction.editReply({
            content: "❌ You must specify a positive amount to refill."
        });
    }

    const shopItems = config.economy.shopItems || [];
    const item = shopItems.find(i => i.itemId === itemKey);

    if (!item) {
        return void await interaction.editReply({
            content: `❌ Could not find an item with the ID \`${itemKey}\` in the shop configuration.`
        });
    }

    if (item.stock === -1) {
        return void await interaction.editReply({
            content: `⚠️ **${item.name}** currently has infinite stock (∞), so it does not need to be refilled!`
        });
    }

    const [tracker] = await ShopItem.findOrCreate({
        where: { guildId: interaction.guildId!, itemId: itemKey },
        defaults: { guildId: interaction.guildId!, itemId: itemKey, stock: item.stock }
    });

    await tracker.increment({ stock: amount });
    await tracker.reload();

    await interaction.editReply({
        content: `📦 Successfully added **${amount}** stock to **${item.name}**! The shop now has **${tracker.stock}** available.`
    });
}