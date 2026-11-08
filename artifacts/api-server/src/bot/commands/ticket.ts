import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from "discord.js";
import { db } from "@workspace/db";
import { ticketPanelsTable, ticketsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin, requireModerator } from "../utils/permissions.js";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket System")
  .addSubcommand(s => s.setName("panel").setDescription("Create a ticket panel in this channel (Admin)").addChannelOption(o => o.setName("category").setDescription("Category for ticket channels").setRequired(true)).addStringOption(o => o.setName("title").setDescription("Panel title")).addStringOption(o => o.setName("description").setDescription("Panel description")).addRoleOption(o => o.setName("support_role").setDescription("Support team role")))
  .addSubcommand(s => s.setName("close").setDescription("Close the current ticket").addStringOption(o => o.setName("reason").setDescription("Reason for closing")))
  .addSubcommand(s => s.setName("claim").setDescription("Claim this ticket"))
  .addSubcommand(s => s.setName("add").setDescription("Add a user to this ticket").addUserOption(o => o.setName("user").setDescription("User to add").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "panel") {
    if (!await requireAdmin(interaction)) return;
    if (!interaction.guildId) return;

    const category = interaction.options.getChannel("category", true);
    const title = interaction.options.getString("title") || "Support Tickets";
    const description = interaction.options.getString("description") || "Click the button below to open a support ticket. Our team will assist you shortly.";
    const supportRole = interaction.options.getRole("support_role");

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.TICKET} ${title}`)
      .setDescription(description)
      .addFields({ name: "📋 Instructions", value: "• Click **Create Ticket** below\n• Describe your issue\n• Wait for a staff member\n• Your channel will be private" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_create:PLACEHOLDER").setLabel(`${EMOJIS.TICKET} Create Ticket`).setStyle(ButtonStyle.Primary)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const [panel] = await db.insert(ticketPanelsTable).values({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: msg.id,
      categoryId: category.id,
      panelTitle: title,
      panelDescription: description,
      supportRoleId: supportRole?.id || undefined,
    }).returning();

    const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_create:${panel!.id}`).setLabel(`${EMOJIS.TICKET} Create Ticket`).setStyle(ButtonStyle.Primary)
    );
    await (msg as any).edit({ components: [realRow] });
  }

  else if (sub === "close") {
    if (!await requireModerator(interaction)) return;
    const reason = interaction.options.getString("reason") || "No reason provided";
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, interaction.channelId)).limit(1);
    if (!ticket) { await interaction.reply({ embeds: [errorEmbed("Not a Ticket", "This command must be used inside a ticket channel.")], ephemeral: true }); return; }
    
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.ERROR).setTitle("🔒 Ticket Closing...").setDescription(`**Reason:** ${reason}\n\nThis channel will be deleted in 5 seconds.`)] });
    await db.update(ticketsTable).set({ status: "closed", closedAt: new Date() }).where(eq(ticketsTable.channelId, interaction.channelId));
    setTimeout(async () => { await (interaction.channel as any)?.delete().catch(() => {}); }, 5000);
  }

  else if (sub === "claim") {
    if (!await requireModerator(interaction)) return;
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, interaction.channelId)).limit(1);
    if (!ticket) { await interaction.reply({ embeds: [errorEmbed("Not a Ticket", "This command must be used inside a ticket channel.")], ephemeral: true }); return; }
    await db.update(ticketsTable).set({ claimedBy: interaction.user.id, status: "claimed" }).where(eq(ticketsTable.channelId, interaction.channelId));
    await interaction.reply({ embeds: [successEmbed("Ticket Claimed", `This ticket has been claimed by ${interaction.user}.`)] });
  }

  else if (sub === "add") {
    if (!await requireModerator(interaction)) return;
    const user = interaction.options.getUser("user", true);
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, interaction.channelId)).limit(1);
    if (!ticket) { await interaction.reply({ embeds: [errorEmbed("Not a Ticket", "This command must be used inside a ticket channel.")], ephemeral: true }); return; }
    try {
      await (interaction.channel as any)?.permissionOverwrites.create(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await interaction.reply({ embeds: [successEmbed("User Added", `${user} has been added to this ticket.`)] });
    } catch {
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not add user to ticket.")], ephemeral: true });
    }
  }
}
