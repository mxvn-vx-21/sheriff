import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { requireAdmin, requireModerator } from "../utils/permissions.js";
import { COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Announcement System")
  .addSubcommand(s => s.setName("send").setDescription("Send an announcement (Moderator)").addStringOption(o => o.setName("message").setDescription("Announcement message").setRequired(true)).addChannelOption(o => o.setName("channel").setDescription("Channel (defaults to current)")).addBooleanOption(o => o.setName("ping_everyone").setDescription("Ping @everyone")).addStringOption(o => o.setName("color").setDescription("Embed color hex (e.g. #FF4C4C)")).addStringOption(o => o.setName("title").setDescription("Announcement title")))
  .addSubcommand(s => s.setName("news").setDescription("Post a news update (Admin)").addStringOption(o => o.setName("title").setDescription("News title").setRequired(true)).addStringOption(o => o.setName("content").setDescription("News content").setRequired(true)).addChannelOption(o => o.setName("channel").setDescription("Target channel")).addStringOption(o => o.setName("image").setDescription("Image URL")));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "send") {
    if (!await requireModerator(interaction)) return;
    const message = interaction.options.getString("message", true);
    const channelOpt = interaction.options.getChannel("channel");
    const channel = (channelOpt ? interaction.guild!.channels.cache.get(channelOpt.id) : interaction.channel) as any;
    const pingEveryone = interaction.options.getBoolean("ping_everyone") || false;
    const colorHex = interaction.options.getString("color") || "#FF4C4C";
    const title = interaction.options.getString("title") || "📢 Announcement";
    const color = parseInt(colorHex.replace("#", ""), 16) || COLORS.SMASH;

    const embed = new EmbedBuilder()
      .setColor(color as any)
      .setTitle(title)
      .setDescription(message)
      .setAuthor({ name: interaction.guild!.name, iconURL: interaction.guild!.iconURL() || undefined })
      .setTimestamp()
      .setFooter({ text: `Announced by ${interaction.user.tag}` });

    await channel.send({ content: pingEveryone ? "@everyone" : undefined, embeds: [embed] });
    await interaction.reply({ content: `${EMOJIS.CHECK} Announcement sent to <#${channel.id}>!`, ephemeral: true });
  }

  else if (sub === "news") {
    if (!await requireAdmin(interaction)) return;
    const title = interaction.options.getString("title", true);
    const content = interaction.options.getString("content", true);
    const channelOpt = interaction.options.getChannel("channel");
    const channel = (channelOpt ? interaction.guild!.channels.cache.get(channelOpt.id!) : interaction.channel) as any;
    const image = interaction.options.getString("image");

    const embed = new EmbedBuilder()
      .setColor(COLORS.SMASH)
      .setTitle(`📰 ${title}`)
      .setDescription(content)
      .setAuthor({ name: "Smash Knights News", iconURL: client.user!.displayAvatarURL() })
      .setTimestamp()
      .setFooter({ text: `Posted by ${interaction.user.tag}` });
    if (image) embed.setImage(image);

    await channel.send({ content: "@everyone 📢 **New Update!**", embeds: [embed] });
    await interaction.reply({ content: `${EMOJIS.CHECK} News posted to <#${channel.id}>!`, ephemeral: true });
  }
}
