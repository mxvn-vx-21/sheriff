import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const suggestionsTable = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  status: text("status").$type<"pending" | "approved" | "denied" | "implemented">().notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  messageId: text("message_id"),
  channelId: text("channel_id"),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const suggestionVotesTable = pgTable("suggestion_votes", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id").notNull(),
  discordId: text("discord_id").notNull(),
  vote: text("vote").$type<"up" | "down">().notNull(),
  votedAt: timestamp("voted_at").notNull().defaultNow(),
});

export type Suggestion = typeof suggestionsTable.$inferSelect;
