import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { db } from "@workspace/db";
import { usersTable, shopItemsTable, userInventoryTable, transactionLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { errorEmbed, successEmbed, primaryEmbed, COLORS, EMOJIS } from "../utils/embeds.js";
import { getOrCreateUser, addCoins } from "../utils/xp.js";
import { paginateEmbeds } from "../utils/pagination.js";
import { requireAdmin } from "../utils/permissions.js";

const DAILY_COINS = 100;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("economy")
  .setDescription("Economy System")
  .addSubcommand(s => s.setName("balance").setDescription("Check your coin balance").addUserOption(o => o.setName("user").setDescription("User to check")))
  .addSubcommand(s => s.setName("daily").setDescription("Claim your daily coins"))
  .addSubcommand(s => s.setName("shop").setDescription("Browse the shop"))
  .addSubcommand(s => s.setName("buy").setDescription("Buy an item from the shop").addIntegerOption(o => o.setName("item_id").setDescription("Item ID").setRequired(true)))
  .addSubcommand(s => s.setName("inventory").setDescription("View your inventory").addUserOption(o => o.setName("user").setDescription("User to check")))
  .addSubcommand(s => s.setName("additem").setDescription("Add shop item (Admin)").addStringOption(o => o.setName("name").setDescription("Item name").setRequired(true)).addStringOption(o => o.setName("description").setDescription("Description").setRequired(true)).addIntegerOption(o => o.setName("price").setDescription("Price in coins").setRequired(true)).addStringOption(o => o.setName("emoji").setDescription("Emoji")));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "balance") {
    const target = interaction.options.getUser("user") || interaction.user;
    const user = await getOrCreateUser(target.id, target.username);
    const embed = new EmbedBuilder()
      .setColor(COLORS.GOLD)
      .setTitle(`${EMOJIS.COIN} ${target.username}'s Balance`)
      .setThumbnail(target.displayAvatarURL())
      .addFields({ name: "💰 Coins", value: `**${user.coins.toLocaleString()}** coins`, inline: true }, { name: "Level", value: `**${user.level}**`, inline: true })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "daily") {
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
    const now = Date.now();
    if (user.lastDailyClaim && now - user.lastDailyClaim.getTime() < DAILY_COOLDOWN_MS) {
      const timeLeft = DAILY_COOLDOWN_MS - (now - user.lastDailyClaim.getTime());
      const hours = Math.floor(timeLeft / 3600000);
      const minutes = Math.floor((timeLeft % 3600000) / 60000);
      await interaction.reply({ embeds: [errorEmbed("Already Claimed", `You can claim your daily coins again in **${hours}h ${minutes}m**`)], ephemeral: true });
      return;
    }
    const bonus = Math.floor(Math.random() * 50);
    const total = DAILY_COINS + bonus;
    await db.update(usersTable).set({ coins: user.coins + total, lastDailyClaim: new Date(), updatedAt: new Date() }).where(eq(usersTable.discordId, interaction.user.id));
    await db.insert(transactionLogsTable).values({ discordId: interaction.user.id, amount: total, type: "earn", reason: "Daily claim" });
    await interaction.reply({ embeds: [successEmbed("Daily Claimed!", `${EMOJIS.COIN} You received **${total}** coins${bonus > 0 ? ` (including ${bonus} bonus)` : ""}!\n💰 New balance: **${user.coins + total}** coins`)] });
  }

  else if (sub === "shop") {
    const items = await db.select().from(shopItemsTable).where(eq(shopItemsTable.available, true));
    if (!items.length) { await interaction.reply({ embeds: [primaryEmbed("🛒 Shop", "The shop is empty! Admins can add items with `/economy additem`.")] }); return; }
    const CHUNK = 5;
    const embeds: EmbedBuilder[] = [];
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      const embed = new EmbedBuilder().setColor(COLORS.GOLD).setTitle("🛒 SmashKnights Shop").setDescription(chunk.map(item => `**${item.id}.** ${item.emoji || "🎁"} **${item.name}** — ${EMOJIS.COIN} ${item.price}\n${item.description}`).join("\n\n")).setFooter({ text: "Use /economy buy <id> to purchase" }).setTimestamp();
      embeds.push(embed);
    }
    await paginateEmbeds(interaction, embeds);
  }

  else if (sub === "buy") {
    const itemId = interaction.options.getInteger("item_id", true);
    const [item] = await db.select().from(shopItemsTable).where(eq(shopItemsTable.id, itemId)).limit(1);
    if (!item || !item.available) { await interaction.reply({ embeds: [errorEmbed("Not Found", `No item with ID ${itemId} found in the shop.`)], ephemeral: true }); return; }
    const user = await getOrCreateUser(interaction.user.id, interaction.user.username);
    if (user.coins < item.price) { await interaction.reply({ embeds: [errorEmbed("Insufficient Funds", `You need **${item.price}** coins but only have **${user.coins}**.`)], ephemeral: true }); return; }
    await db.update(usersTable).set({ coins: user.coins - item.price, updatedAt: new Date() }).where(eq(usersTable.discordId, interaction.user.id));
    await db.insert(userInventoryTable).values({ discordId: interaction.user.id, itemId });
    await db.insert(transactionLogsTable).values({ discordId: interaction.user.id, amount: -item.price, type: "spend", reason: `Bought: ${item.name}` });
    await interaction.reply({ embeds: [successEmbed("Purchase Complete!", `You bought **${item.emoji || ""} ${item.name}** for ${EMOJIS.COIN} **${item.price}** coins!\n💰 New balance: **${user.coins - item.price}** coins`)] });
  }

  else if (sub === "inventory") {
    const target = interaction.options.getUser("user") || interaction.user;
    const inv = await db.select({ item: shopItemsTable, quantity: userInventoryTable.quantity, purchasedAt: userInventoryTable.purchasedAt }).from(userInventoryTable).innerJoin(shopItemsTable, eq(userInventoryTable.itemId, shopItemsTable.id)).where(eq(userInventoryTable.discordId, target.id));
    if (!inv.length) { await interaction.reply({ embeds: [primaryEmbed(`${target.username}'s Inventory`, "Inventory is empty! Buy items from `/economy shop`.")] }); return; }
    const embed = new EmbedBuilder().setColor(COLORS.PURPLE).setTitle(`🎒 ${target.username}'s Inventory`).setDescription(inv.map(({ item, quantity }) => `${item.emoji || "🎁"} **${item.name}** x${quantity}`).join("\n")).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "additem") {
    if (!await requireAdmin(interaction)) return;
    const [item] = await db.insert(shopItemsTable).values({
      name: interaction.options.getString("name", true),
      description: interaction.options.getString("description", true),
      price: interaction.options.getInteger("price", true),
      emoji: interaction.options.getString("emoji") || undefined,
      type: "cosmetic",
      createdBy: interaction.user.id,
    }).returning();
    await interaction.reply({ embeds: [successEmbed("Item Added", `**${item!.emoji || "🎁"} ${item!.name}** added to the shop for ${EMOJIS.COIN} ${item!.price}! (ID: ${item!.id})`)] });
  }
}
