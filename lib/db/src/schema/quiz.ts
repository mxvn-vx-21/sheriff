import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quizQuestionsTable = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  options: text("options").array().notNull().default([]),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  difficulty: text("difficulty").$type<"easy" | "medium" | "hard">().notNull().default("medium"),
  category: text("category").notNull().default("general"),
  xpReward: integer("xp_reward").notNull().default(10),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizSessionsTable = pgTable("quiz_sessions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  questionId: integer("question_id").notNull(),
  messageId: text("message_id"),
  status: text("status").$type<"active" | "completed">().notNull().default("active"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const quizAnswersTable = pgTable("quiz_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  discordId: text("discord_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  correct: boolean("correct").notNull(),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
});

export const quizResultsTable = pgTable("quiz_results", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  totalAnswered: integer("total_answered").notNull().default(0),
  totalCorrect: integer("total_correct").notNull().default(0),
  totalXpEarned: integer("total_xp_earned").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuizQuestionSchema = createInsertSchema(quizQuestionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
export type QuizSession = typeof quizSessionsTable.$inferSelect;
