import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { errorEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getOrCreateUser, xpForLevel, levelForXp } from "../utils/xp.js";

export const data = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("XP & Leveling System")
  .addSubcommand(s => s.setName("show").setDescription("Check your XP and level").addUserOption(o => o.setName("user").setDescription("User to check")))
  .addSubcommand(s => s.setName("leaderboard").setDescription("View the XP leaderboard"));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "show") {
    const target = interaction.options.getUser("user") || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);
    const nextLevelXp = xpForLevel(user.level + 1);
    const currentLevelXp = xpForLevel(user.level);
    const progress = user.xp - currentLevelXp;
    const needed = nextLevelXp - currentLevelXp;
    const barLength = 20;
    const filled = Math.round((progress / needed) * barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.XP} ${target.username}'s Progress`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "Level", value: `**${user.level}**`, inline: true },
        { name: "Total XP", value: `**${user.xp.toLocaleString()}** XP`, inline: true },
        { name: `${EMOJIS.COIN} Coins`, value: `**${user.coins.toLocaleString()}**`, inline: true },
        { name: `Progress to Level ${user.level + 1}`, value: `\`${bar}\` ${progress}/${needed} XP` },
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "leaderboard") {
    const top = await db.select().from(usersTable).orderBy(desc(usersTable.xp)).limit(10);
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${EMOJIS.TROPHY} XP Leaderboard`)
      .setDescription(top.map((u, i) => `${["🥇","🥈","🥉"][i] || `**${i+1}.**`} <@${u.discordId}> — Level **${u.level}** | **${u.xp.toLocaleString()}** XP`).join("\n"))
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
}
