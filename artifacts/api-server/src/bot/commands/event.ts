import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "@workspace/db";
import { eventsTable, eventRegistrationsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { addXp, addCoins } from "../utils/xp.js";

export const data = new SlashCommandBuilder()
  .setName("event")
  .setDescription("SmashKarts Events System")
  .addSubcommand(s => s.setName("create").setDescription("Create an event (Admin)").addStringOption(o => o.setName("name").setDescription("Event name").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)).addStringOption(o => o.setName("start").setDescription("Start time (YYYY-MM-DD HH:MM)").setRequired(true)).addIntegerOption(o => o.setName("xp_reward").setDescription("XP reward for participants")).addIntegerOption(o => o.setName("max_participants").setDescription("Max participants")).addChannelOption(o => o.setName("channel").setDescription("Event channel")).addStringOption(o => o.setName("end").setDescription("End time (YYYY-MM-DD HH:MM)")))
  .addSubcommand(s => s.setName("list").setDescription("View upcoming events"))
  .addSubcommand(s => s.setName("view").setDescription("View an event").addIntegerOption(o => o.setName("id").setDescription("Event ID").setRequired(true)))
  .addSubcommand(s => s.setName("join").setDescription("Join an event").addIntegerOption(o => o.setName("id").setDescription("Event ID").setRequired(true)))
  .addSubcommand(s => s.setName("end").setDescription("End an event and reward participants (Admin)").addIntegerOption(o => o.setName("id").setDescription("Event ID").setRequired(true)))
  .addSubcommand(s => s.setName("cancel").setDescription("Cancel an event (Admin)").addIntegerOption(o => o.setName("id").setDescription("Event ID").setRequired(true)));

function buildEventEmbed(event: typeof eventsTable.$inferSelect, participantCount?: number): EmbedBuilder {
  const statusEmoji: Record<string, string> = { upcoming: "📅", active: "🔥", ended: "✅", cancelled: "❌" };
  const embed = new EmbedBuilder()
    .setColor(event.status === "active" ? COLORS.SMASH : event.status === "upcoming" ? COLORS.PRIMARY : COLORS.INFO)
    .setTitle(`${statusEmoji[event.status] || "📅"} ${event.name}`)
    .setDescription(event.description)
    .addFields(
      { name: "🕐 Start", value: `<t:${Math.floor(event.startAt.getTime() / 1000)}:F>`, inline: true },
      { name: "📊 Status", value: event.status.charAt(0).toUpperCase() + event.status.slice(1), inline: true },
    )
    .setFooter({ text: `Event ID: ${event.id}` })
    .setTimestamp();

  if (event.endAt) embed.addFields({ name: "🏁 End", value: `<t:${Math.floor(event.endAt.getTime() / 1000)}:F>`, inline: true });
  if (event.xpReward) embed.addFields({ name: `${EMOJIS.XP} XP Reward`, value: `**${event.xpReward}** XP`, inline: true });
  if (participantCount !== undefined) {
    const maxStr = event.maxParticipants ? `/${event.maxParticipants}` : "";
    embed.addFields({ name: "👥 Participants", value: `**${participantCount}${maxStr}**`, inline: true });
  }
  if (event.channelId) embed.addFields({ name: "📍 Channel", value: `<#${event.channelId}>`, inline: true });

  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (!interaction.guildId) return;

  if (sub === "create") {
    if (!await requireAdmin(interaction)) return;

    const startStr = interaction.options.getString("start", true);
    const startAt = new Date(startStr);
    if (isNaN(startAt.getTime())) { await interaction.reply({ embeds: [errorEmbed("Invalid Date", "Please use format: YYYY-MM-DD HH:MM")], ephemeral: true }); return; }

    const endStr = interaction.options.getString("end");
    const endAt = endStr ? new Date(endStr) : null;

    const channelOpt = interaction.options.getChannel("channel");

    const [event] = await db.insert(eventsTable).values({
      guildId: interaction.guildId,
      name: interaction.options.getString("name", true),
      description: interaction.options.getString("description", true),
      startAt,
      endAt: endAt || undefined,
      xpReward: interaction.options.getInteger("xp_reward") || 0,
      maxParticipants: interaction.options.getInteger("max_participants") || undefined,
      channelId: channelOpt?.id || undefined,
      createdBy: interaction.user.id,
    }).returning();

    // Post event announcement if channel specified
    if (channelOpt) {
      const channel = interaction.guild!.channels.cache.get(channelOpt.id) as any;
      if (channel) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`event_join:${event!.id}`).setLabel(`${EMOJIS.BELL} Join Event`).setStyle(ButtonStyle.Success)
        );
        const msg = await channel.send({ embeds: [buildEventEmbed(event!, 0)], components: [row] });
        await db.update(eventsTable).set({ messageId: msg.id }).where(eq(eventsTable.id, event!.id));
      }
    }

    await interaction.reply({ embeds: [successEmbed("Event Created!", `**${event!.name}** has been created! (ID: ${event!.id})\n\nStarts: <t:${Math.floor(startAt.getTime() / 1000)}:R>`)] });
  }

  else if (sub === "list") {
    const events = await db.select().from(eventsTable)
      .where(and(eq(eventsTable.guildId, interaction.guildId), eq(eventsTable.status, "upcoming")))
      .orderBy(eventsTable.startAt).limit(10);

    if (!events.length) { await interaction.reply({ embeds: [errorEmbed("No Events", "No upcoming events. Admins can create one with `/event create`.")] }); return; }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.BELL} Upcoming Events`)
      .setDescription(events.map(e => `**${e.id}.** **${e.name}**\n> Starts: <t:${Math.floor(e.startAt.getTime() / 1000)}:R>${e.xpReward ? ` | ${EMOJIS.XP} ${e.xpReward} XP` : ""}`).join("\n\n"))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "view") {
    const id = interaction.options.getInteger("id", true);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (!event) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No event with ID ${id}`)], ephemeral: true }); return; }
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, id));
    const row = event.status === "upcoming" || event.status === "active"
      ? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`event_join:${id}`).setLabel(`${EMOJIS.BELL} Join Event`).setStyle(ButtonStyle.Success))
      : undefined;
    await interaction.reply({ embeds: [buildEventEmbed(event, Number(count))], components: row ? [row] : [] });
  }

  else if (sub === "join") {
    const id = interaction.options.getInteger("id", true);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (!event || (event.status !== "upcoming" && event.status !== "active")) { await interaction.reply({ embeds: [errorEmbed("Not Available", "This event is not open for registration.")], ephemeral: true }); return; }
    
    const [existing] = await db.select().from(eventRegistrationsTable).where(and(eq(eventRegistrationsTable.eventId, id), eq(eventRegistrationsTable.discordId, interaction.user.id))).limit(1);
    if (existing) { await interaction.reply({ embeds: [errorEmbed("Already Joined", "You've already registered for this event!")], ephemeral: true }); return; }

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, id));
    if (event.maxParticipants && Number(count) >= event.maxParticipants) { await interaction.reply({ embeds: [errorEmbed("Full", "This event is at maximum capacity!")], ephemeral: true }); return; }

    await db.insert(eventRegistrationsTable).values({ eventId: id, discordId: interaction.user.id });
    await interaction.reply({ embeds: [successEmbed("Joined!", `You've registered for **${event.name}**!\nStarts: <t:${Math.floor(event.startAt.getTime() / 1000)}:R>`)], ephemeral: true });
  }

  else if (sub === "end") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (!event) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No event with ID ${id}`)], ephemeral: true }); return; }

    const participants = await db.select().from(eventRegistrationsTable).where(eq(eventRegistrationsTable.eventId, id));
    await db.update(eventsTable).set({ status: "ended" }).where(eq(eventsTable.id, id));

    // Reward all participants
    if (event.xpReward) {
      for (const p of participants) {
        await addXp(p.discordId, "participant", event.xpReward).catch(() => {});
      }
    }

    await interaction.reply({ embeds: [successEmbed("Event Ended!", `**${event.name}** has ended. **${participants.length}** participants${event.xpReward ? ` each received ${EMOJIS.XP} ${event.xpReward} XP!` : "."}`)] });
  }

  else if (sub === "cancel") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [event] = await db.update(eventsTable).set({ status: "cancelled" }).where(eq(eventsTable.id, id)).returning();
    if (!event) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No event with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Event Cancelled", `**${event.name}** has been cancelled.`)] });
  }
}
