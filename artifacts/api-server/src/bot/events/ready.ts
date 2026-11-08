import type { Client } from "discord.js";
import { REST, Routes } from "discord.js";
import { logger } from "../../lib/logger.js";
import { getAllCommandData } from "../index.js";
import cron from "node-cron";
import { db } from "@workspace/db";
import { mediaChannelsTable, giveawaysTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import axios from "axios";

export async function onReady(client: Client<true>): Promise<void> {
  logger.info({ tag: client.user.tag, guilds: client.guilds.cache.size }, "Smash Knights bot is online!");

  // Register slash commands
  const token = process.env["BOT_TOKEN"];
  if (!token) { logger.error("BOT_TOKEN not set — skipping command registration"); return; }

  const rest = new REST().setToken(token);
  const commands = getAllCommandData();

  try {
    logger.info(`Registering ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    logger.info("Slash commands registered successfully");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }

  // Schedule YouTube check every 15 minutes
  cron.schedule("*/15 * * * *", () => checkYouTube(client));

  // Schedule giveaway check every minute
  cron.schedule("* * * * *", () => checkGiveaways(client));

  client.user.setPresence({
    activities: [{ name: "SmashKarts | /help", type: 3 }],
    status: "online",
  });
}

async function checkYouTube(client: Client): Promise<void> {
  const youtubeKey = process.env["YOUTUBE_API_KEY"];
  if (!youtubeKey) return;

  const channels = await db.select().from(mediaChannelsTable);
  for (const ch of channels) {
    try {
      const res = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
        params: { part: "snippet", q: ch.searchQuery, type: "video", order: "date", maxResults: 5, key: youtubeKey, publishedAfter: ch.lastChecked?.toISOString() || new Date(Date.now() - 15 * 60 * 1000).toISOString() },
      });

      const videos = res.data.items || [];
      for (const video of videos.reverse()) {
        const videoId = video.id.videoId;
        if (ch.lastVideoId === videoId) continue;

        const guild = client.guilds.cache.find(g => g.channels.cache.has(ch.channelId));
        const channel = guild?.channels.cache.get(ch.channelId) as any;
        if (!channel) continue;

        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`🎬 New Video: ${video.snippet.title}`)
          .setDescription(video.snippet.description?.substring(0, 300) || "")
          .setURL(`https://youtube.com/watch?v=${videoId}`)
          .setImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
          .addFields({ name: "Channel", value: video.snippet.channelTitle, inline: true })
          .setTimestamp(new Date(video.snippet.publishedAt));

        await channel.send({ embeds: [embed], content: `🎬 New SmashKarts video: https://youtube.com/watch?v=${videoId}` });
        await db.update(mediaChannelsTable).set({ lastVideoId: videoId, lastChecked: new Date() }).where(eq(mediaChannelsTable.id, ch.id));
        break; // Only post one video per check
      }
    } catch (err) {
      logger.error({ err }, "YouTube check failed");
    }
  }
}

async function checkGiveaways(client: Client): Promise<void> {
  try {
    const expired = await db.select().from(giveawaysTable).where(eq(giveawaysTable.status, "active"));
    const now = new Date();
    for (const giveaway of expired) {
      if (giveaway.endAt <= now) {
        const { endGiveaway } = await import("../handlers/giveawayHandler.js");
        await endGiveaway(giveaway, client);
      }
    }
  } catch {}
}
