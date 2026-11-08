import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { articlesTable, instructionsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { paginateEmbeds } from "../utils/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("article")
  .setDescription("Knowledge Base")
  .addSubcommand(s => s.setName("add").setDescription("Add an article (Admin)").addStringOption(o => o.setName("title").setDescription("Article title").setRequired(true)).addStringOption(o => o.setName("content").setDescription("Article content").setRequired(true)).addStringOption(o => o.setName("category").setDescription("Category")).addStringOption(o => o.setName("tags").setDescription("Tags (comma-separated)")))
  .addSubcommand(s => s.setName("view").setDescription("View an article").addIntegerOption(o => o.setName("id").setDescription("Article ID").setRequired(true)))
  .addSubcommand(s => s.setName("search").setDescription("Search articles").addStringOption(o => o.setName("query").setDescription("Search query").setRequired(true)));

export const instructionData = new SlashCommandBuilder()
  .setName("instruction")
  .setDescription("Video Tutorial Database")
  .addSubcommand(s => s.setName("add").setDescription("Add a tutorial (Admin)").addStringOption(o => o.setName("name").setDescription("Tutorial name").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)).addStringOption(o => o.setName("video").setDescription("Video URL").setRequired(true)).addStringOption(o => o.setName("category").setDescription("Category")).addStringOption(o => o.setName("notes").setDescription("Additional notes")))
  .addSubcommand(s => s.setName("edit").setDescription("Edit a tutorial (Admin)").addIntegerOption(o => o.setName("id").setDescription("Tutorial ID").setRequired(true)).addStringOption(o => o.setName("description").setDescription("New description")).addStringOption(o => o.setName("notes").setDescription("New notes")))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a tutorial (Admin)").addIntegerOption(o => o.setName("id").setDescription("Tutorial ID").setRequired(true)))
  .addSubcommand(s => s.setName("view").setDescription("View a tutorial").addIntegerOption(o => o.setName("id").setDescription("Tutorial ID").setRequired(true)))
  .addSubcommand(s => s.setName("search").setDescription("Search tutorials").addStringOption(o => o.setName("query").setDescription("Search query").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    if (!await requireAdmin(interaction)) return;
    const [a] = await db.insert(articlesTable).values({
      title: interaction.options.getString("title", true),
      content: interaction.options.getString("content", true),
      category: interaction.options.getString("category") || "general",
      tags: interaction.options.getString("tags")?.split(",").map(t => t.trim()).filter(Boolean) || [],
      authorId: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Article Added", `Article **${a!.title}** added to the knowledge base! (ID: ${a!.id})`)] });
  } else if (sub === "view") {
    const id = interaction.options.getInteger("id", true);
    const [a] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
    if (!a) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No article #${id}`)], ephemeral: true }); return; }
    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle(`📖 ${a.title}`).setDescription(a.content.substring(0, 4096)).addFields({ name: "📁 Category", value: a.category, inline: true }, { name: "🏷️ Tags", value: a.tags.length ? a.tags.join(", ") : "None", inline: true }).setFooter({ text: `ID: ${a.id}` }).setTimestamp(a.createdAt);
    await interaction.reply({ embeds: [embed] });
  } else if (sub === "search") {
    const query = interaction.options.getString("query", true);
    const results = await db.select().from(articlesTable).where(or(ilike(articlesTable.title, `%${query}%`), ilike(articlesTable.content, `%${query}%`))).limit(5);
    if (!results.length) { await interaction.reply({ embeds: [errorEmbed("No Results", `No articles found for **${query}**`)], ephemeral: true }); return; }
    const embeds = results.map(a => new EmbedBuilder().setColor(COLORS.INFO).setTitle(`📖 ${a.title}`).setDescription(a.content.substring(0, 300) + "...").addFields({ name: "Category", value: a.category, inline: true }).setFooter({ text: `ID: ${a.id} | Use /article view id:${a.id} for full article` }).setTimestamp(a.createdAt));
    await paginateEmbeds(interaction, embeds);
  }
}

export async function executeInstruction(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    if (!await requireAdmin(interaction)) return;
    const [i] = await db.insert(instructionsTable).values({
      name: interaction.options.getString("name", true),
      description: interaction.options.getString("description", true),
      videoUrl: interaction.options.getString("video", true),
      category: interaction.options.getString("category") || "general",
      notes: interaction.options.getString("notes") || undefined,
      createdBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Tutorial Added", `**${i!.name}** added to the instruction database! (ID: ${i!.id})`)] });
  } else if (sub === "edit") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const updates: any = { updatedAt: new Date() };
    const desc = interaction.options.getString("description");
    const notes = interaction.options.getString("notes");
    if (desc) updates.description = desc;
    if (notes) updates.notes = notes;
    const [updated] = await db.update(instructionsTable).set(updates).where(eq(instructionsTable.id, id)).returning();
    if (!updated) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tutorial #${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Tutorial Updated", `**${updated.name}** has been updated.`)] });
  } else if (sub === "delete") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [d] = await db.delete(instructionsTable).where(eq(instructionsTable.id, id)).returning();
    if (!d) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tutorial #${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Tutorial Deleted", `**${d.name}** has been removed.`)] });
  } else if (sub === "view") {
    const id = interaction.options.getInteger("id", true);
    const [i] = await db.select().from(instructionsTable).where(eq(instructionsTable.id, id)).limit(1);
    if (!i) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tutorial #${id}`)], ephemeral: true }); return; }
    const embed = new EmbedBuilder().setColor(COLORS.SMASH).setTitle(`${EMOJIS.VIDEO} ${i.name}`).setDescription(i.description).addFields({ name: "📁 Category", value: i.category, inline: true }, { name: "🎬 Video Tutorial", value: `[Watch here](${i.videoUrl})` });
    if (i.notes) embed.addFields({ name: "📝 Notes", value: i.notes });
    embed.setFooter({ text: `ID: ${i.id}` }).setTimestamp(i.createdAt);
    await interaction.reply({ embeds: [embed] });
  } else if (sub === "search") {
    const query = interaction.options.getString("query", true);
    const results = await db.select().from(instructionsTable).where(or(ilike(instructionsTable.name, `%${query}%`), ilike(instructionsTable.description, `%${query}%`))).limit(5);
    if (!results.length) { await interaction.reply({ embeds: [errorEmbed("No Results", `No tutorials found for **${query}**`)], ephemeral: true }); return; }
    const embeds = results.map(i => new EmbedBuilder().setColor(COLORS.SMASH).setTitle(`${EMOJIS.VIDEO} ${i.name}`).setDescription(i.description.substring(0, 200)).addFields({ name: "Category", value: i.category, inline: true }, { name: "Video", value: `[Watch](${i.videoUrl})`, inline: true }).setFooter({ text: `ID: ${i.id}` }));
    await paginateEmbeds(interaction, embeds);
  }
}
