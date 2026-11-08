import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export async function getOrCreateUser(discordId: string, username: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
  if (existing[0]) return existing[0];

  const [newUser] = await db.insert(usersTable).values({ discordId, username }).returning();
  return newUser!;
}

export async function addXp(discordId: string, username: string, amount: number): Promise<{ leveled: boolean; newLevel: number; newXp: number }> {
  const user = await getOrCreateUser(discordId, username);
  const newXp = user.xp + amount;
  const newLevel = levelForXp(newXp);
  const leveled = newLevel > user.level;

  await db.update(usersTable).set({
    xp: newXp,
    level: newLevel,
    username,
    updatedAt: new Date(),
  }).where(eq(usersTable.discordId, discordId));

  return { leveled, newLevel, newXp };
}

export async function addCoins(discordId: string, username: string, amount: number): Promise<number> {
  const user = await getOrCreateUser(discordId, username);
  const newCoins = Math.max(0, user.coins + amount);
  await db.update(usersTable).set({ coins: newCoins, username, updatedAt: new Date() }).where(eq(usersTable.discordId, discordId));
  return newCoins;
}

export async function checkAchievement(discordId: string, slug: string): Promise<boolean> {
  const { userAchievementsTable } = await import("@workspace/db");
  const { and } = await import("drizzle-orm");
  const existing = await db.select().from(userAchievementsTable)
    .where(and(eq(userAchievementsTable.discordId, discordId), eq(userAchievementsTable.achievementSlug, slug)))
    .limit(1);
  return existing.length > 0;
}

export async function grantAchievement(discordId: string, slug: string): Promise<boolean> {
  const already = await checkAchievement(discordId, slug);
  if (already) return false;
  const { userAchievementsTable } = await import("@workspace/db");
  await db.insert(userAchievementsTable).values({ discordId, achievementSlug: slug });
  return true;
}
