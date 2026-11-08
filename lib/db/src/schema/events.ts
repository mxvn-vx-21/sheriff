import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  channelId: text("channel_id"),
  messageId: text("message_id"),
  maxParticipants: integer("max_participants"),
  status: text("status").$type<"upcoming" | "active" | "ended" | "cancelled">().notNull().default("upcoming"),
  xpReward: integer("xp_reward").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventRegistrationsTable = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  discordId: text("discord_id").notNull(),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;
