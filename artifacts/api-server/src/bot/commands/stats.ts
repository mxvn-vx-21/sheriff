import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { usersTable, tournamentsTable, dexEntriesTable, mediaLibraryTable, articlesTable, instructionsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("View bot and server statistics")
  .addSubcommand(s => s.setName("bot").setDescription("View global bot stats"))
  .addSubcommand(s => s.setName("server").setDescription("View this server's stats"));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();

  if (sub === "bot") {
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [dexCount] = await db.select({ count: sql<number>`count(*)` }).from(dexEntriesTable);
    const [mediaCount] = await db.select({ count: sql<number>`count(*)` }).from(mediaLibraryTable);
    const [articleCount] = await db.select({ count: sql<number>`count(*)` }).from(articlesTable);
    const [instructionCount] = await db.select({ count: sql<number>`count(*)` }).from(instructionsTable);

    const embed = new EmbedBuilder()
      .setColor(COLORS.SMASH)
      .setTitle("⚔️ Smash Knights — Bot Statistics")
      .setThumbnail(client.user!.displayAvatarURL())
      .addFields(
        { name: "🖥️ Servers", value: `**${client.guilds.cache.size}**`, inline: true },
        { name: "👥 Total Users", value: `**${Number(userCount?.count || 0).toLocaleString()}**`, inline: true },
        { name: "⏱️ Uptime", value: `<t:${Math.floor((Date.now() - client.uptime!) / 1000)}:R>`, inline: true },
        { name: "📚 Dex Entries", value: `**${Number(dexCount?.count || 0)}**`, inline: true },
        { name: "🎬 Media", value: `**${Number(mediaCount?.count || 0)}**`, inline: true },
        { name: "📖 Articles", value: `**${Number(articleCount?.count || 0)}**`, inline: true },
        { name: "🎥 Instructions", value: `**${Number(instructionCount?.count || 0)}**`, inline: true },
        { name: "📡 Ping", value: `**${client.ws.ping}ms**`, inline: true },
        { name: "Node.js", value: `**${process.version}**`, inline: true },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  else if (sub === "server") {
    const guild = interaction.guild!;
    const [tournamentCount] = await db.select({ count: sql<number>`count(*)` }).from(tournamentsTable).where(eq(tournamentsTable.guildId, guild.id));
    const members = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = members - bots;
    const online = guild.members.cache.filter(m => m.presence?.status !== "offline" && !m.user.bot).size;

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.CHART} ${guild.name} — Server Statistics`)
      .setThumbnail(guild.iconURL() || "")
      .addFields(
        { name: "👥 Total Members", value: `**${members.toLocaleString()}**`, inline: true },
        { name: "🟢 Online", value: `**${online}**`, inline: true },
        { name: "🤖 Bots", value: `**${bots}**`, inline: true },
        { name: "📅 Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "👑 Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "💬 Channels", value: `**${guild.channels.cache.size}**`, inline: true },
        { name: "🎭 Roles", value: `**${guild.roles.cache.size}**`, inline: true },
        { name: `${EMOJIS.TROPHY} Tournaments`, value: `**${Number(tournamentCount?.count || 0)}**`, inline: true },
        { name: "🔒 Boost Level", value: `**${guild.premiumTier}** (${guild.premiumSubscriptionCount} boosts)`, inline: true },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
