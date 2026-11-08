import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const ticketPanelsTable = pgTable("ticket_panels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  categoryId: text("category_id").notNull(),
  panelTitle: text("panel_title").notNull().default("Support Tickets"),
  panelDescription: text("panel_description").notNull().default("Click the button below to create a support ticket."),
  supportRoleId: text("support_role_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  authorId: text("author_id").notNull(),
  claimedBy: text("claimed_by"),
  status: text("status").$type<"open" | "claimed" | "closed">().notNull().default("open"),
  subject: text("subject"),
  panelId: integer("panel_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export type TicketPanel = typeof ticketPanelsTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
