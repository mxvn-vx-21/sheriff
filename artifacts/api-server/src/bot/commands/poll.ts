import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "@workspace/db";
import { pollsTable, pollVotesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin, requireModerator } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS } from "../utils/embeds.js";

function buildPollEmbed(poll: typeof pollsTable.$inferSelect, votes: { optionIndex: number; count: number }[]): EmbedBuilder {
  const totalVotes = votes.reduce((a, b) => a + Number(b.count), 0);
  const embed = new EmbedBuilder()
    .setColor(poll.status === "active" ? COLORS.PRIMARY : COLORS.INFO)
    .setTitle(`📊 ${poll.question}`)
    .setTimestamp();

  const desc = poll.options.map((opt, i) => {
    const voteObj = votes.find(v => v.optionIndex === i);
    const count = voteObj ? Number(voteObj.count) : 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    return `**${i + 1}.** ${opt}\n\`${bar}\` ${count} votes (${pct}%)`;
  }).join("\n\n");

  embed.setDescription(desc);
  embed.setFooter({ text: `${totalVotes} total votes | Status: ${poll.status}` });
  return embed;
}

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Poll System")
  .addSubcommand(s => s.setName("create").setDescription("Create a poll (Moderator)").addStringOption(o => o.setName("question").setDescription("Poll question").setRequired(true)).addStringOption(o => o.setName("options").setDescription("Options separated by | (2-10)").setRequired(true)).addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes (0 = no timer)")).addChannelOption(o => o.setName("channel").setDescription("Channel to post poll")))
  .addSubcommand(s => s.setName("close").setDescription("Close a poll (Moderator)").addIntegerOption(o => o.setName("id").setDescription("Poll ID").setRequired(true)))
  .addSubcommand(s => s.setName("results").setDescription("View poll results").addIntegerOption(o => o.setName("id").setDescription("Poll ID").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") {
    if (!await requireModerator(interaction)) return;
    if (!interaction.guildId) return;

    const question = interaction.options.getString("question", true);
    const optionsRaw = interaction.options.getString("options", true);
    const options = optionsRaw.split("|").map(o => o.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 10) {
      await interaction.reply({ embeds: [errorEmbed("Invalid Options", "Please provide 2-10 options separated by |")], ephemeral: true }); return;
    }

    const channelOpt = interaction.options.getChannel("channel");
    const channelId = channelOpt?.id || interaction.channelId;
    const duration = interaction.options.getInteger("duration");
    const endsAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;

    const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(`📊 ${question}`)
      .setDescription(options.map((o, i) => `**${i + 1}.** ${o}`).join("\n"))
      .setFooter({ text: endsAt ? `Ends at ${endsAt.toUTCString()}` : "No time limit" }).setTimestamp();

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < options.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...options.slice(i, i + 5).map((_, j) => new ButtonBuilder().setCustomId(`poll_vote:PLACEHOLDER:${i + j}`).setLabel(`${i + j + 1}. ${options[i + j]!.substring(0, 40)}`).setStyle(ButtonStyle.Primary))
      );
      rows.push(row);
    }

    const channel = (channelOpt ? interaction.guild!.channels.cache.get(channelId) : interaction.channel) as any;
    const msg = await channel.send({ embeds: [embed], components: rows });

    const [poll] = await db.insert(pollsTable).values({ guildId: interaction.guildId, channelId, messageId: msg.id, question, options, createdBy: interaction.user.id, endsAt }).returning();

    // Update buttons with real poll ID
    const realRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < options.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...options.slice(i, i + 5).map((_, j) => new ButtonBuilder().setCustomId(`poll_vote:${poll!.id}:${i + j}`).setLabel(`${i + j + 1}. ${options[i + j]!.substring(0, 40)}`).setStyle(ButtonStyle.Primary))
      );
      realRows.push(row);
    }
    await msg.edit({ components: realRows });
    await interaction.reply({ embeds: [successEmbed("Poll Created!", `Poll **"${question}"** has been posted in <#${channelId}>! (ID: ${poll!.id})`)], ephemeral: true });

    if (endsAt && duration) {
      setTimeout(async () => {
        await db.update(pollsTable).set({ status: "closed" }).where(eq(pollsTable.id, poll!.id));
        const voteResults = await db.select({ optionIndex: pollVotesTable.optionIndex, count: sql<number>`count(*)` }).from(pollVotesTable).where(eq(pollVotesTable.pollId, poll!.id)).groupBy(pollVotesTable.optionIndex);
        const closedEmbed = buildPollEmbed({ ...poll!, status: "closed" }, voteResults);
        await msg.edit({ embeds: [closedEmbed], components: [] }).catch(() => {});
      }, duration * 60 * 1000);
    }
  }

  else if (sub === "close") {
    if (!await requireModerator(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [poll] = await db.update(pollsTable).set({ status: "closed" }).where(eq(pollsTable.id, id)).returning();
    if (!poll) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No poll with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Poll Closed", `Poll **"${poll.question}"** has been closed.`)] });
  }

  else if (sub === "results") {
    const id = interaction.options.getInteger("id", true);
    const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, id)).limit(1);
    if (!poll) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No poll with ID ${id}`)], ephemeral: true }); return; }
    const votes = await db.select({ optionIndex: pollVotesTable.optionIndex, count: sql<number>`count(*)` }).from(pollVotesTable).where(eq(pollVotesTable.pollId, id)).groupBy(pollVotesTable.optionIndex);
    await interaction.reply({ embeds: [buildPollEmbed(poll, votes)] });
  }
}
