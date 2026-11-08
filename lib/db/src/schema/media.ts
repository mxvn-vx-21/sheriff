import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mediaLibraryTable = pgTable("media_library", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  link: text("link").notNull(),
  tags: text("tags").array().notNull().default([]),
  creator: text("creator"),
  addedBy: text("added_by").notNull(),
  youtubeVideoId: text("youtube_video_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mediaChannelsTable = pgTable("media_channels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  channelId: text("channel_id").notNull(),
  searchQuery: text("search_query").notNull().default("smashkarts"),
  lastChecked: timestamp("last_checked"),
  lastVideoId: text("last_video_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMediaSchema = createInsertSchema(mediaLibraryTable).omit({ id: true, createdAt: true });
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof mediaLibraryTable.$inferSelect;
export type MediaChannel = typeof mediaChannelsTable.$inferSelect;
