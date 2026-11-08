import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parkourRoutesTable = pgTable("parkour_routes", {
  id: serial("id").primaryKey(),
  mapName: text("map_name").notNull(),
  spotName: text("spot_name").notNull(),
  description: text("description").notNull(),
  videoUrl: text("video_url"),
  difficulty: text("difficulty").$type<"beginner" | "intermediate" | "advanced" | "expert">().notNull().default("beginner"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertParkourRouteSchema = createInsertSchema(parkourRoutesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertParkourRoute = z.infer<typeof insertParkourRouteSchema>;
export type ParkourRoute = typeof parkourRoutesTable.$inferSelect;
