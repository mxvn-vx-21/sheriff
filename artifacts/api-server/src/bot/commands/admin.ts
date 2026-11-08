import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "@workspace/db";
import { profilesTable, serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin, requireOwner } from "../utils/permissions.js";
import { successEmbed, errorEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { addXp, addCoins } from "../utils/xp.js";

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Admin Commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(s => s.setName("verifyaccount").setDescription("Approve/deny a SmashKarts verification").addUserOption(o => o.setName("user").setDescription("User to verify").setRequired(true)).addStringOption(o => o.setName("action").setDescription("Action").setRequired(true).addChoices({name:"Approve",value:"approve"},{name:"Deny",value:"deny"})).addStringOption(o => o.setName("username").setDescription("SmashKarts username (for approve)")).addStringOption(o => o.setName("note").setDescription("Note to user")))
  .addSubcommand(s => s.setName("unlinkaccount").setDescription("Unlink a user's SmashKarts account").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)))
  .addSubcommand(s => s.setName("givexp").setDescription("Give XP to a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o => o.setName("amount").setDescription("XP amount").setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName("givecoins").setDescription("Give coins to a user").addUserOption(o => o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o => o.setName("amount").setDescription("Coin amount").setRequired(true)))
  .addSubcommand(s => s.setName("config").setDescription("View server configuration"))
  .addSubcommand(s => s.setName("setlogchannel").setDescription("Set logging channel").addChannelOption(o => o.setName("channel").setDescription("Log channel").setRequired(true)))
  .addSubcommand(s => s.setName("automod").setDescription("Configure auto-moderation").addBooleanOption(o => o.setName("enabled").setDescription("Enable/disable automod").setRequired(true)).addBooleanOption(o => o.setName("antispam").setDescription("Anti-spam")).addBooleanOption(o => o.setName("antilink").setDescription("Anti-link")).addBooleanOption(o => o.setName("antiraid").setDescription("Anti-raid"))  );

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!await requireAdmin(interaction)) return;
  if (!interaction.guildId) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "verifyaccount") {
    const target = interaction.options.getUser("user", true);
    const action = interaction.options.getString("action", true);
    const username = interaction.options.getString("username");
    const note = interaction.options.getString("note");

    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.discordId, target.id)).limit(1);
    if (!profile) { await interaction.reply({ embeds: [errorEmbed("Not Found", `${target.tag} has no pending verification.`)], ephemeral: true }); return; }

    if (action === "approve") {
      await db.update(profilesTable).set({ verificationStatus: "approved", smashkartsUsername: username || profile.smashkartsUsername, verificationDate: new Date(), reviewedBy: interaction.user.id, reviewNote: note || undefined, updatedAt: new Date() }).where(eq(profilesTable.discordId, target.id));
      try {
        await target.send({ embeds: [new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJIS.CHECK} Verification Approved!`).setDescription(`Your SmashKarts account has been linked to your Discord!\n${note ? `**Note:** ${note}` : ""}`).setTimestamp()] });
      } catch {}
      await interaction.reply({ embeds: [successEmbed("Account Verified!", `${target.tag}'s SmashKarts account has been approved.`)] });
    } else {
      await db.update(profilesTable).set({ verificationStatus: "denied", reviewedBy: interaction.user.id, reviewNote: note || undefined, updatedAt: new Date() }).where(eq(profilesTable.discordId, target.id));
      try {
        await target.send({ embeds: [new EmbedBuilder().setColor(COLORS.ERROR).setTitle(`${EMOJIS.CROSS} Verification Denied`).setDescription(`Your SmashKarts verification was denied.\n${note ? `**Reason:** ${note}` : ""}\n\nYou can try again with \`/link\`.`).setTimestamp()] });
      } catch {}
      await interaction.reply({ embeds: [successEmbed("Verification Denied", `${target.tag}'s verification has been denied.`)] });
    }
  }

  else if (sub === "unlinkaccount") {
    const target = interaction.options.getUser("user", true);
    await db.update(profilesTable).set({ verificationStatus: "pending", smashkartsUsername: undefined, smashkartsId: undefined, verificationDate: undefined, updatedAt: new Date() }).where(eq(profilesTable.discordId, target.id));
    await interaction.reply({ embeds: [successEmbed("Account Unlinked", `${target.tag}'s SmashKarts account has been unlinked.`)] });
  }

  else if (sub === "givexp") {
    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const { leveled, newLevel, newXp } = await addXp(target.id, target.username, amount);
    await interaction.reply({ embeds: [successEmbed("XP Given", `${EMOJIS.XP} Gave **${amount} XP** to ${target.tag}!\nNew XP: **${newXp.toLocaleString()}**${leveled ? ` | 🎉 Leveled up to ${newLevel}!` : ""}`)] });
  }

  else if (sub === "givecoins") {
    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const newCoins = await addCoins(target.id, target.username, amount);
    await interaction.reply({ embeds: [successEmbed("Coins Given", `${EMOJIS.COIN} Gave **${amount} coins** to ${target.tag}!\nNew balance: **${newCoins.toLocaleString()}**`)] });
  }

  else if (sub === "config") {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, interaction.guildId)).limit(1);
    const embed = new EmbedBuilder().setColor(COLORS.INFO).setTitle(`⚙️ ${interaction.guild!.name} — Configuration`)
      .addFields(
        { name: "Welcome Channel", value: config?.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set", inline: true },
        { name: "Goodbye Channel", value: config?.goodbyeChannelId ? `<#${config.goodbyeChannelId}>` : "Not set", inline: true },
        { name: "Log Channel", value: config?.logChannelId ? `<#${config.logChannelId}>` : "Not set", inline: true },
        { name: "Suggestions Channel", value: config?.suggestionChannelId ? `<#${config.suggestionChannelId}>` : "Not set", inline: true },
        { name: "Automod", value: config?.automodEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
        { name: "Anti-Spam", value: config?.antiSpamEnabled ? "✅" : "❌", inline: true },
        { name: "Anti-Link", value: config?.antiLinkEnabled ? "✅" : "❌", inline: true },
        { name: "Anti-Raid", value: config?.antiRaidEnabled ? "✅" : "❌", inline: true },
      ).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "setlogchannel") {
    const channel = interaction.options.getChannel("channel", true);
    await db.insert(serverConfigTable).values({ guildId: interaction.guildId, logChannelId: channel.id }).onConflictDoUpdate({ target: serverConfigTable.guildId, set: { logChannelId: channel.id, updatedAt: new Date() } });
    await interaction.reply({ embeds: [successEmbed("Log Channel Set", `Server logs will be sent to <#${channel.id}>.`)] });
  }

  else if (sub === "automod") {
    const enabled = interaction.options.getBoolean("enabled", true);
    const antispam = interaction.options.getBoolean("antispam") ?? undefined;
    const antilink = interaction.options.getBoolean("antilink") ?? undefined;
    const antiraid = interaction.options.getBoolean("antiraid") ?? undefined;
    const updates: any = { automodEnabled: enabled, updatedAt: new Date() };
    if (antispam !== undefined) updates.antiSpamEnabled = antispam;
    if (antilink !== undefined) updates.antiLinkEnabled = antilink;
    if (antiraid !== undefined) updates.antiRaidEnabled = antiraid;
    await db.insert(serverConfigTable).values({ guildId: interaction.guildId, ...updates }).onConflictDoUpdate({ target: serverConfigTable.guildId, set: updates });
    await interaction.reply({ embeds: [successEmbed("Automod Updated", `Automod is now **${enabled ? "enabled" : "disabled"}**.`)] });
  }
}
