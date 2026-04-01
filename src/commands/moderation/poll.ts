import {
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  LabelBuilder,
  TextDisplayBuilder,
} from "discord.js";
import {
  DataTypes,
  Model,
  Op,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";
import type { Cmd } from "~/util/base";
import { stv } from "~/util/stv";
import { parseDuration } from "~/util/time";

// Poll model
export class Poll extends Model<
  InferAttributes<Poll>,
  InferCreationAttributes<Poll>
> {
  declare id: CreationOptional<number>;
  declare guildId: string;
  declare channelId: string;
  declare messageId: string;
  declare title: string;
  declare seats: number;
  declare status: "open" | "closed";
  declare closeAt: Date;
  declare creatorId: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Candidate extends Model<
  InferAttributes<Candidate>,
  InferCreationAttributes<Candidate>
> {
  declare id: CreationOptional<number>;
  declare pollId: number;
  declare name: string;
  declare index: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Vote extends Model<
  InferAttributes<Vote>,
  InferCreationAttributes<Vote>
> {
  declare id: CreationOptional<number>;
  declare pollId: number;
  declare userId: string;
  declare ranking: number[];
  declare weight: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export default {
  data: { name: "poll" },

  setup: async (ctx) => {
    Poll.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        guildId: { type: DataTypes.STRING, allowNull: false },
        channelId: { type: DataTypes.STRING, allowNull: false },
        messageId: { type: DataTypes.STRING, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        seats: { type: DataTypes.INTEGER, allowNull: false },
        status: {
          type: DataTypes.ENUM("open", "closed"),
          defaultValue: "open",
        },
        closeAt: { type: DataTypes.DATE, allowNull: false },
        creatorId: { type: DataTypes.STRING, allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize: ctx.sql },
    );

    Candidate.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        pollId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: Poll, key: "id" },
        },
        name: { type: DataTypes.STRING, allowNull: false },
        index: { type: DataTypes.INTEGER, allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize: ctx.sql },
    );
    Vote.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        pollId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: Poll, key: "id" },
        },
        userId: { type: DataTypes.STRING, allowNull: false },
        ranking: { type: DataTypes.JSON, allowNull: false },
        weight: { type: DataTypes.FLOAT, defaultValue: 1.0 },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize: ctx.sql },
    );

    Poll.hasMany(Candidate, { foreignKey: "pollId", onDelete: "CASCADE" });
    Poll.hasMany(Vote, { foreignKey: "pollId", onDelete: "CASCADE" });
    Candidate.belongsTo(Poll, { foreignKey: "pollId" });
    Vote.belongsTo(Poll, { foreignKey: "pollId" });

    await ctx.sql.sync();

    const checkExpiredPolls = async () => {
      const now = new Date();
      const expiredPolls = await Poll.findAll({
        where: {
          status: "open",
          closeAt: { [Op.lt]: now },
        },
      });

      for (const poll of expiredPolls) {
        poll.status = "closed";
        await poll.save();

        // Update Discord message
        try {
          const channel = await ctx.client.channels.fetch(poll.channelId);

          if (channel?.isTextBased()) {
            const message = await channel.messages.fetch(poll.messageId);
            const embed = EmbedBuilder.from(message.embeds[0]);
            embed.setDescription(
              `**Seats**: ${poll.seats}
              **Status**: :red_circle: Closed (automatically)
              **Closes**: <t:${Math.floor(poll.closeAt.getTime() / 1000)}:R>`,
            );
            await message.edit({ embeds: [embed], components: [] });
          }
        } catch {
          // Message might be deleted – ignore
        }
      }
    };

    // Run immediately and then every minute
    await checkExpiredPolls();
    setInterval(checkExpiredPolls, 60000);
  },

  slash: (builder) => {
    return builder
      .setName("poll")
      .setDescription("Manage STV polls")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new STV poll")
          .addStringOption((opt) =>
            opt.setName("title").setDescription("Poll title").setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName("seats")
              .setDescription("Number of seats")
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("candidates")
              .setDescription("Comma-separated list of candidates")
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName("duration")
              .setDescription("Duration (e.g., 30m, 2h, 1d). Min 5m, max 30d")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("close")
          .setDescription("Close an STV poll manually")
          .addStringOption((opt) =>
            opt.setName("poll_id").setDescription("Poll ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("results")
          .setDescription("Show results of an STV poll")
          .addStringOption((opt) =>
            opt.setName("poll_id").setDescription("Poll ID").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Delete an STV poll and all its data")
          .addStringOption((opt) =>
            opt.setName("poll_id").setDescription("Poll ID").setRequired(true),
          ),
      );
  },

  onInteraction: async (ctx, interaction) => {
    if (interaction.isChatInputCommand()) {
      const sub = interaction.options.getSubcommand();

      if (sub === "create") await handleCreate(interaction);
      else if (sub === "close") await handleClose(interaction);
      else if (sub === "results") await handleResults(interaction);
      else if (sub === "delete") await handleDelete(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId === "poll:vote_button") {
        await handleVoteButton(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("poll:vote_modal_")) {
        await handleVoteModal(interaction);
      }
    }
  },
} as Cmd;

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString("title", true);
  const seats = interaction.options.getInteger("seats", true);
  const candidatesStr = interaction.options.getString("candidates", true);
  const durationStr = interaction.options.getString("duration", true);

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    await interaction.reply({
      content:
        'Invalid duration. Use format like "5m", "2h", "1d". Minimum 5 minutes, maximum 30 days.',
      ephemeral: true,
    });
    return;
  }

  const candidatesList = candidatesStr
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c);
  if (candidatesList.length < seats) {
    await interaction.reply({
      content: "There must be at least as many candidates as seats.",
      ephemeral: true,
    });
    return;
  }

  const closeAt = new Date(Date.now() + durationMs);

  const poll = await Poll.create({
    guildId: interaction.guildId!,
    channelId: interaction.channelId!,
    messageId: "pending",
    title,
    seats,
    status: "open",
    closeAt,
    creatorId: interaction.user.id,
  });

  for (let i = 0; i < candidatesList.length; i++) {
    await Candidate.create({
      pollId: poll.id,
      name: candidatesList[i],
      index: i,
    });
  }

  const candidates = await Candidate.findAll({
    where: { pollId: poll.id },
    order: [["index", "ASC"]],
  });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `**Seats**: ${seats}
      **Status**: :green_circle: Open
      **Closes**: <t:${Math.floor(closeAt.getTime() / 1000)}:R>
      **Candidates**:
      ${candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}`,
    )
    .setColor(0x00ae86)
    .setFooter({
      text: `Poll ID: ${poll.id} | Created by ${interaction.user.tag}`,
    });

  const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("poll:vote_button")
      .setLabel("Vote")
      .setStyle(ButtonStyle.Primary),
  );

  const message = await interaction.reply({
    embeds: [embed],
    components: [button],
    fetchReply: true,
  });
  poll.messageId = message.id;
  await poll.save();
}

async function handleClose(interaction: ChatInputCommandInteraction) {
  const pollId = interaction.options.getString("poll_id", true);
  const poll = await Poll.findOne({
    where: { id: pollId, guildId: interaction.guildId },
  });
  if (!poll) {
    await interaction.reply({ content: "Poll not found.", ephemeral: true });
    return;
  }
  if (poll.status === "closed") {
    await interaction.reply({
      content: "Poll is already closed.",
      ephemeral: true,
    });
    return;
  }

  if (
    poll.creatorId !== interaction.user.id &&
    !interaction.memberPermissions?.has("ManageMessages")
  ) {
    await interaction.reply({
      content: "Only the poll creator or a moderator can close this poll.",
      ephemeral: true,
    });
    return;
  }

  poll.status = "closed";
  await poll.save();

  // Update message
  try {
    const channel = await interaction.client.channels.fetch(poll.channelId);
    if (channel?.isTextBased()) {
      const message = await channel.messages.fetch(poll.messageId);
      const embed = EmbedBuilder.from(message.embeds[0]);
      embed.setDescription(
        `**Seats**: ${poll.seats}
        **Status**: :red_circle: Closed (manual)
        **Closes**: <t:${Math.floor(poll.closeAt.getTime() / 1000)}:R>`,
      );
      await message.edit({ embeds: [embed], components: [] });
    }
  } catch {
    // ignore
  }

  await interaction.reply({
    content: `Poll "${poll.title}" has been closed.`,
    ephemeral: true,
  });
}

async function handleResults(interaction: ChatInputCommandInteraction) {
  const pollId = interaction.options.getString("poll_id", true);
  const poll = await Poll.findOne({
    where: { id: pollId, guildId: interaction.guildId },
  });
  if (!poll) {
    await interaction.reply({ content: "Poll not found.", ephemeral: true });
    return;
  }

  const candidates = await Candidate.findAll({
    where: { pollId: poll.id },
    order: [["index", "ASC"]],
  });
  const votes = await Vote.findAll({ where: { pollId: poll.id } });

  if (votes.length === 0) {
    await interaction.reply({ content: "No votes cast yet.", ephemeral: true });
    return;
  }

  const candidateIds = candidates.map((c) => c.id);
  const votesData = votes.map((v) => ({
    ranking: v.ranking,
    weight: v.weight,
  }));

  const { elected, rounds } = stv(candidateIds, votesData, poll.seats);

  const idToName = Object.fromEntries(candidates.map((c) => [c.id, c.name]));
  const winners = elected.map((id) => idToName[id]);

  const embed = new EmbedBuilder()
    .setTitle(`Results: ${poll.title}`)
    .setDescription(
      `Seats: ${poll.seats}\nWinners: ${winners.join(", ") || "None"}`,
    )
    .setColor(0x00ae86);

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const countsStr = Object.entries(r.counts)
      .map(([id, count]) => `${idToName[Number(id)]}: ${count.toFixed(2)}`)
      .join("\n");
    embed.addFields({
      name: `Round ${i + 1}`,
      value: `Quota: ${r.quota}\nCounts:\n${countsStr}\nElected: ${r.elected.map((id) => idToName[id]).join(", ") || "None"}\nEliminated: ${r.eliminated.map((id) => idToName[id]).join(", ") || "None"}`,
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const pollId = interaction.options.getString("poll_id", true);
  const poll = await Poll.findOne({
    where: { id: pollId, guildId: interaction.guildId },
  });
  if (!poll) {
    await interaction.reply({ content: "Poll not found.", ephemeral: true });
    return;
  }

  if (
    poll.creatorId !== interaction.user.id &&
    !interaction.memberPermissions?.has("ManageMessages")
  ) {
    await interaction.reply({
      content: "Only the poll creator or a moderator can delete this poll.",
      ephemeral: true,
    });
    return;
  }

  await poll.destroy(); // cascade deletes candidates and votes

  try {
    const channel = await interaction.client.channels.fetch(poll.channelId);
    if (channel?.isTextBased()) {
      const message = await channel.messages.fetch(poll.messageId);
      await message.delete();
    }
  } catch {
    // ignore
  }

  await interaction.reply({
    content: `Poll "${poll.title}" has been deleted.`,
    ephemeral: true,
  });
}

async function handleVoteButton(interaction: ButtonInteraction) {
  const message = interaction.message;
  const poll = await Poll.findOne({
    where: { messageId: message.id, guildId: interaction.guildId },
  });
  if (!poll) {
    await interaction.reply({ content: "Poll not found.", ephemeral: true });
    return;
  }
  if (poll.status !== "open") {
    await interaction.reply({
      content: "This poll is closed.",
      ephemeral: true,
    });
    return;
  }

  const existing = await Vote.findOne({
    where: { pollId: poll.id, userId: interaction.user.id },
  });
  if (existing) {
    await interaction.reply({
      content: "You have already voted in this poll.",
      ephemeral: true,
    });
    return;
  }

  const candidates = await Candidate.findAll({
    where: { pollId: poll.id },
    order: [["index", "ASC"]],
  });
  const candidateNames = candidates
    .map((c) => `${c.index + 1}. ${c.name}`)
    .join("\n");

  const textInput = new TextInputBuilder()
    .setCustomId("ranking")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      `Enter your preferences in order. You can use numbers or just list names.`,
    )
    .setRequired(true);

  const labels = new LabelBuilder()
    .setLabel("Your ranking (e.g. 1: Alice, 2: Bob)")
    .setTextInputComponent(textInput);

  const hint = new TextDisplayBuilder().setContent(candidateNames);

  const modal = new ModalBuilder()
    .setCustomId(`poll:vote_modal_${poll.id}`)
    .setTitle(`Vote in ${poll.title}`)
    .addTextDisplayComponents(hint)
    .addLabelComponents(labels);

  await interaction.showModal(modal);
}

async function handleVoteModal(interaction: ModalSubmitInteraction) {
  const pollId = interaction.customId.split("_")[2];
  const poll = await Poll.findOne({
    where: { id: pollId, guildId: interaction.guildId },
  });
  if (!poll) {
    await interaction.reply({ content: "Poll not found.", ephemeral: true });
    return;
  }
  if (poll.status !== "open") {
    await interaction.reply({
      content: "This poll is closed.",
      ephemeral: true,
    });
    return;
  }

  const existing = await Vote.findOne({
    where: { pollId: poll.id, userId: interaction.user.id },
  });
  if (existing) {
    await interaction.reply({
      content: "You have already voted.",
      ephemeral: true,
    });
    return;
  }

  const rankingText = interaction.fields.getTextInputValue("ranking");
  const candidates = await Candidate.findAll({
    where: { pollId: poll.id },
    order: [["index", "ASC"]],
  });
  const nameToId = Object.fromEntries(
    candidates.map((c) => [c.name.toLowerCase(), c.id]),
  );
  const indexToId = Object.fromEntries(
    candidates.map((c) => [c.index + 1, c.id]),
  );

  const ranking: number[] = [];
  const lines = rankingText
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter((l) => l);
  for (const line of lines) {
    let candId: number | null = null;
    const matchNumber = line.match(/^(\d+)[:.\s]+(.+)$/i);
    if (matchNumber) {
      const num = parseInt(matchNumber[1]);
      const name = matchNumber[2].trim().toLowerCase();
      candId = indexToId[num] || nameToId[name] || null;
    } else {
      const num = parseInt(line);
      if (!isNaN(num)) candId = indexToId[num] || null;
      else candId = nameToId[line.toLowerCase()] || null;
    }
    if (candId && !ranking.includes(candId)) ranking.push(candId);
  }

  if (ranking.length === 0) {
    await interaction.reply({
      content: "No valid preferences found. Please use the format shown.",
      ephemeral: true,
    });
    return;
  }

  await Vote.create({
    pollId: poll.id,
    userId: interaction.user.id,
    ranking,
    weight: 1.0,
  });

  await interaction.reply({
    content: "Your vote has been recorded!",
    ephemeral: true,
  });
}
