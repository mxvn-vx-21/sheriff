import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { errorEmbed } from "../utils/embeds.js";
import { renderProfileCard } from "../utils/profileCard.js";

// Sheriff monochrome accent — no bright embed colours.
const SHERIFF_GREY = 0x1a1a1a;

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View player profile")
  .addSubcommand(s => s.setName("view").setDescription("View a player profile").addUserOption(o => o.setName("user").setDescription("User to view")))
  .addSubcommand(s => s.setName("register").setDescription("Register your SmashKarts SKID").addStringOption(o => o.setName("skid").setDescription("Your SmashKarts SKID").setRequired(true)).addStringOption(o => o.setName("ign").setDescription("Your in-game name").setRequired(true)))
  .addSubcommand(s => s.setName("edit").setDescription("Edit SmashKarts stats (Admin only — full admin dashboard gating lands separately)").addIntegerOption(o => o.setName("kills").setDescription("Kill count")).addIntegerOption(o => o.setName("deaths").setDescription("Death count")).addIntegerOption(o => o.setName("wins").setDescription("Win count")));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "register") {
    const skid = interaction.options.getString("skid", true).trim();
    const ign = interaction.options.getString("ign", true).trim();

    const [existingByUser] = await db.select().from(profilesTable).where(eq(profilesTable.discordId, interaction.user.id)).limit(1);
    if (existingByUser) {
      await interaction.reply({ embeds: [errorEmbed("Already Registered", "You already have a Sheriff profile. Ask an admin if your SKID needs correcting.")], ephemeral: true });
      return;
    }

    const [existingBySkid] = await db.select().from(profilesTable).where(eq(profilesTable.smashkartsId, skid)).limit(1);
    if (existingBySkid) {
      await interaction.reply({ embeds: [errorEmbed("SKID Already Registered", "That SKID is already linked to another member.")], ephemeral: true });
      return;
    }

    await db.insert(profilesTable).values({
      discordId: interaction.user.id,
      ign,
      smashkartsId: skid,
      verificationStatus: "pending",
    });

    await interaction.reply({
      embeds: [{
        color: SHERIFF_GREY,
        title: "Registered",
        description: `Your profile has been created and is **UNREVIEWED** until an admin checks your SKID.\n\`\`\`${skid}\`\`\``,
        timestamp: new Date().toISOString(),
      }],
      ephemeral: true,
    });
    return;
  }

  if (sub === "view") {
    await interaction.deferReply();
    const target = interaction.options.getUser("user") || interaction.user;
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.discordId, target.id)).limit(1);

    if (!profile) {
      await interaction.editReply({
        embeds: [errorEmbed("No Profile Found", `${target.id === interaction.user.id ? "You haven't" : `<@${target.id}> hasn't`} registered yet. Use \`/profile register\` to get started.`)],
      });
      return;
    }

    const kdr = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills.toFixed(2);
    const reviewed = profile.verificationStatus === "approved";

    const cardBuffer = await renderProfileCard({
      ign: profile.ign || target.username,
      discordUsername: target.username,
      skid: profile.smashkartsId || "—",
      tier: profile.tier,
      kills: profile.kills,
      deaths: profile.deaths,
      kdr,
      wins: profile.wins,
      reviewed,
      updatedAt: profile.updatedAt,
      avatarUrl: target.displayAvatarURL({ size: 256, extension: "png" }),
    });

    const attachment = new AttachmentBuilder(cardBuffer, { name: "sheriff-profile-card.png" });

    const embed = new EmbedBuilder()
      .setColor(SHERIFF_GREY)
      .setTitle(`${target.username} — Sheriff Profile`)
      .setImage("attachment://sheriff-profile-card.png")
      .addFields(
        { name: "SKID (copy)", value: `\`\`\`${profile.smashkartsId || "not set"}\`\`\``, inline: false },
        { name: "Status", value: reviewed ? "Reviewed" : "Unreviewed", inline: true },
        { name: "Tier", value: profile.tier.replace("_", " "), inline: true },
      )
      .setFooter({ text: "Sheriff | OutLaws" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  }

  else if (sub === "edit") {
    // NOTE: this still needs the real OWNER>ADMIN>MODERATOR permission check
    // before going live — see /ad admin dashboard work. Left as a stub guard
    // so this command can't quietly ship without it.
    await interaction.reply({ embeds: [errorEmbed("Not Available Yet", "Stat edits are moving into the Admin Dashboard (`/ad`) so only admins can update verified stats. This command is disabled until that lands.")], ephemeral: true });
  }
}
