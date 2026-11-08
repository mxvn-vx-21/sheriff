import type { Client } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { giveawaysTable, giveawayEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { COLORS } from "../utils/embeds.js";

export async function endGiveaway(giveaway: typeof giveawaysTable.$inferSelect, client: Client): Promise<void> {
  const entries = await db.select().from(giveawayEntriesTable).where(eq(giveawayEntriesTable.giveawayId, giveaway.id));
  const shuffled = entries.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(giveaway.winnersCount, shuffled.length)).map(e => e.discordId);

  await db.update(giveawaysTable).set({ status: "ended", winners }).where(eq(giveawaysTable.id, giveaway.id));

  try {
    const guild = client.guilds.cache.get(giveaway.guildId);
    const channel = guild?.channels.cache.get(giveaway.channelId) as any;
    if (!channel) return;

    const endEmbed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`🎉 Giveaway Ended — ${giveaway.prize}`)
      .setDescription(winners.length ? `🏆 **Winner(s):**\n${winners.map(w => `<@${w}>`).join("\n")}` : "😔 No one entered the giveaway!")
      .addFields({ name: "Total Entries", value: `${entries.length}`, inline: true })
      .setTimestamp();

    await channel.send({
      content: winners.length ? `🎉 Congratulations ${winners.map(w => `<@${w}>`).join(" ")}! You won **${giveaway.prize}**!` : undefined,
      embeds: [endEmbed],
    });

    if (giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) {
        const disabledEmbed = EmbedBuilder.from(msg.embeds[0])
          .setTitle(`🎁 [ENDED] ${giveaway.prize}`)
          .setColor(COLORS.INFO)
          .setDescription(`Winners: ${winners.length ? winners.map(w => `<@${w}>`).join(", ") : "None"}`);
        await msg.edit({ embeds: [disabledEmbed], components: [] }).catch(() => {});
      }
    }
  } catch {}
}
