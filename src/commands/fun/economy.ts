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
    SectionBuilder
} from "discord.js";
import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
    Op
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
        }, 3600000);
    },

    onInteraction: async (ctx, interaction) => {
        if (interaction.isAutocomplete()) {
            if (!interaction.guildId) return void await interaction.respond([]);

            const sub = interaction.options.getSubcommand(false);
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const shopItems = config.economy.shopItems || [];

            if (sub === "buy" || sub === "refill") {
                const filtered = shopItems.filter(item =>
                    item.name.toLowerCase().includes(focusedValue) ||
                    item.itemId.toLowerCase().includes(focusedValue)
                );

                return void await interaction.respond(
                    filtered.slice(0, 25).map(item => ({
                        name: `${item.name} — $${item.price}`,
                        value: item.itemId
                    }))
                );
            }

            if (sub === "use") {
                const inventory = await Inventory.findAll({
                    where: { guildId: interaction.guildId, userId: interaction.user.id }
                });

                const itemMap = new Map(shopItems.map(i => [i.itemId, i.name]));
                const validInventory = [];

                for (const inv of inventory) {
                    if (!itemMap.has(inv.itemKey)) {
                        await inv.destroy();
                    } else {
                        validInventory.push(inv);
                    }
                }

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
            }

            return void await interaction.respond([]);
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

        // SAFE GUARD: Wrapped inside a try-catch to absorb 10062 Unknown Interaction token expirations
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
    const matchingSalaries: number[] = [wageConfig.defaultAmount];

    for (const [roleId, salary] of Object.entries(wageConfig.roleSalaries)) {
        if (member.roles.cache.has(roleId)) {
            matchingSalaries.push(salary as number);
        }
    }

    return Math.max(...matchingSalaries);
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

    profile.balance += salaryAmount;
    profile.lastWageClaim = now;
    await profile.save();

    await interaction.editReply({
        content: format(config.economy.wages.message, {emoji: config.economy.coinEmoji, salary: salaryAmount, balance: profile.balance })
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
        return void await interaction.reply({
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

        // SAFE GUARD: Wrap button component interaction deferral inside try-catch to prevent crashes on latency spikes
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

        await handleBuy(buyShim as unknown as ChatInputCommandInteraction);
    });

    collector.on("end", async () => {
        try {
            const disabledComponents = containers.map(container => {
                const json = container.toJSON();
                if (json.components) {
                    json.components.forEach((comp: any) => {
                        if (comp.type === 9 && comp.accessory && comp.accessory.type === 2) {
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
    const itemKey = interaction.options.getString("item", true).toLowerCase();
    const quantity = interaction.options.getInteger("quantity") ?? 1;

    const shopItems = config.economy.shopItems || [];
    const item = shopItems.find(i => i.itemId === itemKey);
    if (!item) return void await interaction.editReply({ content: config.economy.shop.notItem });

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

    if (item.roleId && quantity > 1) {
        return void await interaction.editReply({ content: config.economy.shop.notMultiple });
    }

    let profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: interaction.user.id } });
    const currentBalance = profile?.balance ?? STARTING_BALANCE;

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

    if (item.stock !== -1) {
        if (!stockTracker) {
            stockTracker = await ShopItem.create({ guildId: interaction.guildId!, itemId: itemKey, stock: item.stock - quantity });
        } else {
            stockTracker.stock -= quantity;
            await stockTracker.save();
        }
    }
    profile.balance -= totalCost;

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

    const [invItem, created] = await Inventory.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey, quantity: quantity }
    });

    if (!created) {
        invItem.quantity += quantity;
        await invItem.save();
    }

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

    const shopItems = config.economy.shopItems || [];
    const itemMap = new Map(shopItems.map(i => [i.itemId, i.name]));
    const validInventory = [];

    for (const item of items) {
        if (!itemMap.has(item.itemKey)) {
            await item.destroy();
        } else {
            validInventory.push(item);
        }
    }

    if (validInventory.length === 0) return void await interaction.editReply({ content: config.economy.inv.empty });

    const inventoryList = validInventory.map((item) => {
        const visualName = itemMap.get(item.itemKey) || `⚙️ Unknown Item (${item.itemKey})`;
        return `${visualName} x\`${item.quantity}\``;
    }).join("\n");

    const embed = new EmbedBuilder().setTitle(`🎒 <@${interaction.user.id}>'s Inventory`).setDescription(inventoryList).setColor(0x00ae86);
    await interaction.editReply({ embeds: [embed] });
}

async function handleUse(interaction: ChatInputCommandInteraction) {
    const itemKey = interaction.options.getString("item", true).toLowerCase();

    const shopItems = config.economy.shopItems || [];
    const shopItem = shopItems.find(i => i.itemId === itemKey);

    const invItem = await Inventory.findOne({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey }
    });

    if (!shopItem) {
        if (invItem) await invItem.destroy();
        return void await interaction.editReply({ content: config.economy.inv.nonexistent });
    }

    if (!invItem || invItem.quantity <= 0) {
        return void await interaction.editReply({
            content: format(config.economy.inv.lack, {item: shopItem.name})
        });
    }

    if (!shopItem.useMessage) {
        return void await interaction.editReply({
            content: format(config.economy.inv.nonconsumable, {name: shopItem.name})
        });
    }

    invItem.quantity -= 1;
    if (invItem.quantity <= 0) {
        await invItem.destroy();
    } else {
        await invItem.save();
    }

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
    const replyMessage = format(config.economy.addMoney, {
        emoji: config.economy.coinEmoji,
        added: amount,
        user: targetUser.id,
        newBalance: profile.balance
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
        content: format(config.economy.roulette.openMessage, { userId: interaction.user.id, seconds: customSeconds })
    });

    const thread = await initialReply.startThread({
        name: format(config.economy.roulette.threadName, { username: interaction.user.username }),
        autoArchiveDuration: 60,
        reason: "Roulette Game Room"
    });

    const bets: RouletteBet[] = [];

    await thread.send({
        content: format(config.economy.roulette.guideMessage, { seconds: customSeconds, userId: interaction.user.id })
    });

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

            if (!profile) profile = await EconomyProfile.create({ guildId: message.author.id, userId: message.author.id, balance: STARTING_BALANCE });

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
        if (bets.length === 0) {
            await thread.send({ content: config.economy.roulette.inactivityMessage });
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

        await thread.send({ content: config.economy.roulette.spinningMessage });

        const userBreakdowns = new Map<string, string[]>();
        const userNetTotals = new Map<string, number>();

        for (const bet of bets) {
            let won = bet.betType === color || (bet.betType === "even" && isEven) || (bet.betType === "odd" && isOdd) || bet.betNumber === winningNumber;

            let payoutMultiplier = (bet.betType === "number" || bet.betType === "green") ? 8 : 2;
            let betDisplay = bet.betType === "number" ? `Number ${bet.betNumber}` : bet.betType;

            const profile = await EconomyProfile.findOne({ where: { guildId: interaction.guildId!, userId: bet.userId } });
            const currentNet = userNetTotals.get(bet.userId) ?? 0;
            if (!userBreakdowns.has(bet.userId)) userBreakdowns.set(bet.userId, []);

            const formattedBetAmount = bet.amount.toLocaleString();

            if (won && profile) {
                const winnings = bet.amount * payoutMultiplier;
                profile.balance += winnings;
                await profile.save();

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

        await thread.send({ content: outputMessage });
        await thread.setLocked(true);
        await thread.setArchived(true);
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

    let stockTracker = await ShopItem.findOne({
        where: { guildId: interaction.guildId!, itemId: itemKey }
    });

    if (!stockTracker) {
        stockTracker = await ShopItem.create({
            guildId: interaction.guildId!,
            itemId: itemKey,
            stock: item.stock + amount
        });
    } else {
        stockTracker.stock += amount;
        await stockTracker.save();
    }

    await interaction.editReply({
        content: `📦 Successfully added **${amount}** stock to **${item.name}**! The shop now has **${stockTracker.stock}** available.`
    });
}