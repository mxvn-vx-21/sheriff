import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "@workspace/db";
import { giveawaysTable, giveawayEntriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Giveaway System")
  .addSubcommand(s => s.setName("create").setDescription("Create a giveaway (Admin)").addStringOption(o => o.setName("prize").setDescription("Prize description").setRequired(true)).addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes").setRequired(true).setMinValue(1)).addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setMinValue(1).setMaxValue(10)).addChannelOption(o => o.setName("channel").setDescription("Channel (defaults to current)")))
  .addSubcommand(s => s.setName("end").setDescription("End a giveaway early (Admin)").addIntegerOption(o => o.setName("id").setDescription("Giveaway ID").setRequired(true)))
  .addSubcommand(s => s.setName("reroll").setDescription("Reroll a giveaway winner (Admin)").addIntegerOption(o => o.setName("id").setDescription("Giveaway ID").setRequired(true)));

async function rollWinners(giveawayId: number, count: number): Promise<string[]> {
  const entries = await db.select().from(giveawayEntriesTable).where(eq(giveawayEntriesTable.giveawayId, giveawayId));
  if (!entries.length) return [];
  const shuffled = entries.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map(e => e.discordId);
}

async function endGiveaway(giveaway: typeof giveawaysTable.$inferSelect, client: Client): Promise<void> {
  const winners = await rollWinners(giveaway.id, giveaway.winnersCount);
  await db.update(giveawaysTable).set({ status: "ended", winners }).where(eq(giveawaysTable.id, giveaway.id));
  
  try {
    const guild = client.guilds.cache.get(giveaway.guildId);
    const channel = guild?.channels.cache.get(giveaway.channelId) as any;
    if (channel && giveaway.messageId) {
      const endEmbed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`🎉 Giveaway Ended — ${giveaway.prize}`).setDescription(winners.length ? `🏆 Winner(s): ${winners.map(w => `<@${w}>`).join(", ")}` : "No winners — no one entered!").setTimestamp();
      await channel.send({ embeds: [endEmbed], content: winners.length ? `Congratulations ${winners.map(w => `<@${w}>`).join(" ")}! You won **${giveaway.prize}**!` : "No one entered the giveaway." });
    }
  } catch {}
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") {
    if (!await requireAdmin(interaction)) return;
    if (!interaction.guildId) return;
    const prize = interaction.options.getString("prize", true);
    const duration = interaction.options.getInteger("duration", true);
    const winners = interaction.options.getInteger("winners") || 1;
    const channelOpt = interaction.options.getChannel("channel");
    const channelId = channelOpt?.id || interaction.channelId;
    const endAt = new Date(Date.now() + duration * 60 * 1000);

    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`🎉 GIVEAWAY — ${prize}`)
      .setDescription(`Click the button below to enter!\n\n${EMOJIS.CROWN} **Winners:** ${winners}\n${EMOJIS.CLOCK} **Ends:** <t:${Math.floor(endAt.getTime() / 1000)}:R>\n\n**Hosted by:** ${interaction.user}`)
      .setTimestamp(endAt);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`giveaway_enter:PLACEHOLDER`).setLabel("🎉 Enter Giveaway").setStyle(ButtonStyle.Success)
    );

    const channel = (channelOpt ? interaction.guild!.channels.cache.get(channelId) : interaction.channel) as any;
    const msg = await channel.send({ embeds: [embed], components: [row] });
    const [giveaway] = await db.insert(giveawaysTable).values({ guildId: interaction.guildId, channelId, messageId: msg.id, prize, winnersCount: winners, endAt, hostId: interaction.user.id }).returning();
    
    // Update button with real ID
    const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`giveaway_enter:${giveaway!.id}`).setLabel("🎉 Enter Giveaway").setStyle(ButtonStyle.Success)
    );
    await msg.edit({ components: [realRow] });

    // Schedule auto-end
    setTimeout(() => endGiveaway(giveaway!, client), duration * 60 * 1000);
    await interaction.reply({ embeds: [successEmbed("Giveaway Created!", `Giveaway for **${prize}** started in <#${channelId}>! (ID: ${giveaway!.id})`)], ephemeral: true });
  }

  else if (sub === "end") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [giveaway] = await db.select().from(giveawaysTable).where(and(eq(giveawaysTable.id, id), eq(giveawaysTable.status, "active"))).limit(1);
    if (!giveaway) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No active giveaway with ID ${id}`)], ephemeral: true }); return; }
    await endGiveaway(giveaway, client);
    await interaction.reply({ embeds: [successEmbed("Giveaway Ended", `Giveaway #${id} has been ended early.`)] });
  }

  else if (sub === "reroll") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [giveaway] = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, id)).limit(1);
    if (!giveaway) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No giveaway with ID ${id}`)], ephemeral: true }); return; }
    const newWinners = await rollWinners(id, giveaway.winnersCount);
    if (!newWinners.length) { await interaction.reply({ embeds: [errorEmbed("No Entries", "No one entered this giveaway.")], ephemeral: true }); return; }
    await db.update(giveawaysTable).set({ winners: newWinners }).where(eq(giveawaysTable.id, id));
    await interaction.reply({ embeds: [successEmbed("Giveaway Rerolled!", `New winner(s): ${newWinners.map(w => `<@${w}>`).join(", ")}`)] });
  }
}
