import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import type { BotCommand } from "./types.js";
import { logger } from "../lib/logger.js";
import { onReady } from "./events/ready.js";
import { onInteractionCreate, setCommands } from "./events/interactionCreate.js";
import { onGuildMemberAdd } from "./events/guildMemberAdd.js";
import { onGuildMemberRemove } from "./events/guildMemberRemove.js";
import { onMessageCreate } from "./events/messageCreate.js";
import { onMessageUpdate } from "./events/messageUpdate.js";
import { onMessageDelete } from "./events/messageDelete.js";

// Import all commands
import * as dex from "./commands/dex.js";
import * as parkour from "./commands/parkour.js";
import * as media from "./commands/media.js";
import * as quiz from "./commands/quiz.js";
import * as xp from "./commands/xp.js";
import * as economy from "./commands/economy.js";
import * as giveaway from "./commands/giveaway.js";
import * as moderation from "./commands/moderation.js";
import * as tournament from "./commands/tournament.js";
import * as verification from "./commands/verification.js";
import * as profile from "./commands/profile.js";
import * as tips from "./commands/tips.js";
import * as daily from "./commands/daily.js";
import * as achievements from "./commands/achievements.js";
import * as poll from "./commands/poll.js";
import * as suggest from "./commands/suggest.js";
import * as ticket from "./commands/ticket.js";
import * as welcome from "./commands/welcome.js";
import * as article from "./commands/article.js";
import * as stats from "./commands/stats.js";
import * as announce from "./commands/announce.js";
import * as admin from "./commands/admin.js";
import * as reactionrole from "./commands/reactionrole.js";
import * as event from "./commands/event.js";

const commands = new Map<string, BotCommand>();

function registerCommand(name: string, cmd: BotCommand): void {
  commands.set(name, cmd);
}

// Register all commands
registerCommand("dex", { data: dex.data, execute: dex.execute });
registerCommand("parkour", { data: parkour.data, execute: parkour.execute });
registerCommand("media", { data: media.data, execute: media.execute });
registerCommand("quiz", { data: quiz.data, execute: quiz.execute });
registerCommand("xp", { data: xp.data, execute: xp.execute });
registerCommand("economy", { data: economy.data, execute: economy.execute });
registerCommand("giveaway", { data: giveaway.data, execute: giveaway.execute });
registerCommand("mod", { data: moderation.data, execute: moderation.execute });
registerCommand("tournament", { data: tournament.data, execute: tournament.execute });
registerCommand("link", { data: verification.data, execute: verification.execute });
registerCommand("unlink", { data: verification.unlinkData, execute: verification.executeUnlink });
registerCommand("linkedaccount", { data: verification.linkedAccountData, execute: verification.executeLinkedAccount });
registerCommand("profile", { data: profile.data, execute: profile.execute });
registerCommand("tips", { data: tips.data, execute: tips.execute, cooldown: 5 });
registerCommand("daily", { data: daily.data, execute: daily.execute });
registerCommand("challenge", { data: daily.challengeData, execute: daily.executeChallenge });
registerCommand("achievements", { data: achievements.data, execute: achievements.execute });
registerCommand("poll", { data: poll.data, execute: poll.execute });
registerCommand("suggest", { data: suggest.data, execute: suggest.execute, cooldown: 30 });
registerCommand("suggestions", { data: suggest.suggestionsData, execute: suggest.executeSuggestions });
registerCommand("ticket", { data: ticket.data, execute: ticket.execute });
registerCommand("welcome", { data: welcome.data, execute: welcome.execute });
registerCommand("goodbye", { data: welcome.goodbyeData, execute: welcome.executeGoodbye });
registerCommand("article", { data: article.data, execute: article.execute });
registerCommand("instruction", { data: article.instructionData, execute: article.executeInstruction });
registerCommand("stats", { data: stats.data, execute: stats.execute });
registerCommand("announce", { data: announce.data, execute: announce.execute });
registerCommand("admin", { data: admin.data, execute: admin.execute });
registerCommand("reactionrole", { data: reactionrole.data, execute: reactionrole.execute });
registerCommand("event", { data: event.data, execute: event.execute });

export function getAllCommandData() {
  return [...commands.values()].map(cmd => cmd.data.toJSON());
}

export async function startBot(): Promise<Client | null> {
  const token = process.env["BOT_TOKEN"];
  if (!token) {
    logger.warn("BOT_TOKEN not set — Discord bot will not start. Set BOT_TOKEN to enable the bot.");
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  setCommands(commands);

  client.once("ready", (c) => onReady(c));
  client.on("interactionCreate", (i) => onInteractionCreate(i, client));
  client.on("guildMemberAdd", (m) => onGuildMemberAdd(m));
  client.on("guildMemberRemove", (m) => onGuildMemberRemove(m));
  client.on("messageCreate", (m) => onMessageCreate(m));
  client.on("messageUpdate", (old, next) => onMessageUpdate(old, next));
  client.on("messageDelete", (m) => onMessageDelete(m));

  client.on("error", (err) => logger.error({ err }, "Discord client error"));

  await client.login(token);
  return client;
}
