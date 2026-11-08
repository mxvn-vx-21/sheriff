import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").$type<"solo" | "duo" | "team">().notNull().default("solo"),
  status: text("status").$type<"pending" | "open" | "checkin" | "active" | "completed" | "cancelled">().notNull().default("pending"),
  bracketType: text("bracket_type").$type<"single_elimination" | "double_elimination" | "round_robin">().notNull().default("single_elimination"),
  maxParticipants: integer("max_participants").notNull().default(16),
  registrationChannelId: text("registration_channel_id"),
  registrationMessageId: text("registration_message_id"),
  startDate: timestamp("start_date"),
  prizeInfo: text("prize_info"),
  rules: text("rules"),
  tournamentRoleId: text("tournament_role_id"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tournamentParticipantsTable = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  discordId: text("discord_id").notNull(),
  teamId: integer("team_id"),
  checkedIn: boolean("checked_in").notNull().default(false),
  placement: integer("placement"),
  eliminated: boolean("eliminated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  name: text("name").notNull(),
  captainId: text("captain_id").notNull(),
  roleId: text("role_id"),
  members: text("members").array().notNull().default([]),
  eliminated: boolean("eliminated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bracketsTable = pgTable("brackets", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().unique(),
  type: text("type").$type<"single_elimination" | "double_elimination" | "round_robin">().notNull(),
  data: text("data").notNull().default("{}"),
  currentRound: integer("current_round").notNull().default(1),
  totalRounds: integer("total_rounds").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  bracketId: integer("bracket_id").notNull(),
  round: integer("round").notNull(),
  matchNumber: integer("match_number").notNull(),
  participant1Id: integer("participant1_id"),
  participant2Id: integer("participant2_id"),
  winnerId: integer("winner_id"),
  status: text("status").$type<"pending" | "active" | "completed" | "bye">().notNull().default("pending"),
  reportedBy: text("reported_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipantsTable.$inferSelect;
export type Team = typeof teamsTable.$inferSelect;
export type Match = typeof matchesTable.$inferSelect;
