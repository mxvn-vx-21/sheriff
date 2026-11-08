import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { db } from "@workspace/db";
import { quizQuestionsTable, quizSessionsTable, quizAnswersTable, quizResultsTable, usersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed, errorEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { addXp, grantAchievement } from "../utils/xp.js";

export const data = new SlashCommandBuilder()
  .setName("quiz")
  .setDescription("SmashKarts Quiz System")
  .addSubcommand(s => s.setName("create").setDescription("Create a quiz question (Admin)").addStringOption(o => o.setName("question").setDescription("The question").setRequired(true)).addStringOption(o => o.setName("options").setDescription("4 options separated by | (e.g. A|B|C|D)").setRequired(true)).addIntegerOption(o => o.setName("answer").setDescription("Correct answer index (1-4)").setRequired(true).setMinValue(1).setMaxValue(4)).addStringOption(o => o.setName("difficulty").setDescription("Difficulty").addChoices({name:"Easy",value:"easy"},{name:"Medium",value:"medium"},{name:"Hard",value:"hard"})).addStringOption(o => o.setName("category").setDescription("Category")).addStringOption(o => o.setName("explanation").setDescription("Explanation for the answer")).addIntegerOption(o => o.setName("xp").setDescription("XP reward (default 10)").setMinValue(1).setMaxValue(100)))
  .addSubcommand(s => s.setName("edit").setDescription("Edit a question (Admin)").addIntegerOption(o => o.setName("id").setDescription("Question ID").setRequired(true)).addStringOption(o => o.setName("question").setDescription("New question")).addStringOption(o => o.setName("explanation").setDescription("New explanation")))
  .addSubcommand(s => s.setName("delete").setDescription("Delete a question (Admin)").addIntegerOption(o => o.setName("id").setDescription("Question ID").setRequired(true)))
  .addSubcommand(s => s.setName("start").setDescription("Start a quiz in this channel (Admin)").addStringOption(o => o.setName("category").setDescription("Category to quiz from")).addStringOption(o => o.setName("difficulty").setDescription("Difficulty").addChoices({name:"Easy",value:"easy"},{name:"Medium",value:"medium"},{name:"Hard",value:"hard"})))
  .addSubcommand(s => s.setName("leaderboard").setDescription("View the quiz leaderboard"));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "create") {
    if (!await requireAdmin(interaction)) return;
    const question = interaction.options.getString("question", true);
    const optionsRaw = interaction.options.getString("options", true);
    const options = optionsRaw.split("|").map(o => o.trim()).filter(Boolean);
    if (options.length !== 4) { await interaction.reply({ embeds: [errorEmbed("Invalid Options", "Please provide exactly 4 options separated by |")], ephemeral: true }); return; }
    const answer = interaction.options.getInteger("answer", true) - 1;
    const [q] = await db.insert(quizQuestionsTable).values({
      question, options,
      correctAnswer: answer,
      difficulty: (interaction.options.getString("difficulty") || "medium") as any,
      category: interaction.options.getString("category") || "general",
      explanation: interaction.options.getString("explanation") || undefined,
      xpReward: interaction.options.getInteger("xp") || 10,
      createdBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Question Created", `Question #${q!.id} added to the quiz bank!\n\n**Q:** ${question}\n**Answer:** ${options[answer]}`)] });
  }

  else if (sub === "edit") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    const updates: any = { updatedAt: new Date() };
    const q = interaction.options.getString("question");
    const exp = interaction.options.getString("explanation");
    if (q) updates.question = q;
    if (exp) updates.explanation = exp;
    const [updated] = await db.update(quizQuestionsTable).set(updates).where(eq(quizQuestionsTable.id, id)).returning();
    if (!updated) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No question with ID ${id}`)], ephemeral: true }); return; }
    await interaction.reply({ embeds: [successEmbed("Question Updated", `Question #${id} updated.`)] });
  }

  else if (sub === "delete") {
    if (!await requireAdmin(interaction)) return;
    const id = interaction.options.getInteger("id", true);
    await db.update(quizQuestionsTable).set({ active: false }).where(eq(quizQuestionsTable.id, id));
    await interaction.reply({ embeds: [successEmbed("Question Deleted", `Question #${id} has been removed.`)] });
  }

  else if (sub === "start") {
    if (!await requireAdmin(interaction)) return;
    if (!interaction.guildId) return;
    const category = interaction.options.getString("category");
    const difficulty = interaction.options.getString("difficulty");
    
    let query = db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.active, true));
    const questions = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.active, true)).orderBy(sql`RANDOM()`).limit(1);
    if (!questions.length) { await interaction.reply({ embeds: [errorEmbed("No Questions", "No quiz questions available yet.")], ephemeral: true }); return; }
    
    const q = questions[0]!;
    const letters = ["🇦", "🇧", "🇨", "🇩"];
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.QUIZ} Quiz Time!`)
      .setDescription(`**${q.question}**\n\n${q.options.map((opt, i) => `${letters[i]} ${opt}`).join("\n")}`)
      .addFields({ name: "⚡ Difficulty", value: q.difficulty, inline: true }, { name: `${EMOJIS.XP} XP Reward`, value: `${q.xpReward} XP`, inline: true })
      .setFooter({ text: "You have 30 seconds to answer!" })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...q.options.map((_, i) => new ButtonBuilder().setCustomId(`quiz_answer:${q.id}:${i}`).setLabel(`${letters[i]!.replace(/[🇦🇧🇨🇩]/g, (m) => ["A","B","C","D"][["🇦","🇧","🇨","🇩"].indexOf(m)]!)} ${q.options[i]!.substring(0,50)}`).setStyle(ButtonStyle.Primary))
    );

    const [session] = await db.insert(quizSessionsTable).values({ guildId: interaction.guildId, channelId: interaction.channelId, questionId: q.id }).returning();
    
    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    await db.update(quizSessionsTable).set({ messageId: msg.id }).where(eq(quizSessionsTable.id, session!.id));

    const answeredUsers = new Set<string>();
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on("collect", async (btnInt) => {
      if (answeredUsers.has(btnInt.user.id)) { await btnInt.reply({ content: "You've already answered!", ephemeral: true }); return; }
      answeredUsers.add(btnInt.user.id);
      const chosen = parseInt(btnInt.customId.split(":")[2]!);
      const correct = chosen === q.correctAnswer;
      await db.insert(quizAnswersTable).values({ sessionId: session!.id, discordId: btnInt.user.id, optionIndex: chosen, correct });
      if (correct) {
        const { leveled, newLevel } = await addXp(btnInt.user.id, btnInt.user.username, q.xpReward);
        const isFirst = await grantAchievement(btnInt.user.id, "first_quiz");
        let msg = `${EMOJIS.CHECK} Correct! +${q.xpReward} XP`;
        if (leveled) msg += ` | 🎉 Level Up! Now level ${newLevel}!`;
        if (isFirst) msg += "\n🏆 Achievement Unlocked: First Quiz!";
        await btnInt.reply({ content: msg, ephemeral: true });
      } else {
        await btnInt.reply({ content: `${EMOJIS.CROSS} Wrong! The correct answer was **${q.options[q.correctAnswer]}**${q.explanation ? `\n💡 ${q.explanation}` : ""}`, ephemeral: true });
      }
    });

    collector.on("end", async () => {
      await db.update(quizSessionsTable).set({ status: "completed", endedAt: new Date() }).where(eq(quizSessionsTable.id, session!.id));
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...q.options.map((_, i) => new ButtonBuilder().setCustomId(`quiz_done_${i}`).setLabel(`${["A","B","C","D"][i]!} ${q.options[i]!.substring(0,50)}`).setStyle(i === q.correctAnswer ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true))
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  }

  else if (sub === "leaderboard") {
    const results = await db.select({ discordId: quizAnswersTable.discordId, correct: sql<number>`count(*) filter (where ${quizAnswersTable.correct} = true)`, total: sql<number>`count(*)` }).from(quizAnswersTable).groupBy(quizAnswersTable.discordId).orderBy(sql`count(*) filter (where correct = true) DESC`).limit(10);
    if (!results.length) { await interaction.reply({ embeds: [errorEmbed("No Data", "No quiz results yet!")], ephemeral: true }); return; }
    const medals = ["🥇", "🥈", "🥉"];
    const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`${EMOJIS.QUIZ} Quiz Leaderboard`).setDescription(results.map((r, i) => `${medals[i] || `**${i + 1}.**`} <@${r.discordId}> — ${r.correct} correct / ${r.total} answered`).join("\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
}
