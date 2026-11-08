import type { GuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, member.guild.id)).limit(1);
    if (!config?.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(config.welcomeChannelId) as any;
    if (!channel) return;

    const message = (config.welcomeMessage || "Welcome to **{server}**, {user}! 🎉 You are member #{count}.")
      .replace("{user}", member.toString())
      .replace("{server}", member.guild.name)
      .replace("{count}", member.guild.memberCount.toString())
      .replace("{username}", member.user.username);

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle("👋 New Member!")
      .setDescription(message)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Member Count", value: `#${member.guild.memberCount}`, inline: true },
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // Log if log channel is set
    if (config.logChannelId) {
      const logChannel = member.guild.channels.cache.get(config.logChannelId) as any;
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle("📥 Member Joined")
          .setDescription(`${member.user.tag} (${member.user.id})`)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in guildMemberAdd handler");
  }
}
