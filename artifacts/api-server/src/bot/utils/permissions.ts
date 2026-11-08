import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { ADMIN_GUILD_ID } from "../types.js";

export function isOwner(interaction: ChatInputCommandInteraction): boolean {
  if (interaction.guildId !== ADMIN_GUILD_ID) return false;
  const member = interaction.member as GuildMember;
  return member?.permissions?.has("Administrator") ?? false;
}

export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as GuildMember;
  return member?.permissions?.has("Administrator") ?? false;
}

export function isModerator(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as GuildMember;
  return (
    member?.permissions?.has("ManageMessages") ||
    member?.permissions?.has("KickMembers") ||
    member?.permissions?.has("BanMembers") ||
    member?.permissions?.has("Administrator") ||
    false
  );
}

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "❌ You need Administrator permissions to use this command.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export async function requireModerator(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!isModerator(interaction)) {
    await interaction.reply({
      content: "❌ You need Moderator permissions to use this command.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export async function requireOwner(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!isOwner(interaction)) {
    await interaction.reply({
      content: "❌ This command can only be used by owners in the admin server.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}
