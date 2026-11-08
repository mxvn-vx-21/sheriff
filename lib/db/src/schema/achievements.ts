import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  emoji: text("emoji").notNull().default("🏆"),
  xpReward: integer("xp_reward").notNull().default(50),
  coinReward: integer("coin_reward").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userAchievementsTable = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  achievementSlug: text("achievement_slug").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  emoji: text("emoji").notNull(),
  imageUrl: text("image_url"),
  rarity: text("rarity").$type<"common" | "rare" | "epic" | "legendary">().notNull().default("common"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  badgeId: integer("badge_id").notNull(),
  grantedBy: text("granted_by").notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
});

export type Achievement = typeof achievementsTable.$inferSelect;
export type UserAchievement = typeof userAchievementsTable.$inferSelect;
export type Badge = typeof badgesTable.$inferSelect;
