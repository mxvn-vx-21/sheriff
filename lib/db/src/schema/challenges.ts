import { pgTable, serial, text, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";

export const challengesTable = pgTable("challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull().default(25),
  coinReward: integer("coin_reward").notNull().default(10),
  difficulty: text("difficulty").$type<"easy" | "medium" | "hard">().notNull().default("easy"),
  category: text("category").notNull().default("general"),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userChallengesTable = pgTable("user_challenges", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  challengeId: integer("challenge_id").notNull(),
  completedDate: text("completed_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Challenge = typeof challengesTable.$inferSelect;
