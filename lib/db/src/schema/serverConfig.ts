import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const serverConfigTable = pgTable("server_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  goodbyeChannelId: text("goodbye_channel_id"),
  goodbyeMessage: text("goodbye_message"),
  logChannelId: text("log_channel_id"),
  suggestionChannelId: text("suggestion_channel_id"),
  moderatorRoleId: text("moderator_role_id"),
  adminRoleId: text("admin_role_id"),
  muteRoleId: text("mute_role_id"),
  automodEnabled: boolean("automod_enabled").notNull().default(false),
  antiSpamEnabled: boolean("anti_spam_enabled").notNull().default(false),
  antiLinkEnabled: boolean("anti_link_enabled").notNull().default(false),
  antiRaidEnabled: boolean("anti_raid_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ServerConfig = typeof serverConfigTable.$inferSelect;
