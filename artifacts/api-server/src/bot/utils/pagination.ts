import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type ChatInputCommandInteraction } from "discord.js";

export async function paginateEmbeds(
  interaction: ChatInputCommandInteraction,
  embeds: EmbedBuilder[],
  timeout = 60000
): Promise<void> {
  if (embeds.length === 0) {
    await interaction.reply({ content: "No results found.", ephemeral: true });
    return;
  }

  if (embeds.length === 1) {
    await interaction.reply({ embeds: [embeds[0]!] });
    return;
  }

  let currentPage = 0;

  const getRow = (page: number) => {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("page_prev")
        .setLabel("◀ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("page_next")
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === embeds.length - 1),
    );
    return row;
  };

  const updateEmbed = (page: number) => {
    const embed = embeds[page]!;
    embed.setFooter({ text: `Page ${page + 1} of ${embeds.length}` });
    return embed;
  };

  const response = await interaction.reply({
    embeds: [updateEmbed(currentPage)],
    components: [getRow(currentPage)],
    fetchReply: true,
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "page_prev") currentPage--;
    if (i.customId === "page_next") currentPage++;
    await i.update({
      embeds: [updateEmbed(currentPage)],
      components: [getRow(currentPage)],
    });
  });

  collector.on("end", async () => {
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("page_prev").setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("page_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(true),
    );
    await interaction.editReply({ components: [disabledRow] }).catch(() => {});
  });
}
