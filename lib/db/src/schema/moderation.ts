import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const modLogsTable = pgTable("mod_logs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").$type<"ban" | "kick" | "mute" | "warn" | "timeout" | "unmute" | "unban">().notNull(),
  reason: text("reason"),
  duration: integer("duration"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const warningsTable = pgTable("warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  discordId: text("discord_id").notNull(),
  reason: text("reason").notNull(),
  moderatorId: text("moderator_id").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reactionRolesTable = pgTable("reaction_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  emoji: text("emoji").notNull(),
  roleId: text("role_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollsTable = pgTable("polls", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  question: text("question").notNull(),
  options: text("options").array().notNull().default([]),
  status: text("status").$type<"active" | "closed">().notNull().default("active"),
  createdBy: text("created_by").notNull(),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollVotesTable = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull(),
  discordId: text("discord_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  votedAt: timestamp("voted_at").notNull().defaultNow(),
});

export type ModLog = typeof modLogsTable.$inferSelect;
export type Warning = typeof warningsTable.$inferSelect;
export type ReactionRole = typeof reactionRolesTable.$inferSelect;
export type Poll = typeof pollsTable.$inferSelect;
