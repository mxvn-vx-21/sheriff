import type { Message, PartialMessage } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS } from "../utils/embeds.js";

export async function onMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  try {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, newMessage.guild.id)).limit(1);
    if (!config?.logChannelId) return;

    const logChannel = newMessage.guild.channels.cache.get(config.logChannelId) as any;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle("✏️ Message Edited")
      .setDescription(`**Author:** ${newMessage.author?.tag || "Unknown"}\n**Channel:** <#${newMessage.channelId}>`)
      .addFields(
        { name: "Before", value: oldMessage.content?.substring(0, 1024) || "*Could not retrieve*" },
        { name: "After", value: newMessage.content?.substring(0, 1024) || "*Could not retrieve*" },
      )
      .setFooter({ text: `Message ID: ${newMessage.id} | Author ID: ${newMessage.author?.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch {}
}
