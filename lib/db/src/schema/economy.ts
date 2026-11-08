import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shopItemsTable = pgTable("shop_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  type: text("type").$type<"role" | "badge" | "cosmetic" | "boost">().notNull().default("cosmetic"),
  data: text("data"),
  emoji: text("emoji"),
  available: boolean("available").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userInventoryTable = pgTable("user_inventory", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
});

export const transactionLogsTable = pgTable("transaction_logs", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").$type<"earn" | "spend" | "transfer" | "gift">().notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertShopItemSchema = createInsertSchema(shopItemsTable).omit({ id: true, createdAt: true });
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type ShopItem = typeof shopItemsTable.$inferSelect;
