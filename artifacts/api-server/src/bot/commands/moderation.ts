import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, GuildMember, PermissionFlagsBits } from "discord.js";
import { db } from "@workspace/db";
import { modLogsTable, warningsTable, serverConfigTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireModerator } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Moderation Commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(s => s.setName("ban").setDescription("Ban a user").addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")).addIntegerOption(o => o.setName("delete_days").setDescription("Delete messages from past X days").setMinValue(0).setMaxValue(7)))
  .addSubcommand(s => s.setName("kick").setDescription("Kick a user").addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")))
  .addSubcommand(s => s.setName("timeout").setDescription("Timeout a user").addUserOption(o => o.setName("user").setDescription("User to timeout").setRequired(true)).addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption(o => o.setName("reason").setDescription("Reason")))
  .addSubcommand(s => s.setName("warn").setDescription("Warn a user").addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)))
  .addSubcommand(s => s.setName("warnings").setDescription("View warnings for a user").addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true)))
  .addSubcommand(s => s.setName("clearwarnings").setDescription("Clear warnings for a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("purge").setDescription("Delete multiple messages").addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)).addUserOption(o => o.setName("user").setDescription("Only delete messages from this user")))
  .addSubcommand(s => s.setName("unban").setDescription("Unban a user").addStringOption(o => o.setName("user_id").setDescription("User ID").setRequired(true)));

async function logAction(guildId: string, moderatorId: string, targetId: string, action: any, reason?: string, duration?: number) {
  await db.insert(modLogsTable).values({ guildId, moderatorId, targetId, action, reason, duration });
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!await requireModerator(interaction)) return;
  if (!interaction.guild || !interaction.guildId) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "ban") {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") || "No reason provided";
    const deleteDays = interaction.options.getInteger("delete_days") || 0;
    try {
      await interaction.guild.members.ban(target.id, { reason, deleteMessageDays: deleteDays as any });
      await logAction(interaction.guildId!, interaction.user.id, target.id, "ban", reason);
      await interaction.reply({ embeds: [successEmbed("User Banned", `**${target.tag}** has been banned.\n**Reason:** ${reason}`)] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not ban this user. Check bot permissions and role hierarchy.")], ephemeral: true });
    }
  }

  else if (sub === "kick") {
    const target = interaction.options.getMember("user") as GuildMember;
    const reason = interaction.options.getString("reason") || "No reason provided";
    try {
      await target.kick(reason);
      await logAction(interaction.guildId!, interaction.user.id, target.id, "kick", reason);
      await interaction.reply({ embeds: [successEmbed("User Kicked", `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`)] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not kick this user.")], ephemeral: true });
    }
  }

  else if (sub === "timeout") {
    const target = interaction.options.getMember("user") as GuildMember;
    const duration = interaction.options.getInteger("duration", true);
    const reason = interaction.options.getString("reason") || "No reason provided";
    try {
      await target.timeout(duration * 60 * 1000, reason);
      await logAction(interaction.guildId!, interaction.user.id, target.id, "timeout", reason, duration);
      await interaction.reply({ embeds: [successEmbed("User Timed Out", `**${target.user.tag}** has been timed out for **${duration} minutes**.\n**Reason:** ${reason}`)] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not timeout this user.")], ephemeral: true });
    }
  }

  else if (sub === "warn") {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    await db.insert(warningsTable).values({ guildId: interaction.guildId!, discordId: target.id, reason, moderatorId: interaction.user.id });
    const warnCount = await db.select().from(warningsTable).where(and(eq(warningsTable.discordId, target.id), eq(warningsTable.guildId, interaction.guildId!), eq(warningsTable.active, true)));
    try { await target.send({ embeds: [new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`${EMOJIS.WARNING} Warning in ${interaction.guild!.name}`).setDescription(`**Reason:** ${reason}\n\nYou now have **${warnCount.length}** warning(s).`)] }); } catch {}
    await interaction.reply({ embeds: [successEmbed("Warning Issued", `**${target.tag}** has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${warnCount.length}`)] });
  }

  else if (sub === "warnings") {
    const target = interaction.options.getUser("user", true);
    const warns = await db.select().from(warningsTable).where(and(eq(warningsTable.discordId, target.id), eq(warningsTable.guildId, interaction.guildId!), eq(warningsTable.active, true)));
    if (!warns.length) { await interaction.reply({ embeds: [successEmbed("No Warnings", `${target.tag} has no active warnings.`)] }); return; }
    const embed = new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`${EMOJIS.WARNING} Warnings for ${target.tag}`).setDescription(warns.map((w, i) => `**${i + 1}.** ${w.reason}\n*By <@${w.moderatorId}> — ${w.createdAt.toDateString()}*`).join("\n\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "clearwarnings") {
    const target = interaction.options.getUser("user", true);
    await db.update(warningsTable).set({ active: false }).where(and(eq(warningsTable.discordId, target.id), eq(warningsTable.guildId, interaction.guildId!)));
    await interaction.reply({ embeds: [successEmbed("Warnings Cleared", `All warnings for **${target.tag}** have been cleared.`)] });
  }

  else if (sub === "purge") {
    const amount = interaction.options.getInteger("amount", true);
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel as any;
    try {
      let messages = await channel.messages.fetch({ limit: 100 });
      if (targetUser) messages = messages.filter((m: any) => m.author.id === targetUser.id);
      const toDelete = [...messages.values()].slice(0, amount);
      await channel.bulkDelete(toDelete, true);
      await interaction.reply({ embeds: [successEmbed("Messages Purged", `Deleted **${toDelete.length}** messages.`)], ephemeral: true });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not delete messages. Messages older than 14 days cannot be bulk deleted.")], ephemeral: true });
    }
  }

  else if (sub === "unban") {
    const userId = interaction.options.getString("user_id", true);
    try {
      await interaction.guild!.members.unban(userId);
      await logAction(interaction.guildId!, interaction.user.id, userId, "unban");
      await interaction.reply({ embeds: [successEmbed("User Unbanned", `User <@${userId}> has been unbanned.`)] });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not unban this user. Make sure the ID is correct.")], ephemeral: true });
    }
  }
}
