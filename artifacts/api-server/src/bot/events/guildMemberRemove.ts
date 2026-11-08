import type { GuildMember, PartialGuildMember } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  try {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, member.guild.id)).limit(1);

    if (config?.goodbyeChannelId) {
      const channel = member.guild.channels.cache.get(config.goodbyeChannelId) as any;
      if (channel) {
        const message = (config.goodbyeMessage || "**{user}** has left **{server}**. We'll miss you! 👋")
          .replace("{user}", member.user?.username || "Unknown")
          .replace("{server}", member.guild.name);

        const embed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle("👋 Member Left")
          .setDescription(message)
          .setThumbnail(member.user?.displayAvatarURL() || "")
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }

    if (config?.logChannelId) {
      const logChannel = member.guild.channels.cache.get(config.logChannelId) as any;
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle("📤 Member Left")
          .setDescription(`${member.user?.tag || "Unknown"} (${member.id})`)
          .setThumbnail(member.user?.displayAvatarURL() || "")
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in guildMemberRemove handler");
  }
}
