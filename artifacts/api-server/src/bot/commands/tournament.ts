import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType } from "discord.js";
import { db } from "@workspace/db";
import { tournamentsTable, tournamentParticipantsTable, teamsTable, bracketsTable, matchesTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, tournamentEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { generateSingleElimination, generateRoundRobin, bracketToText } from "../utils/brackets.js";
import { paginateEmbeds } from "../utils/pagination.js";

export const data = new SlashCommandBuilder()
  .setName("tournament")
  .setDescription("Tournament Management System")
  .addSubcommand(s => s.setName("create").setDescription("Create a new tournament (Admin)").addStringOption(o => o.setName("name").setDescription("Tournament name").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)).addStringOption(o => o.setName("type").setDescription("Tournament type").setRequired(true).addChoices({name:"Solo",value:"solo"},{name:"Duo",value:"duo"},{name:"Team",value:"team"})).addStringOption(o => o.setName("bracket").setDescription("Bracket type").setRequired(true).addChoices({name:"Single Elimination",value:"single_elimination"},{name:"Double Elimination",value:"double_elimination"},{name:"Round Robin",value:"round_robin"})).addIntegerOption(o => o.setName("max").setDescription("Max participants").setRequired(true).setMinValue(2).setMaxValue(256)).addStringOption(o => o.setName("prize").setDescription("Prize info")).addStringOption(o => o.setName("rules").setDescription("Rules")))
  .addSubcommand(s => s.setName("open").setDescription("Open registration for a tournament (Admin)").addIntegerOption(o => o.setName("id").setDescription("Tournament ID").setRequired(true)).addChannelOption(o => o.setName("channel").setDescription("Channel to post registration embed").setRequired(true)))
  .addSubcommand(s => s.setName("close").setDescription("Close registration (Admin)").addIntegerOption(o => o.setName("id").setDescription("Tournament ID").setRequired(true)))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a tournament (Admin)").addIntegerOption(o => o.setName("id").setDescription("Tournament ID").setRequired(true)))
  .addSubcommand(s => s.setName("list").setDescription("List all tournaments"))
  .addSubcommand(s => s.setName("view").setDescription("View a tournament").addIntegerOption(o => o.setName("id").setDescription("Tournament ID").setRequired(true)))
  .addSubcommand(s => s.setName("start").setDescription("Start tournament and generate bracket (Admin)").addIntegerOption(o => o.setName("id").setDescription("Tournament ID").setRequired(true)))
  .addSubcommand(s => s.setName("result").setDescription("Report a match result (Admin)").addIntegerOption(o => o.setName("match").setDescription("Match ID").setRequired(true)).addUserOption(o => o.setName("winner").setDescription("Winner").setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") {
    if (!await requireAdmin(interaction)) return;
    if (!interaction.guildId) return;
    const [t] = await db.insert(tournamentsTable).values({
      guildId: interaction.guildId,
      name: interaction.options.getString("name", true),
      description: interaction.options.getString("description", true),
      type: interaction.options.getString("type", true) as any,
      bracketType: interaction.options.getString("bracket", true) as any,
      maxParticipants: interaction.options.getInteger("max", true),
      prizeInfo: interaction.options.getString("prize") || undefined,
      rules: interaction.options.getString("rules") || undefined,
      createdBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Tournament Created!", `**${t!.name}** has been created! (ID: **${t!.id}**)\n\nUse \`/tournament open id:${t!.id}\` to open registration.`)] });
  }

  else if (sub === "open") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const channel = interaction.options.getChannel("channel", true) as any;
    const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id)).limit(1);
    if (!t) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tournament with ID ${id}`)], ephemeral: true }); return; }
    if (t.status !== "pending") { await interaction.reply({ embeds: [errorEmbed("Invalid Status", `Tournament is already ${t.status}.`)], ephemeral: true }); return; }

    const embed = tournamentEmbed(t.name, t.description, t.type, t.bracketType, t.maxParticipants, t.prizeInfo, t.rules);
    embed.addFields({ name: "📝 Registration", value: "Click the button below to register!", inline: false });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`tournament_register_solo:${t.id}`).setLabel(`${EMOJIS.TROPHY} Register`).setStyle(ButtonStyle.Success)
    );
    if (t.type === "team") {
      row.addComponents(new ButtonBuilder().setCustomId(`tournament_register_team:${t.id}`).setLabel("👥 Register Team").setStyle(ButtonStyle.Primary));
    }

    const msg = await channel.send({ embeds: [embed], components: [row] });
    await db.update(tournamentsTable).set({ status: "open", registrationChannelId: channel.id, registrationMessageId: msg.id }).where(eq(tournamentsTable.id, id));
    await interaction.reply({ embeds: [successEmbed("Registration Opened!", `Registration for **${t.name}** is now open in <#${channel.id}>!`)] });
  }

  else if (sub === "close") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [t] = await db.update(tournamentsTable).set({ status: "checkin" }).where(eq(tournamentsTable.id, id)).returning();
    if (!t) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tournament with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Registration Closed", `Registration for **${t.name}** is now closed. Use \`/tournament start\` to begin.`)] });
  }

  else if (sub === "delete") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [t] = await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id)).returning();
    if (!t) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tournament with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Tournament Deleted", `**${t.name}** has been deleted.`)] });
  }

  else if (sub === "list") {
    if (!interaction.guildId) return;
    const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.guildId, interaction.guildId));
    if (!tournaments.length) { await interaction.reply({ embeds: [errorEmbed("No Tournaments", "No tournaments found. Admins can create one with `/tournament create`.")] }); return; }
    const statusEmoji = { pending: "⏳", open: "🟢", checkin: "🔵", active: "🔥", completed: "✅", cancelled: "❌" };
    const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`${EMOJIS.TROPHY} Tournaments`).setDescription(tournaments.map(t => `${(statusEmoji as any)[t.status] || "❓"} **${t.id}.** ${t.name} *(${t.type}, ${t.bracketType.replace(/_/g, " ")})*`).join("\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "view") {
    const id = interaction.options.getInteger("id", true);
    const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id)).limit(1);
    if (!t) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tournament with ID ${id}`)], ephemeral: true }); return; }
    const participants = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, id));
    const embed = tournamentEmbed(t.name, t.description, t.type, t.bracketType, t.maxParticipants, t.prizeInfo, t.rules);
    embed.addFields({ name: "👥 Registered", value: `${participants.length}/${t.maxParticipants}`, inline: true }, { name: "📊 Status", value: t.status.charAt(0).toUpperCase() + t.status.slice(1), inline: true });
    if (participants.length) {
      const sample = participants.slice(0, 10).map(p => `<@${p.discordId}>`).join(", ");
      embed.addFields({ name: "Players", value: sample + (participants.length > 10 ? ` ...and ${participants.length - 10} more` : "") });
    }
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "start") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id)).limit(1);
    if (!t) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No tournament with ID ${id}`)], ephemeral: true }); return; }

    const participants = await db.select().from(tournamentParticipantsTable).where(eq(tournamentParticipantsTable.tournamentId, id));
    if (participants.length < 2) { await interaction.reply({ embeds: [errorEmbed("Not Enough Players", "Need at least 2 participants to start.")], ephemeral: true }); return; }

    // Generate bracket
    const bracketParticipants = participants.map(p => ({ id: p.id, discordId: p.discordId, name: p.discordId }));
    const bracket = t.bracketType === "round_robin" ? generateRoundRobin(bracketParticipants) : generateSingleElimination(bracketParticipants);

    const [bracketRecord] = await db.insert(bracketsTable).values({ tournamentId: id, type: t.bracketType as any, data: JSON.stringify(bracket), totalRounds: bracket.rounds }).returning();
    
    // Create match records
    for (const m of bracket.matches) {
      await db.insert(matchesTable).values({ tournamentId: id, bracketId: bracketRecord!.id, round: m.round, matchNumber: m.matchId, participant1Id: m.p1?.id, participant2Id: m.p2?.id, status: m.status as any });
    }

    await db.update(tournamentsTable).set({ status: "active", startDate: new Date() }).where(eq(tournamentsTable.id, id));
    const bracketText = bracketToText(bracket);
    await interaction.reply({ content: bracketText.substring(0, 2000), embeds: [successEmbed("Tournament Started!", `**${t.name}** is now active! Bracket generated with **${participants.length}** participants.`)] });
  }

  else if (sub === "result") {
    if (!await requireAdmin(interaction)) return;
    const matchId = interaction.options.getInteger("match", true);
    const winner = interaction.options.getUser("winner", true);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
    if (!match) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No match with ID ${matchId}`)], ephemeral: true }); return; }
    
    const winnerParticipant = match.participant1Id && (await db.select().from(tournamentParticipantsTable).where(and(eq(tournamentParticipantsTable.discordId, winner.id), eq(tournamentParticipantsTable.tournamentId, match.tournamentId))).limit(1))[0];
    if (!winnerParticipant) { await interaction.reply({ embeds: [errorEmbed("Invalid Winner", `${winner.tag} is not a participant in this match.`)], ephemeral: true }); return; }
    
    const loserId = winnerParticipant.id === match.participant1Id ? match.participant2Id : match.participant1Id;
    await db.update(matchesTable).set({ winnerId: winnerParticipant.id, status: "completed", reportedBy: interaction.user.id }).where(eq(matchesTable.id, matchId));
    if (loserId) await db.update(tournamentParticipantsTable).set({ eliminated: true }).where(eq(tournamentParticipantsTable.id, loserId));
    await interaction.reply({ embeds: [successEmbed("Result Recorded!", `Match ${matchId}: **${winner.tag}** wins! 🏆`)] });
  }
}
