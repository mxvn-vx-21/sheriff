import { EmbedBuilder, ColorResolvable } from "discord.js";

export const COLORS = {
  PRIMARY: 0x5865F2 as ColorResolvable,
  SUCCESS: 0x57F287 as ColorResolvable,
  ERROR: 0xED4245 as ColorResolvable,
  WARNING: 0xFEE75C as ColorResolvable,
  INFO: 0x5BC0EB as ColorResolvable,
  GOLD: 0xFFD700 as ColorResolvable,
  PURPLE: 0x9B59B6 as ColorResolvable,
  ORANGE: 0xE67E22 as ColorResolvable,
  SMASH: 0xFF4C4C as ColorResolvable,
};

export const EMOJIS = {
  TROPHY: "🏆",
  SWORD: "⚔️",
  SHIELD: "🛡️",
  STAR: "⭐",
  FIRE: "🔥",
  CROWN: "👑",
  COIN: "🪙",
  GEM: "💎",
  XP: "✨",
  CHECK: "✅",
  CROSS: "❌",
  WARNING: "⚠️",
  INFO: "ℹ️",
  MAP: "🗺️",
  VIDEO: "🎬",
  MEDAL: "🥇",
  PARKOUR: "🏃",
  QUIZ: "🧠",
  LINK: "🔗",
  LOCK: "🔒",
  UNLOCK: "🔓",
  TICKET: "🎫",
  BELL: "🔔",
  CHART: "📊",
  PENCIL: "✏️",
  TRASH: "🗑️",
  CLOCK: "⏰",
  LOADING: "⏳",
};

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.CHECK} ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`${EMOJIS.CROSS} ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.INFO} ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function primaryEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(title)
    .setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function smashEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SMASH)
    .setTitle(`⚔️ ${title}`)
    .setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
}

export function tournamentEmbed(name: string, description: string, type: string, bracketType: string, maxParticipants: number, prize?: string | null, rules?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle(`${EMOJIS.TROPHY} ${name}`)
    .setDescription(description)
    .addFields(
      { name: "📋 Type", value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
      { name: "🏟️ Bracket", value: bracketType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), inline: true },
      { name: "👥 Max Players", value: String(maxParticipants), inline: true },
    )
    .setTimestamp();
  if (prize) embed.addFields({ name: `${EMOJIS.CROWN} Prize`, value: prize });
  if (rules) embed.addFields({ name: "📜 Rules", value: rules });
  return embed;
}
