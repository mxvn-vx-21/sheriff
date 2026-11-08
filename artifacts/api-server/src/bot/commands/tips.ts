import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { dexEntriesTable } from "@workspace/db";
import { ilike, eq, or } from "drizzle-orm";
import { errorEmbed, COLORS, EMOJIS } from "../utils/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("tips")
  .setDescription("Get SmashKarts tips from the database")
  .addStringOption(o => o.setName("topic").setDescription("What do you need tips for?").setRequired(true))
  .addStringOption(o => o.setName("category").setDescription("Filter by category").addChoices(
    { name: "Weapons", value: "weapons" },
    { name: "Maps", value: "maps" },
    { name: "Parkour", value: "parkour" },
    { name: "Strategies", value: "strategies" },
    { name: "Techniques", value: "techniques" },
  ));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();
  const topic = interaction.options.getString("topic", true);
  const category = interaction.options.getString("category") as any;

  const entries = await db.select().from(dexEntriesTable).where(
    or(
      ilike(dexEntriesTable.name, `%${topic}%`),
      ilike(dexEntriesTable.description, `%${topic}%`),
      ...(category ? [eq(dexEntriesTable.category, category)] : []),
    )
  ).limit(3);

  if (!entries.length || entries.every(e => !e.tips.length)) {
    await interaction.editReply({ embeds: [errorEmbed("No Tips Found", `No tips found for **"${topic}"**.\n\nTry searching the dex with \`/dex search\` for related entries.`)] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.SMASH)
    .setTitle(`${EMOJIS.FIRE} SmashKarts Tips — "${topic}"`)
    .setDescription("Here are tips from the SmashKarts database:")
    .setTimestamp();

  for (const entry of entries) {
    if (entry.tips.length) {
      embed.addFields({
        name: `${EMOJIS.STAR} ${entry.name} *(${entry.category})*`,
        value: entry.tips.map(t => `• ${t}`).join("\n").substring(0, 1024),
      });
    }
  }

  embed.setFooter({ text: "All tips sourced from the SmashKarts Dex database" });
  await interaction.editReply({ embeds: [embed] });
}
