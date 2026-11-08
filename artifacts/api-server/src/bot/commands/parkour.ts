import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { parkourRoutesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { paginateEmbeds } from "../utils/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("parkour")
  .setDescription("SmashKarts Parkour Database")
  .addSubcommand(s => s.setName("add").setDescription("Add a parkour route (Admin)").addStringOption(o => o.setName("map").setDescription("Map name").setRequired(true)).addStringOption(o => o.setName("spot").setDescription("Spot name").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)).addStringOption(o => o.setName("difficulty").setDescription("Difficulty").setRequired(true).addChoices({name:"Beginner",value:"beginner"},{name:"Intermediate",value:"intermediate"},{name:"Advanced",value:"advanced"},{name:"Expert",value:"expert"})).addStringOption(o => o.setName("video").setDescription("Video URL")).addStringOption(o => o.setName("notes").setDescription("Additional notes")))
  .addSubcommand(s => s.setName("edit").setDescription("Edit a parkour route (Admin)").addIntegerOption(o => o.setName("id").setDescription("Route ID").setRequired(true)).addStringOption(o => o.setName("description").setDescription("New description")).addStringOption(o => o.setName("notes").setDescription("New notes")).addStringOption(o => o.setName("video").setDescription("New video URL")))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a parkour route (Admin)").addIntegerOption(o => o.setName("id").setDescription("Route ID").setRequired(true)))
  .addSubcommand(s => s.setName("view").setDescription("View a parkour route").addIntegerOption(o => o.setName("id").setDescription("Route ID").setRequired(true)))
  .addSubcommand(s => s.setName("search").setDescription("Search parkour routes").addStringOption(o => o.setName("query").setDescription("Map or spot name").setRequired(true)));

function buildParkourEmbed(r: typeof parkourRoutesTable.$inferSelect): EmbedBuilder {
  const diffColors: Record<string, number> = { beginner: 0x57F287, intermediate: 0xFEE75C, advanced: 0xED4245, expert: 0x9B59B6 };
  const embed = new EmbedBuilder()
    .setColor((diffColors[r.difficulty] || COLORS.PRIMARY) as any)
    .setTitle(`${EMOJIS.PARKOUR} ${r.spotName}`)
    .setDescription(r.description)
    .addFields(
      { name: "🗺️ Map", value: r.mapName, inline: true },
      { name: "⚡ Difficulty", value: r.difficulty.charAt(0).toUpperCase() + r.difficulty.slice(1), inline: true },
    )
    .setFooter({ text: `ID: ${r.id}` })
    .setTimestamp();
  if (r.videoUrl) embed.addFields({ name: "🎬 Tutorial", value: `[Watch here](${r.videoUrl})` });
  if (r.notes) embed.addFields({ name: "📝 Notes", value: r.notes });
  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    if (!await requireAdmin(interaction)) return;
    const [r] = await db.insert(parkourRoutesTable).values({
      mapName: interaction.options.getString("map", true),
      spotName: interaction.options.getString("spot", true),
      description: interaction.options.getString("description", true),
      difficulty: interaction.options.getString("difficulty", true) as any,
      videoUrl: interaction.options.getString("video") || undefined,
      notes: interaction.options.getString("notes") || undefined,
      createdBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Parkour Route Added", `**${r!.spotName}** on **${r!.mapName}** added! (ID: ${r!.id})`)] });
  }

  else if (sub === "edit") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const updates: any = { updatedAt: new Date() };
    const desc = interaction.options.getString("description");
    const notes = interaction.options.getString("notes");
    const video = interaction.options.getString("video");
    if (desc) updates.description = desc;
    if (notes) updates.notes = notes;
    if (video) updates.videoUrl = video;
    const [updated] = await db.update(parkourRoutesTable).set(updates).where(eq(parkourRoutesTable.id, id)).returning();
    if (!updated) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No route with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Route Updated", `**${updated.spotName}** has been updated.`)] });
  }

  else if (sub === "delete") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [deleted] = await db.delete(parkourRoutesTable).where(eq(parkourRoutesTable.id, id)).returning();
    if (!deleted) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No route with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Route Deleted", `**${deleted.spotName}** removed.`)] });
  }

  else if (sub === "view") {
    const id = interaction.options.getInteger("id", true);
    const [r] = await db.select().from(parkourRoutesTable).where(eq(parkourRoutesTable.id, id)).limit(1);
    if (!r) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No route with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [buildParkourEmbed(r)] });
  }

  else if (sub === "search") {
    const query = interaction.options.getString("query", true);
    const routes = await db.select().from(parkourRoutesTable).where(or(ilike(parkourRoutesTable.mapName, `%${query}%`), ilike(parkourRoutesTable.spotName, `%${query}%`))).limit(10);
    if (!routes.length) { await interaction.reply({ embeds: [errorEmbed("No Results", `No parkour routes found for **${query}**`)], ephemeral: true }); return; }
    await paginateEmbeds(interaction, routes.map(buildParkourEmbed));
  }
}
