import { pgTable, serial, text, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const verificationStatusEnum = ["pending", "otp_sent", "otp_verified", "screenshot_submitted", "approved", "denied"] as const;

// Sheriff tiers — manually assigned by admins, no XP/level progression.
export const tierEnum = ["TIER_I", "TIER_II", "TIER_III"] as const;

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  ign: text("ign"),
  smashkartsUsername: text("smashkarts_username"),
  smashkartsId: text("smashkarts_id"),
  kills: integer("kills").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  kdr: decimal("kdr", { precision: 10, scale: 2 }).notNull().default("0"),
  tier: text("tier").$type<typeof tierEnum[number]>().notNull().default("TIER_III"),
  smashkartsLevel: integer("smashkarts_level").notNull().default(1),
  smashkartsCoins: integer("smashkarts_coins").notNull().default(0),
  smashkartsGems: integer("smashkarts_gems").notNull().default(0),
  characterTokens: integer("character_tokens").notNull().default(0),
  verificationStatus: text("verification_status").$type<typeof verificationStatusEnum[number]>().notNull().default("pending"),
  verificationDate: timestamp("verification_date"),
  profileScreenshot: text("profile_screenshot"),
  statsScreenshot: text("stats_screenshot"),
  otpCode: text("otp_code"),
  otpExpiry: timestamp("otp_expiry"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
