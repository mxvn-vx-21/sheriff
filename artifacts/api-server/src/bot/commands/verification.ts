import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "@workspace/db";
import { profilesTable, serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { successEmbed, errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function notifyLogChannel(client: Client, guildId: string, embed: EmbedBuilder): Promise<void> {
  try {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, guildId)).limit(1);
    if (!config?.logChannelId) return;
    const channel = client.channels.cache.get(config.logChannelId) as any;
    if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Failed to notify log channel");
  }
}

export const data = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Link your SmashKarts account to Discord");

export const unlinkData = new SlashCommandBuilder()
  .setName("unlink")
  .setDescription("Unlink your SmashKarts account");

export const linkedAccountData = new SlashCommandBuilder()
  .setName("linkedaccount")
  .setDescription("View your linked SmashKarts account");

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guildId) { await interaction.reply({ content: "This command must be used in a server.", ephemeral: true }); return; }
  const guildId = interaction.guildId;

  const existing = await db.select().from(profilesTable).where(eq(profilesTable.discordId, interaction.user.id)).limit(1);
  if (existing[0] && existing[0].verificationStatus === "approved") {
    await interaction.reply({ embeds: [errorEmbed("Already Linked", `Your Discord is already linked to SmashKarts account **${existing[0].smashkartsUsername}**.\nUse \`/unlink\` to remove the link first.`)], ephemeral: true }); return;
  }

  // Check for a pending submission
  if (existing[0] && existing[0].verificationStatus === "screenshot_submitted") {
    await interaction.reply({ embeds: [errorEmbed("Pending Review", "You already have a verification request pending admin review. Please wait!")], ephemeral: true }); return;
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 30 * 60 * 1000);

  await db.insert(profilesTable).values({ discordId: interaction.user.id, otpCode: otp, otpExpiry, verificationStatus: "otp_sent" })
    .onConflictDoUpdate({ target: profilesTable.discordId, set: { otpCode: otp, otpExpiry, verificationStatus: "otp_sent", updatedAt: new Date() } });

  await interaction.reply({ content: "A verification process has been started. Check your DMs!", ephemeral: true });

  // Notify log channel that a user started verification
  const startEmbed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.LINK} Verification Started`)
    .setDescription(`${interaction.user} has started the SmashKarts account verification process.`)
    .addFields(
      { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: "OTP", value: `\`${otp}\``, inline: true },
      { name: "Expires", value: `<t:${Math.floor(otpExpiry.getTime() / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
  await notifyLogChannel(client, guildId, startEmbed);

  try {
    const dm = await interaction.user.createDM();
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.LINK} SmashKarts Account Verification`)
      .setDescription("Welcome to the SmashKarts verification process! Follow these steps carefully:")
      .addFields(
        { name: "Step 1", value: "Screenshot your SmashKarts **profile/account page** and send it here." },
        { name: "Step 2", value: `Temporarily change your SmashKarts username to: \`\`\`${otp}\`\`\`` },
        { name: "Step 3", value: "Send a screenshot showing your updated username." },
        { name: "Step 4", value: "Provide your SmashKarts ID (SKID) and a screenshot of your stats page." },
        { name: "⏰ Time Limit", value: "This OTP expires in **30 minutes**." },
      )
      .setTimestamp();
    await dm.send({ embeds: [embed] });
    await dm.send("**Please send your SmashKarts profile screenshot now.**");

    const dmCollector = dm.createMessageCollector({ time: 30 * 60 * 1000, filter: m => !m.author.bot });
    let step = 1;
    let profileScreenshot: string | undefined;
    let statsScreenshot: string | undefined;
    let smashkartsId: string | undefined;

    dmCollector.on("collect", async (msg) => {
      if (step === 1) {
        const attachment = msg.attachments.first();
        if (!attachment) { await dm.send("Please send a **screenshot** (image attachment)."); return; }
        profileScreenshot = attachment.url;
        step = 2;
        await dm.send(`${EMOJIS.CHECK} Profile screenshot received!\n\nNow please change your SmashKarts username to **${otp}** and send a screenshot confirming the change.`);
      } else if (step === 2) {
        const attachment = msg.attachments.first();
        if (!attachment) { await dm.send("Please send a **screenshot** showing your updated username."); return; }
        step = 3;
        await db.update(profilesTable).set({ verificationStatus: "otp_verified", updatedAt: new Date() }).where(eq(profilesTable.discordId, interaction.user.id));
        await dm.send(`${EMOJIS.CHECK} Username screenshot received!\n\nNow please send:\n1. A screenshot of your SmashKarts **Stats page**\n2. Your SmashKarts ID (SKID) in a message`);
      } else if (step === 3) {
        const attachment = msg.attachments.first();
        if (attachment) {
          statsScreenshot = attachment.url;
          await dm.send("Stats screenshot received! Now please send your SmashKarts ID (SKID) as a text message.");
        } else if (msg.content.trim()) {
          smashkartsId = msg.content.trim();
          if (!statsScreenshot) { await dm.send("Please also send your stats screenshot first."); return; }
          step = 4;
          dmCollector.stop();
          await db.update(profilesTable).set({
            smashkartsId,
            profileScreenshot,
            statsScreenshot,
            verificationStatus: "screenshot_submitted",
            updatedAt: new Date(),
          }).where(eq(profilesTable.discordId, interaction.user.id));
          await dm.send({ embeds: [successEmbed("Verification Submitted!", "Your verification request has been submitted and is pending admin review.\nYou will be notified once approved or denied.")] });

          // ✅ Notify log channel with full admin review embed
          const submitEmbed = new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle(`🔔 New Verification Request — Pending Review`)
            .setDescription(`A new SmashKarts account verification is awaiting admin approval.`)
            .addFields(
              { name: "👤 Discord User", value: `${interaction.user.tag}\n<@${interaction.user.id}>`, inline: true },
              { name: "🆔 Discord ID", value: `\`${interaction.user.id}\``, inline: true },
              { name: "🎮 Claimed SKID", value: `\`${smashkartsId}\``, inline: true },
              { name: "🖼️ Profile Screenshot", value: `[View Screenshot](${profileScreenshot})`, inline: true },
              { name: "📊 Stats Screenshot", value: `[View Screenshot](${statsScreenshot})`, inline: true },
              { name: "📋 How to Approve", value: "Use `/admin verifyaccount` to approve or deny this request.", inline: false },
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: "Smash Knights Verification System" })
            .setTimestamp();

          await notifyLogChannel(client, guildId, submitEmbed);
        }
      }
    });

    dmCollector.on("end", async (_, reason) => {
      if (reason === "time" && step < 4) {
        await dm.send({ embeds: [errorEmbed("Verification Timed Out", "The 30-minute window has passed. Please use `/link` again to restart.")] }).catch(() => {});
        await db.update(profilesTable).set({ verificationStatus: "pending", updatedAt: new Date() }).where(eq(profilesTable.discordId, interaction.user.id));

        const timeoutEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle(`⏰ Verification Timed Out`)
          .setDescription(`${interaction.user.tag} did not complete verification in time (Step ${step}/4).`)
          .addFields({ name: "User", value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true })
          .setTimestamp();
        await notifyLogChannel(client, guildId, timeoutEmbed);
      }
    });
  } catch {
    await interaction.followUp({ content: "Could not send DM. Please make sure your DMs are open!", ephemeral: true });
  }
}

export async function executeUnlink(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.discordId, interaction.user.id)).limit(1);
  if (!profile || profile.verificationStatus !== "approved") { await interaction.reply({ embeds: [errorEmbed("Not Linked", "Your account is not linked to any SmashKarts account.")], ephemeral: true }); return; }

  const oldUsername = profile.smashkartsUsername;
  await db.update(profilesTable).set({ verificationStatus: "pending", smashkartsUsername: undefined, smashkartsId: undefined, verificationDate: undefined, updatedAt: new Date() }).where(eq(profilesTable.discordId, interaction.user.id));
  await interaction.reply({ embeds: [successEmbed("Account Unlinked", "Your SmashKarts account has been unlinked from your Discord.")] });

  if (interaction.guildId) {
    const unlinkEmbed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`🔗 Account Unlinked`)
      .addFields(
        { name: "User", value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
        { name: "Was Linked To", value: oldUsername || "Unknown", inline: true },
      )
      .setTimestamp();
    await notifyLogChannel(client, interaction.guildId, unlinkEmbed);
  }
}

export async function executeLinkedAccount(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.discordId, interaction.user.id)).limit(1);
  if (!profile || profile.verificationStatus !== "approved") { await interaction.reply({ embeds: [errorEmbed("Not Linked", "You don't have a linked SmashKarts account. Use `/link` to verify.")], ephemeral: true }); return; }
  const embed = new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`${EMOJIS.LINK} Linked Account`).addFields(
    { name: "SmashKarts Username", value: profile.smashkartsUsername || "Unknown", inline: true },
    { name: "SKID", value: profile.smashkartsId || "Unknown", inline: true },
    { name: "Verified", value: profile.verificationDate?.toDateString() || "Unknown", inline: true },
  ).setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
