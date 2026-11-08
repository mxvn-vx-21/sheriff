import type { Message, TextChannel, GuildMember } from "discord.js";
import { db } from "@workspace/db";
import { serverConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { addXp } from "../utils/xp.js";
import { checkCooldown } from "../utils/cooldown.js";
import { logger } from "../../lib/logger.js";

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
const spamTracker = new Map<string, { count: number; lastTime: number }>();

// Level role thresholds: { level, roleName, removedRole }
const LEVEL_ROLES = [
  { level: 5,  roleName: "Knight",  removedRole: "Trainee"  },
  { level: 15, roleName: "Warlord", removedRole: "Knight"   },
  { level: 25, roleName: "Elite",   removedRole: "Warlord"  },
];

async function handleLevelRoles(member: GuildMember, newLevel: number): Promise<void> {
  try {
    const guild = member.guild;

    // Find which role this level should grant
    let toGive: string | null = null;
    let toRemove: string | null = null;

    for (const { level, roleName, removedRole } of LEVEL_ROLES) {
      if (newLevel === level) {
        toGive = roleName;
        toRemove = removedRole;
        break;
      }
    }

    if (!toGive) return;

    const giveRole = guild.roles.cache.find(r => r.name === toGive);
    const removeRole = toRemove ? guild.roles.cache.find(r => r.name === toRemove) : null;

    if (giveRole && !member.roles.cache.has(giveRole.id)) {
      await member.roles.add(giveRole, `Level ${newLevel} reached — ${toGive} role`);
    }
    if (removeRole && member.roles.cache.has(removeRole.id)) {
      await member.roles.remove(removeRole, `Upgraded from ${toRemove} to ${toGive}`);
    }
  } catch (err) {
    logger.error({ err }, "Failed to assign level role");
  }
}

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot || !message.guild || !message.channel.isTextBased()) return;

  const textChannel = message.channel as TextChannel;

  try {
    const [config] = await db.select().from(serverConfigTable).where(eq(serverConfigTable.guildId, message.guild.id)).limit(1);

    // Anti-link
    if (config?.antiLinkEnabled && URL_REGEX.test(message.content)) {
      const member = message.member;
      if (!member?.permissions.has("ManageMessages")) {
        await message.delete().catch(() => {});
        const warn = await textChannel.send({ content: `${message.author}, links are not allowed in this server!` });
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }
    }

    // Anti-spam (5 messages in 5 seconds)
    if (config?.antiSpamEnabled) {
      const key = `${message.guild.id}:${message.author.id}`;
      const tracker = spamTracker.get(key) || { count: 0, lastTime: Date.now() };
      if (Date.now() - tracker.lastTime > 5000) {
        tracker.count = 1;
        tracker.lastTime = Date.now();
      } else {
        tracker.count++;
      }
      spamTracker.set(key, tracker);

      if (tracker.count >= 5) {
        const member = message.member;
        if (!member?.permissions.has("ManageMessages")) {
          await message.delete().catch(() => {});
          textChannel.send({ content: `${message.author} Please stop spamming!` })
            .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
            .catch(() => {});
          tracker.count = 0;
          return;
        }
      }
    }

    // XP on message (1 per minute per user, 5–15 XP)
    const xpCooldownRemaining = checkCooldown(message.author.id, "message_xp", 60);
    if (!xpCooldownRemaining) {
      const xpGain = Math.floor(Math.random() * 10) + 5;
      const { leveled, newLevel } = await addXp(message.author.id, message.author.username, xpGain);
      if (leveled) {
        textChannel.send({ content: `🎉 Congratulations ${message.author}! You leveled up to **Level ${newLevel}**! ✨` })
          .then((m) => setTimeout(() => m.delete().catch(() => {}), 10000))
          .catch(() => {});

        // Assign level role if applicable
        if (message.member) {
          await handleLevelRoles(message.member, newLevel);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in messageCreate handler");
  }
}
