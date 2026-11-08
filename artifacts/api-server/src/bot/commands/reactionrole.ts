import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "@workspace/db";
import { reactionRolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, primaryEmbed, COLORS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("reactionrole")
  .setDescription("Reaction Roles System")
  .addSubcommand(s => s.setName("create").setDescription("Create a reaction role button (Admin)").addChannelOption(o => o.setName("channel").setDescription("Channel to post in").setRequired(true)).addRoleOption(o => o.setName("role").setDescription("Role to assign").setRequired(true)).addStringOption(o => o.setName("emoji").setDescription("Button emoji").setRequired(true)).addStringOption(o => o.setName("label").setDescription("Button label")).addStringOption(o => o.setName("message_id").setDescription("Existing message ID to attach to")))
  .addSubcommand(s => s.setName("list").setDescription("List all reaction roles").addChannelOption(o => o.setName("channel").setDescription("Filter by channel")))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a reaction role (Admin)").addIntegerOption(o => o.setName("id").setDescription("Reaction role ID").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") {
    if (!await requireAdmin(interaction)) return;
    if (!interaction.guildId) return;

    const channel = interaction.options.getChannel("channel", true) as any;
    const role = interaction.options.getRole("role", true);
    const emoji = interaction.options.getString("emoji", true);
    const label = interaction.options.getString("label") || `Get ${role.name}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`reaction_role:PLACEHOLDER`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder().setColor(COLORS.PRIMARY).setTitle("🎭 Role Selection").setDescription(`Click the button below to get the **${role.name}** role!`).setTimestamp();

    const realChannel = interaction.guild!.channels.cache.get(channel.id) as any;
    const msg = await realChannel.send({ embeds: [embed], components: [row] });

    const [rr] = await db.insert(reactionRolesTable).values({ guildId: interaction.guildId, channelId: channel.id, messageId: msg.id, emoji, roleId: role.id }).returning();

    const realRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`reaction_role:${rr!.id}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary)
    );
    await msg.edit({ components: [realRow] });
    await interaction.reply({ embeds: [successEmbed("Reaction Role Created!", `Users can now click the button in <#${channel.id}> to get the **${role.name}** role!`)], ephemeral: true });
  }

  else if (sub === "list") {
    if (!interaction.guildId) return;
    const channelFilter = interaction.options.getChannel("channel");
    const rrs = channelFilter
      ? await db.select().from(reactionRolesTable).where(and(eq(reactionRolesTable.guildId, interaction.guildId), eq(reactionRolesTable.channelId, channelFilter.id)))
      : await db.select().from(reactionRolesTable).where(eq(reactionRolesTable.guildId, interaction.guildId));
    if (!rrs.length) { await interaction.reply({ embeds: [errorEmbed("None Found", "No reaction roles set up.")], ephemeral: true }); return; }
    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle("🎭 Reaction Roles").setDescription(rrs.map(r => `**${r.id}.** ${r.emoji} → <@&${r.roleId}> in <#${r.channelId}>`).join("\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "delete") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [deleted] = await db.delete(reactionRolesTable).where(eq(reactionRolesTable.id, id)).returning();
    if (!deleted) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No reaction role #${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Deleted", `Reaction role #${id} has been removed.`)] });
  }
}
