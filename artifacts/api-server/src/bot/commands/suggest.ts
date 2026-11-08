import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "@workspace/db";
import { suggestionsTable, suggestionVotesTable, serverConfigTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireModerator } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Submit a suggestion")
  .addStringOption(o => o.setName("suggestion").setDescription("Your suggestion").setRequired(true).setMaxLength(1000));

export const suggestionsData = new SlashCommandBuilder()
  .setName("suggestions")
  .setDescription("View or manage suggestions")
  .addSubcommand(s => s.setName("list").setDescription("View pending suggestions (Admin)"))
  .addSubcommand(s => s.setName("approve").setDescription("Approve a suggestion (Admin)").addIntegerOption(o => o.setName("id").setDescription("Suggestion ID").setRequired(true)).addStringOption(o => o.setName("note").setDescription("Review note")))
  .addSubcommand(s => s.setName("deny").setDescription("Deny a suggestion (Admin)").addIntegerOption(o => o.setName("id").setDescription("Suggestion ID").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")))
  .addSubcommand(s => s.setName("implement").setDescription("Mark suggestion as implemented (Admin)").addIntegerOption(o => o.setName("id").setDescription("Suggestion ID").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guildId) return;
  const content = interaction.options.getString("suggestion", true);
  
  const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, interaction.guildId)).limit(1);
  const channelId = config?.suggestionChannelId;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("suggestion_upvote:PLACEHOLDER").setLabel("👍 Upvote").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("suggestion_downvote:PLACEHOLDER").setLabel("👎 Downvote").setStyle(ButtonStyle.Danger),
  );

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.PENCIL} New Suggestion`)
    .setDescription(content)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .addFields({ name: "Status", value: "⏳ Pending Review" })
    .setTimestamp();

  const [suggestion] = await db.insert(suggestionsTable).values({ guildId: interaction.guildId, authorId: interaction.user.id, content, channelId: channelId || interaction.channelId }).returning();

  const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suggestion_upvote:${suggestion!.id}`).setLabel("👍 Upvote (0)").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`suggestion_downvote:${suggestion!.id}`).setLabel("👎 Downvote (0)").setStyle(ButtonStyle.Danger),
  );

  if (channelId) {
    const channel = interaction.guild!.channels.cache.get(channelId) as any;
    if (channel) {
      const msg = await channel.send({ embeds: [embed], components: [realRow] });
      await db.update(suggestionsTable).set({ messageId: msg.id }).where(eq(suggestionsTable.id, suggestion!.id));
    }
    await interaction.reply({ embeds: [successEmbed("Suggestion Submitted!", `Your suggestion has been sent to the suggestions channel! (ID: #${suggestion!.id})`)], ephemeral: true });
  } else {
    const msg = await interaction.reply({ embeds: [embed], components: [realRow], fetchReply: true });
    await db.update(suggestionsTable).set({ messageId: msg.id }).where(eq(suggestionsTable.id, suggestion!.id));
  }
}

export async function executeSuggestions(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!await requireModerator(interaction)) return;
  if (!interaction.guildId) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "list") {
    const suggestions = await db.select().from(suggestionsTable).where(and(eq(suggestionsTable.guildId, interaction.guildId), eq(suggestionsTable.status, "pending"))).orderBy(desc(suggestionsTable.createdAt)).limit(10);
    if (!suggestions.length) { await interaction.reply({ embeds: [successEmbed("No Pending", "No pending suggestions!")] }); return; }
    const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle(`${EMOJIS.PENCIL} Pending Suggestions`).setDescription(suggestions.map(s => `**#${s.id}** by <@${s.authorId}>: ${s.content.substring(0, 100)}${s.content.length > 100 ? "..." : ""}\n👍 ${s.upvotes} | 👎 ${s.downvotes}`).join("\n\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  } else if (sub === "approve" || sub === "deny" || sub === "implement") {
    const id = interaction.options.getInteger("id", true);
    const note = interaction.options.getString("note") || interaction.options.getString("reason");
    const status = sub === "approve" ? "approved" : sub === "deny" ? "denied" : "implemented";
    const [s] = await db.update(suggestionsTable).set({ status, reviewedBy: interaction.user.id, reviewNote: note || undefined, updatedAt: new Date() }).where(eq(suggestionsTable.id, id)).returning();
    if (!s) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No suggestion #${id}`)], ephemeral: true }); return; }
    
    // Update the message if possible
    if (s.channelId && s.messageId) {
      try {
        const ch = interaction.guild!.channels.cache.get(s.channelId) as any;
        const msg = await ch?.messages.fetch(s.messageId);
        const statusMap = { approved: "✅ Approved", denied: "❌ Denied", implemented: "🚀 Implemented" };
        const colorMap = { approved: COLORS.SUCCESS, denied: COLORS.ERROR, implemented: COLORS.GOLD };
        const updated = EmbedBuilder.from(msg.embeds[0]).setColor((colorMap as any)[status]).spliceFields(-1, 1, { name: "Status", value: `${(statusMap as any)[status]}${note ? ` — ${note}` : ""}` });
        await msg.edit({ embeds: [updated], components: [] });
      } catch {}
    }
    await interaction.reply({ embeds: [successEmbed(`Suggestion ${status.charAt(0).toUpperCase() + status.slice(1)}`, `Suggestion #${id} has been ${status}.`)] });
  }
}
