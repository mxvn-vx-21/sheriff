import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { db } from "@workspace/db";
import { dexEntriesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, smashEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { paginateEmbeds } from "../utils/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("dex")
  .setDescription("SmashKarts Encyclopedia")
  .addSubcommand(s => s.setName("add").setDescription("Add a new dex entry (Admin only)").addStringOption(o => o.setName("name").setDescription("Entry name").setRequired(true)).addStringOption(o => o.setName("category").setDescription("Category").setRequired(true).addChoices({name:"Weapons",value:"weapons"},{name:"Maps",value:"maps"},{name:"Parkour",value:"parkour"},{name:"Strategies",value:"strategies"},{name:"Techniques",value:"techniques"},{name:"Tournaments",value:"tournaments"},{name:"Clans",value:"clans"},{name:"Other",value:"other"})).addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)).addStringOption(o => o.setName("difficulty").setDescription("Difficulty").addChoices({name:"Beginner",value:"beginner"},{name:"Intermediate",value:"intermediate"},{name:"Advanced",value:"advanced"},{name:"Expert",value:"expert"})).addStringOption(o => o.setName("tips").setDescription("Tips (comma-separated)")).addStringOption(o => o.setName("tags").setDescription("Tags (comma-separated)")).addStringOption(o => o.setName("images").setDescription("Image URLs (comma-separated)")).addStringOption(o => o.setName("videos").setDescription("Video URLs (comma-separated)")))
  .addSubcommand(s => s.setName("edit").setDescription("Edit a dex entry (Admin only)").addIntegerOption(o => o.setName("id").setDescription("Entry ID").setRequired(true)).addStringOption(o => o.setName("description").setDescription("New description")).addStringOption(o => o.setName("tips").setDescription("New tips (comma-separated)")).addStringOption(o => o.setName("tags").setDescription("New tags (comma-separated)")))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a dex entry (Admin only)").addIntegerOption(o => o.setName("id").setDescription("Entry ID").setRequired(true)))
  .addSubcommand(s => s.setName("search").setDescription("Search dex entries").addStringOption(o => o.setName("query").setDescription("Search query").setRequired(true)))
  .addSubcommand(s => s.setName("random").setDescription("Get a random dex entry"))
  .addSubcommand(s => s.setName("list").setDescription("List all dex entries").addStringOption(o => o.setName("category").setDescription("Filter by category").addChoices({name:"Weapons",value:"weapons"},{name:"Maps",value:"maps"},{name:"Parkour",value:"parkour"},{name:"Strategies",value:"strategies"},{name:"Techniques",value:"techniques"},{name:"Tournaments",value:"tournaments"},{name:"Clans",value:"clans"},{name:"Other",value:"other"})));

function buildDexEmbed(entry: typeof dexEntriesTable.$inferSelect): EmbedBuilder {
  const embed = smashEmbed(`${entry.name}`, entry.description)
    .addFields(
      { name: "📁 Category", value: entry.category, inline: true },
      { name: "⚡ Difficulty", value: entry.difficulty, inline: true },
      { name: "🏷️ Tags", value: entry.tags.length ? entry.tags.join(", ") : "None", inline: true },
    );
  if (entry.tips.length) embed.addFields({ name: "💡 Tips", value: entry.tips.map(t => `• ${t}`).join("\n") });
  if (entry.images.length) embed.setImage(entry.images[0]!);
  if (entry.videos.length) embed.addFields({ name: "🎬 Videos", value: entry.videos.map(v => `[Watch](${v})`).join(" | ") });
  embed.setFooter({ text: `ID: ${entry.id}` });
  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    if (!await requireAdmin(interaction)) return;
    const name = interaction.options.getString("name", true);
    const category = interaction.options.getString("category", true) as any;
    const description = interaction.options.getString("description", true);
    const difficulty = (interaction.options.getString("difficulty") || "beginner") as any;
    const tips = interaction.options.getString("tips")?.split(",").map(t => t.trim()).filter(Boolean) || [];
    const tags = interaction.options.getString("tags")?.split(",").map(t => t.trim()).filter(Boolean) || [];
    const images = interaction.options.getString("images")?.split(",").map(t => t.trim()).filter(Boolean) || [];
    const videos = interaction.options.getString("videos")?.split(",").map(t => t.trim()).filter(Boolean) || [];

    const [entry] = await db.insert(dexEntriesTable).values({ name, category, description, difficulty, tips, tags, images, videos, createdBy: interaction.user.id }).returning();
    await interaction.reply({ embeds: [successEmbed("Dex Entry Added", `**${name}** has been added to the SmashKarts Dex! (ID: ${entry!.id})`)] });
  }

  else if (sub === "edit") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const updates: Partial<typeof dexEntriesTable.$inferInsert> = { updatedAt: new Date() };
    const desc = interaction.options.getString("description");
    const tips = interaction.options.getString("tips");
    const tags = interaction.options.getString("tags");
    if (desc) updates.description = desc;
    if (tips) updates.tips = tips.split(",").map(t => t.trim()).filter(Boolean);
    if (tags) updates.tags = tags.split(",").map(t => t.trim()).filter(Boolean);
    const [updated] = await db.update(dexEntriesTable).set(updates).where(eq(dexEntriesTable.id, id)).returning();
    if (!updated) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No dex entry with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Entry Updated", `**${updated.name}** has been updated.`)] });
  }

  else if (sub === "delete") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [deleted] = await db.delete(dexEntriesTable).where(eq(dexEntriesTable.id, id)).returning();
    if (!deleted) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No dex entry with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Entry Deleted", `**${deleted.name}** has been removed from the dex.`)] });
  }

  else if (sub === "search") {
    const query = interaction.options.getString("query", true);
    const entries = await db.select().from(dexEntriesTable).where(or(ilike(dexEntriesTable.name, `%${query}%`), ilike(dexEntriesTable.description, `%${query}%`))).limit(10);
    if (!entries.length) { await interaction.reply({ embeds: [errorEmbed("No Results", `No dex entries found for **${query}**`)], ephemeral: true }); return; }
    const embeds = entries.map(buildDexEmbed);
    await paginateEmbeds(interaction, embeds);
  }

  else if (sub === "random") {
    const [entry] = await db.select().from(dexEntriesTable).orderBy(sql`RANDOM()`).limit(1);
    if (!entry) { await interaction.reply({ embeds: [errorEmbed("Empty Dex", "No entries yet. Admins can add entries with `/dex add`.")], ephemeral: true }); return; }
    await interaction.reply({ embeds: [buildDexEmbed(entry)] });
  }

  else if (sub === "list") {
    const category = interaction.options.getString("category") as any;
    const entries = category
      ? await db.select().from(dexEntriesTable).where(eq(dexEntriesTable.category, category))
      : await db.select().from(dexEntriesTable);
    if (!entries.length) { await interaction.reply({ embeds: [errorEmbed("Empty", "No dex entries found.")], ephemeral: true }); return; }
    const CHUNK = 10;
    const embeds: EmbedBuilder[] = [];
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      const embed = new EmbedBuilder().setColor(COLORS.SMASH).setTitle(`⚔️ SmashKarts Dex${category ? ` — ${category}` : ""}`).setDescription(chunk.map(e => `**${e.id}.** ${EMOJIS.STAR} **${e.name}** *(${e.category}, ${e.difficulty})*`).join("\n")).setTimestamp();
      embeds.push(embed);
    }
    await paginateEmbeds(interaction, embeds);
  }
}
