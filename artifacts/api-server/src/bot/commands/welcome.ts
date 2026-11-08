import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from "discord.js";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Welcome System")
  .addSubcommand(s => s.setName("setup").setDescription("Set up welcome messages (Admin)").addChannelOption(o => o.setName("channel").setDescription("Welcome channel").setRequired(true)).addStringOption(o => o.setName("message").setDescription("Welcome message. Use {user} for mention, {server} for server name, {count} for member count.")))
  .addSubcommand(s => s.setName("disable").setDescription("Disable welcome messages (Admin)"));

export const goodbyeData = new SlashCommandBuilder()
  .setName("goodbye")
  .setDescription("Goodbye/Leave System")
  .addSubcommand(s => s.setName("setup").setDescription("Set up goodbye messages (Admin)").addChannelOption(o => o.setName("channel").setDescription("Goodbye channel").setRequired(true)).addStringOption(o => o.setName("message").setDescription("Goodbye message. Use {user} for username, {server} for server name.")))
  .addSubcommand(s => s.setName("disable").setDescription("Disable goodbye messages (Admin)"));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!await requireAdmin(interaction)) return;
  if (!interaction.guildId) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message") || "Welcome to **{server}**, {user}! 🎉 You are member #{count}.";
    await db.insert(serverConfigTable).values({ guildId: interaction.guildId, welcomeChannelId: channel.id, welcomeMessage: message }).onConflictDoUpdate({ target: serverConfigTable.guildId, set: { welcomeChannelId: channel.id, welcomeMessage: message, updatedAt: new Date() } });
    await interaction.reply({ embeds: [successEmbed("Welcome Setup", `Welcome messages will be sent to <#${channel.id}>.\n**Message preview:** ${message.replace("{user}", "@User").replace("{server}", interaction.guild!.name).replace("{count}", String(interaction.guild!.memberCount))}`)] });
  } else {
    await db.insert(serverConfigTable).values({ guildId: interaction.guildId, welcomeChannelId: undefined }).onConflictDoUpdate({ target: serverConfigTable.guildId, set: { welcomeChannelId: undefined, updatedAt: new Date() } });
    await interaction.reply({ embeds: [successEmbed("Welcome Disabled", "Welcome messages have been disabled.")] });
  }
}

export async function executeGoodbye(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!await requireAdmin(interaction)) return;
  if (!interaction.guildId) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message") || "**{user}** has left **{server}**. We'll miss you! 👋";
    await db.insert(serverConfigTable).values({ guildId: interaction.guildId, goodbyeChannelId: channel.id, goodbyeMessage: message }).onConflictDoUpdate({ target: serverConfigTable.guildId, set: { goodbyeChannelId: channel.id, goodbyeMessage: message, updatedAt: new Date() } });
    await interaction.reply({ embeds: [successEmbed("Goodbye Setup", `Goodbye messages will be sent to <#${channel.id}>.`)] });
  } else {
    await db.insert(serverConfigTable).values({ guildId: interaction.guildId, goodbyeChannelId: undefined }).onConflictDoUpdate({ target: serverConfigTable.guildId, set: { goodbyeChannelId: undefined, updatedAt: new Date() } });
    await interaction.reply({ embeds: [successEmbed("Goodbye Disabled", "Goodbye messages have been disabled.")] });
  }
}
