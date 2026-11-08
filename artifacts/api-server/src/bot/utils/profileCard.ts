import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";

// Sheriff / OutLaws player card — one reusable template.
// Dark black background, charcoal panel, silver/off-white type, no color bloat.
// Only text, avatar and stats change between renders.

const WIDTH = 700;
const HEIGHT = 900;

const COLORS = {
  bg: "#0a0a0a",
  panel: "#161616",
  panelBorder: "#2a2a2a",
  silver: "#e6e6e6",
  mutedSilver: "#9a9a9a",
  dimSilver: "#6b6b6b",
  divider: "#2a2a2a",
  avatarRing: "#3a3a3a",
};

const TIER_LABEL: Record<string, string> = {
  TIER_I: "TIER I",
  TIER_II: "TIER II",
  TIER_III: "TIER III",
};

export interface ProfileCardData {
  ign: string;
  discordUsername: string;
  skid: string;
  tier: "TIER_I" | "TIER_II" | "TIER_III";
  kills: number;
  deaths: number;
  kdr: string;
  wins: number;
  reviewed: boolean;
  updatedAt: Date | null;
  avatarUrl: string;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "\u2026").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "\u2026";
}

export async function renderProfileCard(data: ProfileCardData): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Outer panel
  const pad = 28;
  roundRect(ctx, pad, pad, WIDTH - pad * 2, HEIGHT - pad * 2, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.stroke();

  // Header — Sheriff / OutLaws branding
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.mutedSilver;
  ctx.font = "600 20px sans-serif";
  ctx.fillText("S H E R I F F", WIDTH / 2, 90);
  ctx.fillStyle = COLORS.dimSilver;
  ctx.font = "400 14px sans-serif";
  ctx.fillText("OUTLAWS", WIDTH / 2, 112);

  // Thin divider under header
  ctx.beginPath();
  ctx.moveTo(pad + 40, 134);
  ctx.lineTo(WIDTH - pad - 40, 134);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Circular avatar, centered
  const avatarR = 78;
  const avatarCx = WIDTH / 2;
  const avatarCy = 236;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.avatarRing;
  ctx.fill();
  ctx.restore();

  try {
    const img = await loadImage(data.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
  } catch {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.restore();
  }

  // Tier badge, under avatar
  const tierText = TIER_LABEL[data.tier] ?? "TIER III";
  ctx.font = "600 13px sans-serif";
  const tierW = ctx.measureText(tierText).width + 28;
  const tierH = 26;
  const tierX = avatarCx - tierW / 2;
  const tierY = avatarCy + avatarR + 18;
  roundRect(ctx, tierX, tierY, tierW, tierH, tierH / 2);
  ctx.fillStyle = "#1e1e1e";
  ctx.fill();
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.silver;
  ctx.textBaseline = "middle";
  ctx.fillText(tierText, avatarCx, tierY + tierH / 2 + 1);
  ctx.textBaseline = "alphabetic";

  // IGN (large) + Discord username (small) below tier badge
  let cursorY = tierY + tierH + 40;
  ctx.font = "700 28px sans-serif";
  ctx.fillStyle = COLORS.silver;
  ctx.fillText(truncate(ctx, data.ign || "Unknown Driver", WIDTH - pad * 2 - 60), avatarCx, cursorY);

  cursorY += 24;
  ctx.font = "400 14px sans-serif";
  ctx.fillStyle = COLORS.dimSilver;
  ctx.fillText(truncate(ctx, `@${data.discordUsername}`, WIDTH - pad * 2 - 60), avatarCx, cursorY);

  // SKID row (copyable value lives in the embed, this is display-only)
  cursorY += 34;
  ctx.font = "500 13px sans-serif";
  ctx.fillStyle = COLORS.dimSilver;
  ctx.fillText("SKID", avatarCx, cursorY);
  cursorY += 20;
  ctx.font = "600 15px monospace";
  ctx.fillStyle = COLORS.mutedSilver;
  ctx.fillText(data.skid || "—", avatarCx, cursorY);

  // Divider above stats
  cursorY += 28;
  ctx.beginPath();
  ctx.moveTo(pad + 40, cursorY);
  ctx.lineTo(WIDTH - pad - 40, cursorY);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Stat grid — Kills / Deaths / KDR / Wins
  const stats: [string, string][] = [
    ["KILLS", String(data.kills)],
    ["DEATHS", String(data.deaths)],
    ["KDR", data.kdr],
    ["WINS", String(data.wins)],
  ];

  const gridTop = cursorY + 34;
  const colW = (WIDTH - pad * 2 - 40) / stats.length;
  const gridLeft = pad + 20;

  stats.forEach(([label, value], i) => {
    const cx = gridLeft + colW * i + colW / 2;
    ctx.font = "700 26px sans-serif";
    ctx.fillStyle = COLORS.silver;
    ctx.fillText(value, cx, gridTop);
    ctx.font = "500 12px sans-serif";
    ctx.fillStyle = COLORS.dimSilver;
    ctx.fillText(label, cx, gridTop + 22);

    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(gridLeft + colW * i, gridTop - 28);
      ctx.lineTo(gridLeft + colW * i, gridTop + 12);
      ctx.strokeStyle = COLORS.divider;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  // Footer — review status + last updated
  const footerY = HEIGHT - pad - 34;
  ctx.beginPath();
  ctx.moveTo(pad + 40, footerY - 22);
  ctx.lineTo(WIDTH - pad - 40, footerY - 22);
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "600 12px sans-serif";
  ctx.fillStyle = data.reviewed ? COLORS.mutedSilver : COLORS.dimSilver;
  const statusText = data.reviewed ? "REVIEWED" : "UNREVIEWED";
  ctx.fillText(statusText, avatarCx, footerY);

  ctx.font = "400 11px sans-serif";
  ctx.fillStyle = COLORS.dimSilver;
  const updated = data.updatedAt ? data.updatedAt.toISOString().slice(0, 10) : "—";
  ctx.fillText(`Sheriff | OutLaws  ·  Updated ${updated}`, avatarCx, footerY + 18);

  return canvas.toBuffer("image/png");
}
