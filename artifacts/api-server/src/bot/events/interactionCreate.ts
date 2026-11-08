import type { Interaction, Client } from "discord.js";
import { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { db } from "@workspace/db";
import {
  tournamentParticipantsTable, tournamentsTable, teamsTable,
  giveawayEntriesTable, giveawaysTable,
  pollVotesTable, pollsTable,
  suggestionVotesTable, suggestionsTable,
  ticketPanelsTable, ticketsTable,
  reactionRolesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType } from "discord.js";
import { logger } from "../../lib/logger.js";
import { checkCooldown } from "../utils/cooldown.js";
import { addXp, grantAchievement } from "../utils/xp.js";
import type { BotCommand } from "../types.js";

let commandsMap: Map<string, BotCommand> | null = null;

export function setCommands(cmds: Map<string, BotCommand>): void {
  commandsMap = cmds;
}

export async function onInteractionCreate(interaction: Interaction, client: Client): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      if (!commandsMap) return;
      const command = commandsMap.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ content: "Unknown command.", ephemeral: true });
        return;
      }

      // Cooldown check
      if (command.cooldown) {
        const remaining = checkCooldown(interaction.user.id, interaction.commandName, command.cooldown);
        if (remaining !== null) {
          await interaction.reply({ embeds: [errorEmbed("Slow down!", `Please wait **${remaining}s** before using this command again.`)], ephemeral: true });
          return;
        }
      }

      await command.execute(interaction, client);
    }

    else if (interaction.isButton()) {
      await handleButton(interaction, client);
    }

    else if (interaction.isModalSubmit()) {
      await handleModal(interaction, client);
    }
  } catch (err) {
    logger.error({ err, command: interaction.isCommand() ? interaction.commandName : "button/modal" }, "Interaction error");
    const errorMsg = { embeds: [errorEmbed("Error", "An unexpected error occurred. Please try again.")], ephemeral: true };
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMsg);
      } else if (interaction.isRepliable() && interaction.deferred) {
        await interaction.followUp(errorMsg);
      }
    } catch {}
  }
}

async function handleButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const [action, ...parts] = interaction.customId.split(":");
  const id = parts[0];

  // Tournament: Solo Register
  if (action === "tournament_register_solo" && id) {
    if (!interaction.guildId) return;
    const tournamentId = parseInt(id);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId)).limit(1);
    if (!tournament || tournament.status !== "open") {
      await interaction.reply({ embeds: [errorEmbed("Registration Closed", "This tournament is no longer accepting registrations.")], ephemeral: true }); return;
    }
    const existing = await db.select().from(tournamentParticipantsTable).where(and(eq(tournamentParticipantsTable.tournamentId, tournamentId), eq(tournamentParticipantsTable.discordId, interaction.user.id))).limit(1);
    if (existing.length) { await interaction.reply({ embeds: [errorEmbed("Already Registered", "You are already registered for this tournament!")], ephemeral: true }); return; }
    const count = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, tournamentId));
    if (count.length >= tournament.maxParticipants) { await interaction.reply({ embeds: [errorEmbed("Full", "This tournament is full!")], ephemeral: true }); return; }
    
    await db.insert(tournamentParticipantsTable).values({ tournamentId, discordId: interaction.user.id });
    const isFirst = await grantAchievement(interaction.user.id, "first_tournament");
    await addXp(interaction.user.id, interaction.user.username, 20);
    let msg = `${EMOJIS.TROPHY} You've registered for **${tournament.name}**! Good luck!`;
    if (isFirst) msg += "\n🏆 Achievement Unlocked: **Tournament Debut!**";
    await interaction.reply({ embeds: [successEmbed("Registered!", msg)], ephemeral: true });
  }

  // Tournament: Team Register — show modal
  else if (action === "tournament_register_team" && id) {
    const modal = new ModalBuilder().setCustomId(`tournament_team_register:${id}`).setTitle("Team Registration")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("team_name").setLabel("Team Name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("team_members").setLabel("Team Member IDs (comma-separated, no captain)").setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder("123456789,987654321")),
      );
    await interaction.showModal(modal);
  }

  // Giveaway: Enter
  else if (action === "giveaway_enter" && id) {
    const giveawayId = parseInt(id);
    const [giveaway] = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, giveawayId)).limit(1);
    if (!giveaway || giveaway.status !== "active") { await interaction.reply({ embeds: [errorEmbed("Ended", "This giveaway has already ended.")], ephemeral: true }); return; }
    const [existing] = await db.select().from(giveawayEntriesTable).where(and(eq(giveawayEntriesTable.giveawayId, giveawayId), eq(giveawayEntriesTable.discordId, interaction.user.id))).limit(1);
    if (existing) { await interaction.reply({ embeds: [errorEmbed("Already Entered", "You've already entered this giveaway!")], ephemeral: true }); return; }
    await db.insert(giveawayEntriesTable).values({ giveawayId, discordId: interaction.user.id });
    const count = await db.select().from(giveawayEntriesTable).where(eq(giveawayEntriesTable.giveawayId, giveawayId));
    await interaction.reply({ embeds: [successEmbed("Entered!", `🎉 You've entered the giveaway for **${giveaway.prize}**!\nTotal entries: **${count.length}**`)], ephemeral: true });
  }

  // Poll: Vote
  else if (action === "poll_vote" && id) {
    const pollId = parseInt(id);
    const optionIndex = parseInt(parts[1] || "0");
    const [poll] = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId)).limit(1);
    if (!poll || poll.status !== "active") { await interaction.reply({ embeds: [errorEmbed("Closed", "This poll is no longer active.")], ephemeral: true }); return; }
    const [existing] = await db.select().from(pollVotesTable).where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.discordId, interaction.user.id))).limit(1);
    if (existing) { await interaction.reply({ embeds: [errorEmbed("Already Voted", "You've already voted in this poll!")], ephemeral: true }); return; }
    await db.insert(pollVotesTable).values({ pollId, discordId: interaction.user.id, optionIndex });
    await interaction.reply({ embeds: [successEmbed("Vote Recorded!", `You voted for **${poll.options[optionIndex]}**!`)], ephemeral: true });
  }

  // Suggestion: Vote
  else if ((action === "suggestion_upvote" || action === "suggestion_downvote") && id) {
    const suggId = parseInt(id);
    const vote = action === "suggestion_upvote" ? "up" : "down";
    const [existing] = await db.select().from(suggestionVotesTable).where(and(eq(suggestionVotesTable.suggestionId, suggId), eq(suggestionVotesTable.discordId, interaction.user.id))).limit(1);
    if (existing) {
      await interaction.reply({ embeds: [errorEmbed("Already Voted", "You've already voted on this suggestion!")], ephemeral: true }); return;
    }
    await db.insert(suggestionVotesTable).values({ suggestionId: suggId, discordId: interaction.user.id, vote });
    if (vote === "up") {
      await db.update(suggestionsTable).set({ upvotes: (await db.select().from(suggestionsTable).where(eq(suggestionsTable.id, suggId)).limit(1))[0]!.upvotes + 1 }).where(eq(suggestionsTable.id, suggId));
    } else {
      await db.update(suggestionsTable).set({ downvotes: (await db.select().from(suggestionsTable).where(eq(suggestionsTable.id, suggId)).limit(1))[0]!.downvotes + 1 }).where(eq(suggestionsTable.id, suggId));
    }
    await interaction.reply({ embeds: [successEmbed("Vote Recorded!", `You ${vote === "up" ? "👍 upvoted" : "👎 downvoted"} this suggestion!`)], ephemeral: true });
  }

  // Ticket: Create
  else if (action === "ticket_create" && id) {
    if (!interaction.guildId) return;
    const panelId = parseInt(id);
    const [panel] = await db.select().from(ticketPanelsTable).where(eq(ticketPanelsTable.id, panelId)).limit(1);
    if (!panel) { await interaction.reply({ content: "Panel configuration not found.", ephemeral: true }); return; }

    // Show subject modal
    const modal = new ModalBuilder().setCustomId(`ticket_subject:${panelId}`).setTitle("Create Support Ticket")
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("subject").setLabel("What do you need help with?").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)));
    await interaction.showModal(modal);
  }

  // Reaction Role: Toggle
  else if (action === "reaction_role" && id) {
    if (!interaction.guildId) return;
    const rrId = parseInt(id);
    const [rr] = await db.select().from(reactionRolesTable).where(eq(reactionRolesTable.id, rrId)).limit(1);
    if (!rr) { await interaction.reply({ content: "Reaction role not found.", ephemeral: true }); return; }
    const member = interaction.member as any;
    if (member.roles.cache.has(rr.roleId)) {
      await member.roles.remove(rr.roleId);
      await interaction.reply({ embeds: [successEmbed("Role Removed", `The <@&${rr.roleId}> role has been removed.`)], ephemeral: true });
    } else {
      await member.roles.add(rr.roleId);
      await interaction.reply({ embeds: [successEmbed("Role Added", `You now have the <@&${rr.roleId}> role!`)], ephemeral: true });
    }
  }
}

async function handleModal(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  const [action, ...parts] = interaction.customId.split(":");
  const id = parts[0];

  // Team Registration Modal
  if (action === "tournament_team_register" && id) {
    if (!interaction.guildId) return;
    const tournamentId = parseInt(id);
    const teamName = interaction.fields.getTextInputValue("team_name");
    const memberIds = interaction.fields.getTextInputValue("team_members").split(",").map(m => m.trim()).filter(Boolean);

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId)).limit(1);
    if (!tournament || tournament.status !== "open") { await interaction.reply({ embeds: [errorEmbed("Closed", "Registration is closed.")], ephemeral: true }); return; }

    // Create team role
    let teamRole;
    try {
      teamRole = await interaction.guild!.roles.create({ name: teamName, permissions: [], reason: `Tournament team: ${teamName}` });
      const captain = interaction.member as any;
      await captain.roles.add(teamRole);
      for (const memberId of memberIds) {
        const m = interaction.guild!.members.cache.get(memberId);
        if (m) await m.roles.add(teamRole);
      }
    } catch {}

    const [team] = await db.insert(teamsTable).values({ tournamentId, name: teamName, captainId: interaction.user.id, roleId: teamRole?.id, members: [interaction.user.id, ...memberIds] }).returning();
    await db.insert(tournamentParticipantsTable).values({ tournamentId, discordId: interaction.user.id, teamId: team!.id });
    await interaction.reply({ embeds: [successEmbed("Team Registered!", `Team **${teamName}** has been registered for **${tournament.name}**!${teamRole ? ` Team role: <@&${teamRole.id}>` : ""}`)], ephemeral: true });
  }

  // Ticket Subject Modal
  else if (action === "ticket_subject" && id) {
    if (!interaction.guildId) return;
    const panelId = parseInt(id);
    const subject = interaction.fields.getTextInputValue("subject");
    const [panel] = await db.select().from(ticketPanelsTable).where(eq(ticketPanelsTable.id, panelId)).limit(1);
    if (!panel) { await interaction.reply({ content: "Panel not found.", ephemeral: true }); return; }

    try {
      const ticketChannel = await interaction.guild!.channels.create({
        name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        type: ChannelType.GuildText,
        parent: panel.categoryId,
        topic: `Support ticket for ${interaction.user.tag}: ${subject}`,
        permissionOverwrites: [
          { id: interaction.guild!.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...(panel.supportRoleId ? [{ id: panel.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        ],
      });

      const [ticket] = await db.insert(ticketsTable).values({ guildId: interaction.guildId!, channelId: ticketChannel.id, authorId: interaction.user.id, subject, panelId }).returning();

      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket_close_btn:${ticket!.id}`).setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_claim_btn:${ticket!.id}`).setLabel("🙋 Claim").setStyle(ButtonStyle.Secondary),
      );

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`${EMOJIS.TICKET} Support Ticket #${ticket!.id}`)
        .setDescription(`${interaction.user} has opened a ticket.\n\n**Subject:** ${subject}\n\nPlease describe your issue in detail and wait for a staff member.`)
        .setTimestamp();

      await ticketChannel.send({ embeds: [embed], components: [closeRow], content: panel.supportRoleId ? `<@&${panel.supportRoleId}>` : undefined });
      await interaction.reply({ embeds: [successEmbed("Ticket Created!", `Your support ticket has been created: <#${ticketChannel.id}>`)], ephemeral: true });
    } catch (err) {
      logger.error({ err }, "Failed to create ticket channel");
      await interaction.reply({ embeds: [errorEmbed("Failed", "Could not create ticket channel. Check bot permissions.")], ephemeral: true });
    }
  }
}
