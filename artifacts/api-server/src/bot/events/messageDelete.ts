import type { Message, PartialMessage } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS } from "../utils/embeds.js";

export async function onMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) return;

  try {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, message.guild.id)).limit(1);
    if (!config?.logChannelId) return;

    const logChannel = message.guild.channels.cache.get(config.logChannelId) as any;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle("🗑️ Message Deleted")
      .setDescription(`**Author:** ${message.author?.tag || "Unknown"}\n**Channel:** <#${message.channelId}>`)
      .addFields({ name: "Content", value: message.content?.substring(0, 1024) || "*Could not retrieve (message was cached)*" })
      .setFooter({ text: `Author ID: ${message.author?.id || "Unknown"}` })
      .setTimestamp();

    if (message.attachments?.size) {
      embed.addFields({ name: "Attachments", value: message.attachments.map(a => a.name).join(", ") });
    }

    await logChannel.send({ embeds: [embed] });
  } catch {}
}
