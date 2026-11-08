import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const giveawaysTable = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  prize: text("prize").notNull(),
  winnersCount: integer("winners_count").notNull().default(1),
  endAt: timestamp("end_at").notNull(),
  status: text("status").$type<"active" | "ended" | "cancelled">().notNull().default("active"),
  hostId: text("host_id").notNull(),
  requirementRoleId: text("requirement_role_id"),
  winners: text("winners").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const giveawayEntriesTable = pgTable("giveaway_entries", {
  id: serial("id").primaryKey(),
  giveawayId: integer("giveaway_id").notNull(),
  discordId: text("discord_id").notNull(),
  enteredAt: timestamp("entered_at").notNull().defaultNow(),
});

export type Giveaway = typeof giveawaysTable.$inferSelect;
