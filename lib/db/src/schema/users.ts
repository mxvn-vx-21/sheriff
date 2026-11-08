import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  coins: integer("coins").notNull().default(0),
  lastDailyClaim: timestamp("last_daily_claim"),
  lastChallengeClaim: timestamp("last_challenge_claim"),
  quizStreak: integer("quiz_streak").notNull().default(0),
  lastQuizDate: timestamp("last_quiz_date"),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
