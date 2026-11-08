import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { mediaLibraryTable, mediaChannelsTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { paginateEmbeds } from "../utils/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("media")
  .setDescription("SmashKarts Media Library")
  .addSubcommand(s => s.setName("add").setDescription("Add media (Admin)").addStringOption(o => o.setName("title").setDescription("Title").setRequired(true)).addStringOption(o => o.setName("link").setDescription("URL/Link").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Description")).addStringOption(o => o.setName("creator").setDescription("Creator name")).addStringOption(o => o.setName("tags").setDescription("Tags (comma-separated)")))
  .addSubcommand(s => s.setName("remove").setDescription("Remove media (Admin)").addIntegerOption(o => o.setName("id").setDescription("Media ID").setRequired(true)))
  .addSubcommand(s => s.setName("search").setDescription("Search media").addStringOption(o => o.setName("query").setDescription("Search query").setRequired(true)))
  .addSubcommand(s => s.setName("random").setDescription("Get random media"))
  .addSubcommand(s => s.setName("latest").setDescription("Latest media entries"))
  .addSubcommand(s => s.setName("channel").setDescription("Set YouTube auto-post channel (Admin)").addChannelOption(o => o.setName("channel").setDescription("Channel to post new SmashKarts videos").setRequired(true)));

function buildMediaEmbed(m: typeof mediaLibraryTable.$inferSelect): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.SMASH)
    .setTitle(`${EMOJIS.VIDEO} ${m.title}`)
    .setDescription(m.description || "No description")
    .addFields(
      { name: "🔗 Link", value: `[Watch/View](${m.link})`, inline: true },
      { name: "👤 Creator", value: m.creator || "Unknown", inline: true },
      { name: "🏷️ Tags", value: m.tags.length ? m.tags.join(", ") : "None", inline: true },
    )
    .setFooter({ text: `ID: ${m.id}` })
    .setTimestamp(m.createdAt);
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    if (!await requireAdmin(interaction)) return;
    const [m] = await db.insert(mediaLibraryTable).values({
      title: interaction.options.getString("title", true),
      link: interaction.options.getString("link", true),
      description: interaction.options.getString("description") || undefined,
      creator: interaction.options.getString("creator") || undefined,
      tags: interaction.options.getString("tags")?.split(",").map(t => t.trim()).filter(Boolean) || [],
      addedBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Media Added", `**${m!.title}** has been added to the library! (ID: ${m!.id})`)] });
  }

  else if (sub === "remove") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [deleted] = await db.delete(mediaLibraryTable).where(eq(mediaLibraryTable.id, id)).returning();
    if (!deleted) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No media with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Media Removed", `**${deleted.title}** has been removed.`)] });
  }

  else if (sub === "search") {
    const query = interaction.options.getString("query", true);
    const results = await db.select().from(mediaLibraryTable).where(or(ilike(mediaLibraryTable.title, `%${query}%`), ilike(mediaLibraryTable.creator || "", `%${query}%`))).limit(10);
    if (!results.length) { await interaction.reply({ embeds: [errorEmbed("No Results", `No media found for **${query}**`)], ephemeral: true }); return; }
    await paginateEmbeds(interaction, results.map(buildMediaEmbed));
  }

  else if (sub === "random") {
    const [m] = await db.select().from(mediaLibraryTable).orderBy(sql`RANDOM()`).limit(1);
    if (!m) { await interaction.reply({ embeds: [errorEmbed("Empty Library", "No media entries yet.")], ephemeral: true }); return; }
    await interaction.reply({ embeds: [buildMediaEmbed(m)] });
  }

  else if (sub === "latest") {
    const results = await db.select().from(mediaLibraryTable).orderBy(sql`created_at DESC`).limit(5);
    if (!results.length) { await interaction.reply({ embeds: [errorEmbed("Empty Library", "No media entries yet.")], ephemeral: true }); return; }
    await paginateEmbeds(interaction, results.map(buildMediaEmbed));
  }

  else if (sub === "channel") {
    if (!await requireAdmin(interaction)) return;
    if (!interaction.guildId) return;
    const channel = interaction.options.getChannel("channel", true);
    await db.insert(mediaChannelsTable).values({ guildId: interaction.guildId, channelId: channel.id }).onConflictDoUpdate({ target: mediaChannelsTable.guildId, set: { channelId: channel.id } });
    await interaction.reply({ embeds: [successEmbed("Channel Set", `New SmashKarts YouTube videos will be posted to <#${channel.id}>`)] });
  }
}
