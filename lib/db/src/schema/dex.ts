import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dexEntriesTable = pgTable("dex_entries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").$type<"weapons" | "maps" | "parkour" | "strategies" | "techniques" | "tournaments" | "clans" | "other">().notNull(),
  description: text("description").notNull(),
  images: text("images").array().notNull().default([]),
  videos: text("videos").array().notNull().default([]),
  tips: text("tips").array().notNull().default([]),
  difficulty: text("difficulty").$type<"beginner" | "intermediate" | "advanced" | "expert">().notNull().default("beginner"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDexEntrySchema = createInsertSchema(dexEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDexEntry = z.infer<typeof insertDexEntrySchema>;
export type DexEntry = typeof dexEntriesTable.$inferSelect;
