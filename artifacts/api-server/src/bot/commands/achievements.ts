import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { achievementsTable, userAchievementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { errorEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { requireAdmin } from "../utils/permissions.js";
import { successEmbed } from "../utils/embeds.js";

const DEFAULT_ACHIEVEMENTS = [
  { slug: "first_quiz", name: "Quiz Rookie", description: "Answer your first quiz question", emoji: "🧠", xpReward: 50 },
  { slug: "first_tournament", name: "Tournament Debut", description: "Register in your first tournament", emoji: "🏆", xpReward: 100 },
  { slug: "first_challenge", name: "Daily Warrior", description: "Complete your first daily challenge", emoji: "⚡", xpReward: 50 },
  { slug: "level_5", name: "Rising Star", description: "Reach level 5", emoji: "⭐", xpReward: 200 },
  { slug: "level_10", name: "Veteran", description: "Reach level 10", emoji: "🎖️", xpReward: 500 },
  { slug: "level_25", name: "Elite", description: "Reach level 25", emoji: "💎", xpReward: 1000 },
  { slug: "linked_account", name: "Verified Player", description: "Link your SmashKarts account", emoji: "🔗", xpReward: 150 },
  { slug: "quiz_streak_5", name: "Streak Master", description: "Get a 5-day quiz streak", emoji: "🔥", xpReward: 250 },
  { slug: "coins_1000", name: "Wealthy", description: "Accumulate 1000 coins", emoji: "💰", xpReward: 100 },
  { slug: "tournament_winner", name: "Champion", description: "Win a tournament", emoji: "👑", xpReward: 500 },
];

export const data = new SlashCommandBuilder()
  .setName("achievements")
  .setDescription("Achievement System")
  .addSubcommand(s => s.setName("view").setDescription("View your achievements").addUserOption(o => o.setName("user").setDescription("User to check")))
  .addSubcommand(s => s.setName("list").setDescription("View all available achievements"))
  .addSubcommand(s => s.setName("grant").setDescription("Grant an achievement to a user (Admin)").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)).addStringOption(o => o.setName("slug").setDescription("Achievement slug").setRequired(true)))
  .addSubcommand(s => s.setName("seed").setDescription("Initialize default achievements (Admin)"));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "view") {
    const target = interaction.options.getUser("user") || interaction.user;
    const unlocked = await db.select().from(userAchievementsTable).where(eq(userAchievementsTable.discordId, target.id));
    const allAchievements = await db.select().from(achievementsTable);
    
    const unlockedSlugs = new Set(unlocked.map(u => u.achievementSlug));
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${EMOJIS.TROPHY} ${target.username}'s Achievements`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`**${unlocked.length}/${allAchievements.length}** achievements unlocked`)
      .setTimestamp();

    const unlockedList = allAchievements.filter(a => unlockedSlugs.has(a.slug));
    const lockedList = allAchievements.filter(a => !unlockedSlugs.has(a.slug) && !a.hidden);

    if (unlockedList.length) embed.addFields({ name: "✅ Unlocked", value: unlockedList.map(a => `${a.emoji} **${a.name}** — ${a.description}`).join("\n").substring(0, 1024) });
    if (lockedList.length) embed.addFields({ name: "🔒 Locked", value: lockedList.map(a => `🔒 **${a.name}** — ${a.description}`).join("\n").substring(0, 1024) });

    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "list") {
    const all = await db.select().from(achievementsTable).where(eq(achievementsTable.hidden, false));
    const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle(`${EMOJIS.TROPHY} All Achievements`).setDescription(all.map(a => `${a.emoji} **${a.name}** — ${a.description} *(${a.xpReward} XP)*`).join("\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "grant") {
    if (!await requireAdmin(interaction)) return;
    const target = interaction.options.getUser("user", true);
    const slug = interaction.options.getString("slug", true);
    const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.slug, slug)).limit(1);
    if (!ach) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No achievement with slug "${slug}"`)], ephemeral: true }); return; }
    const existing = await db.select().from(userAchievementsTable).where(eq(userAchievementsTable.discordId, target.id)).limit(1);
    await db.insert(userAchievementsTable).values({ discordId: target.id, achievementSlug: slug });
    await interaction.reply({ embeds: [successEmbed("Achievement Granted!", `${ach.emoji} **${ach.name}** has been granted to ${target.tag}.`)] });
  }

  else if (sub === "seed") {
    if (!await requireAdmin(interaction)) return;
    let count = 0;
    for (const ach of DEFAULT_ACHIEVEMENTS) {
      try { await db.insert(achievementsTable).values(ach); count++; } catch {}
    }
    await interaction.reply({ embeds: [successEmbed("Achievements Seeded", `${count} default achievements have been initialized.`)] });
  }
}
