import {EmbedBuilder, ChatInputCommandInteraction, GuildMember} from "discord.js";
import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";
import type { Cmd } from "~/util/base";

// 1. Define the Shop Items
const SHOP_ITEMS = [
    { id: "cookie", name: "🍪 Cookie", price: 10, description: "A delicious chocolate chip cookie." },
    { id: "bronze_medal", name: "🥉 Bronze Medal", price: 150, description: "A basic medal to show off your presence." },
    { id: "gold_shield", name: "🛡️ Gold Shield", price: 500, description: "The ultimate flex of wealth and protection." },
    { id: "super_role", name: "👑 VIP Custom Role", price: 2500, description: "Redeemable for a unique colored role!" }
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
            );

    },

    onInteraction: async (ctx, interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const sub = interaction.options.getSubcommand();

        if (sub === "balance") await handleBalance(interaction);
        else if (sub === "shop") await handleShop(interaction);
        else if (sub === "buy") await handleBuy(interaction);
        else if (sub === "inventory") await handleInventory(interaction);
        else if (sub === "add-money") await handleAddMoney(interaction);
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
    const embed = new EmbedBuilder()
        .setTitle("🛒 The Server Marketplace")
        .setDescription("Use `/economy buy <item>` to purchase something!")
        .setColor(0x00ae86);

    for (const item of SHOP_ITEMS) {
        embed.addFields({
            name: `${item.name} — \`$${item.price}\``,
            value: item.description,
            inline: false,
        });
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction: ChatInputCommandInteraction) {
    const itemKey = interaction.options.getString("item", true);
    const item = SHOP_ITEMS.find((i) => i.id === itemKey);

    if (!item) {
        await interaction.reply({ content: "That item doesn't exist in our manifests.", ephemeral: true });
        return;
    }

    // Fetch or create user profile
    const [profile] = await EconomyProfile.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, balance: 100 }
    });

    // Check if they have enough capital
    if (profile.balance < item.price) {
        await interaction.reply({
            content: `❌ You can't afford that! **${item.name}** costs \`$${item.price}\`, but you only have \`$${profile.balance}\`.`,
            ephemeral: true,
        });
        return;
    }

    // Deduct money from account
    profile.balance -= item.price;
    await profile.save();

    // Add item to inventory (or increase quantity if they already own one)
    const [invItem, created] = await Inventory.findOrCreate({
        where: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey },
        defaults: { guildId: interaction.guildId!, userId: interaction.user.id, itemKey, quantity: 1 }
    });

    if (!created) {
        invItem.quantity += 1;
        await invItem.save();
    }

    await interaction.reply({
        content: `🎉 Success! You bought **${item.name}** for \`$${item.price}\`. Your remaining balance is \`$${profile.balance}\`.`,
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