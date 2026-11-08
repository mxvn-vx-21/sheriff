import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array().notNull().default([]),
  category: text("category").notNull().default("general"),
  authorId: text("author_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const instructionsTable = pgTable("instructions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  videoUrl: text("video_url").notNull(),
  category: text("category").notNull().default("general"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Article = typeof articlesTable.$inferSelect;
export type Instruction = typeof instructionsTable.$inferSelect;
