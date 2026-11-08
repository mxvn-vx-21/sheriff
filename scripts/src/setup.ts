/**
 * One-time setup script:
 *  1. Sends the Smash Knights announcement to channel 1509371663840575608
 *  2. Gives the "Trainee" role to all members who don't already have it
 *
 * Run with: BOT_TOKEN=<token> pnpm --filter @workspace/scripts run setup
 */

const TOKEN = process.env["BOT_TOKEN"];
if (!TOKEN) { console.error("BOT_TOKEN env var not set"); process.exit(1); }

const BASE = "https://discord.com/api/v10";
const ANNOUNCEMENT_CHANNEL_ID = "1509371663840575608";
const TRAINEE_ROLE_NAME = "Trainee";

const headers = {
  Authorization: `Bot ${TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "SmashKnightsBot/1.0",
};

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Announcement Embeds ────────────────────────────────────────────────────

const embeds = [
  {
    color: 0xFF4444,
    title: "⚔️ Introducing Smash Knights — The Official SmashKarts Community Bot!",
    description: [
      "**@everyone** — The wait is over. Say hello to **Smash Knights**, the fully-featured Discord bot built exclusively for the SmashKarts gaming community!",
      "",
      "Smash Knights is your all-in-one companion for everything SmashKarts. Whether you're a newcomer learning the ropes or a seasoned veteran chasing the leaderboard, this bot has been designed with you in mind. Packed with **25+ modules and 30+ slash commands**, it brings the game's energy directly into Discord.",
      "",
      "From our comprehensive game encyclopedia and parkour database, to full tournament brackets, XP leveling, an in-server economy, verification, giveaways, events, and much more — **Smash Knights has it all covered**.",
      "",
      "This bot was lovingly built by **Moon** (Discord: `_mxvn_`) — a dedicated member of the SmashKarts community who wanted to create something truly special for all of you. Every feature has been thought through carefully to enhance your experience in this server and make the SmashKarts community even more vibrant.",
      "",
      "Read below to discover everything Smash Knights can do for you. All commands use Discord's native **slash command** system — just type `/` and explore!",
    ].join("\n"),
    thumbnail: { url: "https://cdn.discordapp.com/emojis/1234567890.png" },
    footer: { text: "Made with ❤️ by Moon (_mxvn_) • Smash Knights v1.0" },
    timestamp: new Date().toISOString(),
  },
  {
    color: 0x5865F2,
    title: "📚 Knowledge Base & Encyclopedia",
    description: "The foundation of Smash Knights is its powerful knowledge base — a community-driven encyclopedia covering every aspect of SmashKarts.",
    fields: [
      {
        name: "⚔️ `/dex` — SmashKarts Dex",
        value: "The Dex is your in-depth encyclopedia for everything SmashKarts. Add, edit, and search entries covering **weapons**, **maps**, **game mechanics**, **techniques**, and any other game element you want documented. Use `/dex add` to contribute, `/dex search` to find entries by keyword, and `/dex random` to discover something new. Admins can edit or delete entries at any time. This is the definitive knowledge hub for the community.",
      },
      {
        name: "🏃 `/parkour` — Parkour Route Database",
        value: "SmashKarts is famous for its creative parkour routes. The Parkour Database lets community members document every known route with descriptions, difficulty ratings, and tips. Use `/parkour add` to submit a new route, `/parkour search` to find routes by map or keyword, and `/parkour view` to see a full route breakdown. A great resource for players looking to master movement.",
      },
      {
        name: "📰 `/article` — Community Articles",
        value: "Long-form community articles live here. Guides, strategy write-ups, game updates, lore pieces — anything worth reading. Admins can publish articles with `/article add`, and anyone can read them with `/article view` or `/article search`.",
      },
      {
        name: "🎥 `/instruction` — Video Instructions",
        value: "Sometimes written guides aren't enough. The Instruction system lets admins attach video links to step-by-step guides. Perfect for technique tutorials and visual walkthroughs. Find instructions with `/instruction search` or browse them by category.",
      },
    ],
    footer: { text: "📚 Knowledge Base • Smash Knights" },
  },
  {
    color: 0xFFD700,
    title: "🏆 Competitive Features — Tournaments & Verification",
    description: "Smash Knights brings professional-grade competitive infrastructure right into Discord.",
    fields: [
      {
        name: "🏅 `/tournament` — Full Tournament System",
        value: "Run complete SmashKarts tournaments without leaving Discord. Create **Solo**, **Duo**, or **Team** tournaments with `/tournament create`, then open registration with `/tournament open`. The bot automatically generates **bracket structures** — choose between **Single Elimination** (fast, intense) or **Round Robin** (everyone plays everyone). Once brackets are generated, report match results with `/tournament result`, track progress with `/tournament view`, and close everything out when a winner is crowned. Teams even get their own Discord roles automatically created!",
      },
      {
        name: "🔗 `/link` — SmashKarts Account Verification",
        value: "Prove you're a real SmashKarts player with our **multi-step verification system**. Use `/link` to start the process — you'll receive a DM with step-by-step instructions. You'll need to submit profile screenshots and temporarily change your in-game name to a unique OTP code to prove ownership. Once admins review and approve your submission, your Discord account is permanently linked to your SmashKarts identity. Use `/linkedaccount` to check your linked account, and `/unlink` to remove it.",
      },
      {
        name: "👤 `/profile` — Player Profiles",
        value: "Every verified player gets a rich profile page. View yours or anyone else's with `/profile view`. Profiles display your SmashKarts username, XP level, coins, achievements, badges, and tournament history. Customize your profile with `/profile edit` to add a bio, set a banner color, or update your social links.",
      },
    ],
    footer: { text: "🏆 Competitive • Smash Knights" },
  },
  {
    color: 0x57F287,
    title: "💰 Economy, XP & Social Systems",
    description: "Engage with the community and earn rewards through our deep progression systems.",
    fields: [
      {
        name: "⭐ XP & Leveling — Automatic",
        value: "Just by chatting in the server you earn **XP** (5–15 XP per message, once per minute). As you level up, you automatically receive rank roles: **Trainee** (Level 0–5) → **Knight** (Level 5) → **Warlord** (Level 15) → **Elite** (Level 25). Check your progress with `/xp show` and see the leaderboard with `/xp leaderboard`.",
      },
      {
        name: "💰 `/economy` — Coins & Shop",
        value: "Earn **coins** through daily rewards, quiz wins, event participation, and more. Check your balance with `/economy balance`, claim your daily with `/economy daily`, browse the item shop with `/economy shop`, and buy items with `/economy buy`. Admins can add custom shop items with `/economy additem`. View your collected items with `/economy inventory`.",
      },
      {
        name: "🎯 `/quiz` — Community Quizzes",
        value: "Test your SmashKarts knowledge! Admins create quiz sessions with custom questions using `/quiz create`, then launch them live with `/quiz start`. Players compete in real-time — first to answer correctly wins XP and coins. Check who's the ultimate SmashKarts trivia master on the `/quiz leaderboard`.",
      },
      {
        name: "📅 `/daily` — Daily Challenges",
        value: "New challenges every day! Complete them to earn bonus XP and coins. Use `/daily challenge` to see today's active challenge, and `/challenge` to submit your completion. Admins create challenges with `/daily create`.",
      },
      {
        name: "🏆 `/achievements` — Achievement System",
        value: "Unlock achievements for your milestones in the community. Browse all available achievements with `/achievements list`, view your unlocked ones with `/achievements view`, and admins can grant achievements manually with `/achievements grant`.",
      },
      {
        name: "💡 `/tips` — AI-Powered Gameplay Tips",
        value: "Get intelligent SmashKarts gameplay tips powered by AI. Use `/tips` for a random tip from the Dex, or get AI-generated strategic advice to improve your game. A 5-second cooldown applies to keep things fair.",
      },
    ],
    footer: { text: "💰 Economy & Social • Smash Knights" },
  },
  {
    color: 0xEB459E,
    title: "🎉 Community Events & Engagement",
    description: "Keep the community active and engaged with events, giveaways, polls, and more.",
    fields: [
      {
        name: "🎊 `/giveaway` — Giveaways",
        value: "Run exciting giveaways! Admins create timed giveaways with `/giveaway create`, specifying the prize, duration, and winner count. Members enter by clicking the reaction button. When time's up, the bot automatically picks random winners and announces them. Use `/giveaway end` to end early or `/giveaway reroll` if a winner can't claim their prize.",
      },
      {
        name: "📅 `/event` — Community Events",
        value: "Organize server events with full registration management. Create events with start times, descriptions, and optional XP rewards with `/event create`. Post events in dedicated channels with a join button — when the event ends via `/event end`, all participants automatically receive their XP reward. Use `/event list` to see what's coming up and `/event view` for details.",
      },
      {
        name: "📊 `/poll` — Community Polls",
        value: "Let the community have their say. Create multi-option polls with `/poll create` — members vote by clicking buttons. Close voting with `/poll close` and see a full breakdown with `/poll results`. Great for community decisions and game-related surveys.",
      },
      {
        name: "💡 `/suggest` — Suggestions System",
        value: "Players submit ideas with `/suggest`. Admins review the suggestion queue with `/suggestions list`, and can approve, deny, or mark suggestions as implemented. Approved suggestions are highlighted to show the community their voices matter.",
      },
      {
        name: "📢 `/media` — Media Library",
        value: "A curated library of SmashKarts videos. Add clips and highlights with `/media add`, search by game or creator with `/media search`, get a random clip with `/media random`, and see the latest submissions with `/media latest`. Admins can also configure a dedicated channel for YouTube auto-posting with `/media channel` — whenever a new video is uploaded to a configured YouTube channel, Smash Knights posts it automatically!",
      },
    ],
    footer: { text: "🎉 Events & Engagement • Smash Knights" },
  },
  {
    color: 0xFEE75C,
    title: "🛡️ Moderation, Admin & Server Tools",
    description: "Powerful tools to keep the server safe, organized, and running smoothly.",
    fields: [
      {
        name: "⚙️ `/mod` — Moderation Commands",
        value: "Full moderation suite: `/mod ban` (ban a member), `/mod kick` (kick a member), `/mod timeout` (temporarily mute), `/mod warn` (issue a warning), `/mod warnings` (view warning history), `/mod clearwarnings` (wipe warnings), `/mod purge` (bulk delete messages), `/mod unban` (unban). All actions are logged automatically.",
      },
      {
        name: "🎫 `/ticket` — Support Tickets",
        value: "Set up a professional ticket system with `/ticket panel` — this posts a panel with a button that opens private ticket channels. Staff can claim tickets with `/ticket claim`, add members with `/ticket add`, and close them with `/ticket close`. Perfect for support requests and reports.",
      },
      {
        name: "👋 `/welcome` & `/goodbye` — Auto Messages",
        value: "Greet new members automatically with `/welcome setup` and say farewell with `/goodbye setup`. Customize the message and channel. Disable either with `/welcome disable` or `/goodbye disable`.",
      },
      {
        name: "🎭 `/reactionrole` — Self-Assignable Roles",
        value: "Let members pick their own roles. Create a message with role buttons using `/reactionrole create`, list all panels with `/reactionrole list`, and remove them with `/reactionrole delete`. Great for game-mode preferences, platform roles, and ping opt-ins.",
      },
      {
        name: "📣 `/announce` — Announcements",
        value: "Send formatted announcements to any channel with `/announce send`. Use `/announce news` for a special news-style embed. Supports @everyone and @here pings.",
      },
      {
        name: "📈 `/stats` — Server & Bot Statistics",
        value: "Get a full overview with `/stats server` (member count, channel breakdown, boost level, top roles) and `/stats bot` (uptime, command count, database stats, latency).",
      },
      {
        name: "🔧 `/admin` — Admin Controls",
        value: "Admin-only tools: `/admin verifyaccount` (approve/deny verifications), `/admin unlinkaccount` (force unlink), `/admin givexp` (give XP to any member), `/admin givecoins` (give coins), `/admin config` (server settings), `/admin setlogchannel` (set where logs are posted), `/admin automod` (toggle anti-spam and anti-link).",
      },
    ],
    footer: { text: "🛡️ Moderation & Admin • Smash Knights" },
  },
  {
    color: 0xFF4444,
    title: "🌟 Getting Started & Final Notes",
    description: [
      "**Welcome to the Smash Knights family!** Here's how to get the most out of the bot:\n",
      "**1.** Use `/link` to verify your SmashKarts account and unlock your full player profile.",
      "**2.** Chat in the server to earn XP and coins — level up to claim rank roles!",
      "**3.** Check `/daily challenge` every day for bonus rewards.",
      "**4.** Keep an eye on `/event list` and `/giveaway` announcements for free rewards.",
      "**5.** Got ideas? Use `/suggest` — we read every single one.\n",
      "All commands support Discord's autocomplete — start typing and let the bot guide you.",
      "If you find a bug or have a feature request, reach out to **Moon** (`_mxvn_`) directly.\n",
      "**Smash Knights is continuously growing.** Expect updates, new commands, and improvements as the community grows. Thank you for being part of this — now go out there and **SMASH**! ⚔️",
    ].join("\n"),
    fields: [
      { name: "👨‍💻 Developer", value: "**Moon** (`_mxvn_`)", inline: true },
      { name: "🤖 Bot Version", value: "v1.0.0", inline: true },
      { name: "📦 Commands", value: "30 Slash Commands", inline: true },
    ],
    footer: { text: "Smash Knights • Built for the SmashKarts Community ⚔️" },
    timestamp: new Date().toISOString(),
  },
];

// ─── Send Announcement ──────────────────────────────────────────────────────

async function sendAnnouncement() {
  console.log("📢 Sending announcement...");
  await api("POST", `/channels/${ANNOUNCEMENT_CHANNEL_ID}/messages`, {
    content: "@everyone\n⚔️ **BIG ANNOUNCEMENT** — Read below! ⬇️",
    allowed_mentions: { parse: ["everyone"] },
    embeds: embeds.slice(0, 3),
  });
  await sleep(2000);
  await api("POST", `/channels/${ANNOUNCEMENT_CHANNEL_ID}/messages`, {
    embeds: embeds.slice(3, 6),
    allowed_mentions: { parse: [] },
  });
  await sleep(2000);
  await api("POST", `/channels/${ANNOUNCEMENT_CHANNEL_ID}/messages`, {
    embeds: [embeds[6]!],
    allowed_mentions: { parse: [] },
  });
  console.log("✅ Announcement sent!");
}

// ─── Give Trainee Role to All Members ──────────────────────────────────────

async function giveTraineeRole() {
  // Get guild ID from channel
  const channel = await api("GET", `/channels/${ANNOUNCEMENT_CHANNEL_ID}`) as { guild_id: string };
  const guildId = channel.guild_id;
  console.log(`🏰 Guild ID: ${guildId}`);

  // Get all roles
  const roles = await api("GET", `/guilds/${guildId}/roles`) as Array<{ id: string; name: string }>;
  const traineeRole = roles.find(r => r.name === TRAINEE_ROLE_NAME);
  if (!traineeRole) { console.error(`❌ Could not find role named "${TRAINEE_ROLE_NAME}"`); return; }
  console.log(`🎭 Trainee role ID: ${traineeRole.id}`);

  // Fetch all members in batches of 1000
  let after = "0";
  let totalProcessed = 0;
  let totalGiven = 0;

  while (true) {
    const members = await api("GET", `/guilds/${guildId}/members?limit=1000&after=${after}`) as Array<{ user: { id: string; username: string }; roles: string[] }>;
    if (!members.length) break;

    for (const member of members) {
      if (!member.roles.includes(traineeRole.id)) {
        try {
          await api("PUT", `/guilds/${guildId}/members/${member.user.id}/roles/${traineeRole.id}`);
          totalGiven++;
          console.log(`  ✅ Gave Trainee to ${member.user.username}`);
          await sleep(600); // Stay under rate limit (~10 req/5s)
        } catch (err) {
          console.warn(`  ⚠️ Failed for ${member.user.username}: ${err}`);
        }
      } else {
        console.log(`  ⏭️ ${member.user.username} already has Trainee`);
      }
      totalProcessed++;
    }

    after = members[members.length - 1]!.user.id;
    if (members.length < 1000) break;
    await sleep(1000);
  }

  console.log(`\n✅ Done! Processed ${totalProcessed} members, gave Trainee role to ${totalGiven} members.`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  try {
    await sendAnnouncement();
    await sleep(2000);
    await giveTraineeRole();
    console.log("\n🎉 Setup complete!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
