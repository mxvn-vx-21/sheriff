import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { challengesTable, userChallengesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { errorEmbed, successEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { addXp, addCoins, getOrCreateUser, grantAchievement } from "../utils/xp.js";
import { requireAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Daily Challenges")
  .addSubcommand(s => s.setName("challenge").setDescription("View and complete today's challenge"))
  .addSubcommand(s => s.setName("create").setDescription("Create a challenge (Admin)").addStringOption(o => o.setName("title").setDescription("Challenge title").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Challenge description").setRequired(true)).addIntegerOption(o => o.setName("xp").setDescription("XP reward").setRequired(true).setMinValue(1)).addIntegerOption(o => o.setName("coins").setDescription("Coin reward")).addStringOption(o => o.setName("difficulty").setDescription("Difficulty").addChoices({name:"Easy",value:"easy"},{name:"Medium",value:"medium"},{name:"Hard",value:"hard"})));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "challenge") {
    const today = new Date().toISOString().split("T")[0]!;
    
    // Pick a random active challenge for today
    const challenges = await db.select().from(challengesTable).where(eq(challengesTable.active, true)).orderBy(sql`RANDOM()`).limit(1);
    if (!challenges.length) {
      await interaction.reply({ embeds: [errorEmbed("No Challenges", "No daily challenges available yet. Admins can create them with `/daily create`.")], ephemeral: true });
      return;
    }
    
    const challenge = challenges[0]!;
    
    // Check if already completed today
    const [alreadyDone] = await db.select().from(userChallengesTable)
      .where(and(eq(userChallengesTable.discordId, interaction.user.id), eq(userChallengesTable.challengeId, challenge.id), eq(userChallengesTable.completedDate, today)))
      .limit(1);

    const diffColors = { easy: COLORS.SUCCESS, medium: COLORS.WARNING, hard: COLORS.ERROR };
    const embed = new EmbedBuilder()
      .setColor((diffColors[challenge.difficulty as keyof typeof diffColors] || COLORS.PRIMARY) as any)
      .setTitle(`${EMOJIS.FIRE} Daily Challenge`)
      .setDescription(`**${challenge.title}**\n\n${challenge.description}`)
      .addFields(
        { name: "⚡ Difficulty", value: challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1), inline: true },
        { name: `${EMOJIS.XP} XP Reward`, value: `${challenge.xpReward} XP`, inline: true },
        { name: `${EMOJIS.COIN} Coin Reward`, value: `${challenge.coinReward} coins`, inline: true },
      )
      .setTimestamp();

    if (alreadyDone) {
      embed.setFooter({ text: "✅ You already completed this challenge today! Come back tomorrow." });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    embed.setFooter({ text: "Use /daily complete to claim your reward after completing the challenge!" });
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "create") {
    if (!await requireAdmin(interaction)) return;
    const [c] = await db.insert(challengesTable).values({
      title: interaction.options.getString("title", true),
      description: interaction.options.getString("description", true),
      xpReward: interaction.options.getInteger("xp", true),
      coinReward: interaction.options.getInteger("coins") || 10,
      difficulty: (interaction.options.getString("difficulty") || "easy") as any,
      category: "general",
      createdBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Challenge Created!", `Daily challenge **${c!.title}** has been added! (ID: ${c!.id})`)] });
  }
}

export const challengeData = new SlashCommandBuilder()
  .setName("challenge")
  .setDescription("Claim today's daily challenge reward")
  .addIntegerOption(o => o.setName("id").setDescription("Challenge ID from /daily challenge").setRequired(true));

export async function executeChallenge(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const id = interaction.options.getInteger("id", true);
  const today = new Date().toISOString().split("T")[0]!;
  
  const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, id)).limit(1);
  if (!challenge) { await interaction.reply({ embeds: [errorEmbed("Not Found", `Challenge #${id} not found.`)], ephemeral: true }); return; }
  
  const [alreadyDone] = await db.select().from(userChallengesTable).where(and(eq(userChallengesTable.discordId, interaction.user.id), eq(userChallengesTable.challengeId, id), eq(userChallengesTable.completedDate, today))).limit(1);
  if (alreadyDone) { await interaction.reply({ embeds: [errorEmbed("Already Claimed", "You already completed this challenge today!")], ephemeral: true }); return; }
  
  await db.insert(userChallengesTable).values({ discordId: interaction.user.id, challengeId: id, completedDate: today });
  const { leveled, newLevel } = await addXp(interaction.user.id, interaction.user.username, challenge.xpReward);
  await addCoins(interaction.user.id, interaction.user.username, challenge.coinReward);
  const isFirst = await grantAchievement(interaction.user.id, "first_challenge");
  
  let desc = `You completed **${challenge.title}**!\n${EMOJIS.XP} **+${challenge.xpReward} XP** | ${EMOJIS.COIN} **+${challenge.coinReward} coins**`;
  if (leveled) desc += `\n\n🎉 **Level Up!** You're now level ${newLevel}!`;
  if (isFirst) desc += "\n🏆 Achievement Unlocked: **First Challenge!**";
  
  await interaction.reply({ embeds: [successEmbed("Challenge Complete!", desc)] });
}
