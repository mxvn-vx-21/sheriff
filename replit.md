# Smash Knights

A comprehensive Discord bot for the SmashKarts gaming community with 25+ command modules covering gameplay encyclopedias, tournament systems, economy, moderation, verification, and community tools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Discord bot (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `BOT_TOKEN` — Discord bot token (bot won't start without it)
- Optional env: `YOUTUBE_API_KEY` — enables YouTube auto-posting to media channels

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Bot: Discord.js v14
- DB: PostgreSQL + Drizzle ORM
- Cron: node-cron (YouTube checks, giveaway expiry)
- AI: OpenAI (optional, for tips)
- Build: esbuild (CJS bundle)

## Where things live

```
artifacts/api-server/src/
  bot/
    commands/         # All slash command modules (25+ commands)
    events/           # Discord event handlers
    handlers/         # Utility handlers (giveaway, etc.)
    utils/            # Shared utilities (embeds, permissions, XP, brackets, etc.)
    index.ts          # Bot client + command registry + startBot()
    types.ts          # BotCommand interface, ADMIN_GUILD_ID
  index.ts            # Express server entry point + bot startup

lib/db/src/schema/    # All database table schemas (17 files)
```

## Bot Commands (25+)

| Module | Commands |
|--------|----------|
| SmashKarts Dex | `/dex add/edit/delete/search/random/list` |
| Parkour DB | `/parkour add/edit/delete/view/search` |
| Media Library | `/media add/remove/search/random/latest/channel` |
| Quiz | `/quiz create/edit/delete/start/leaderboard` |
| XP System | `/xp show/leaderboard` |
| Economy | `/economy balance/daily/shop/buy/inventory/additem` |
| Tournament | `/tournament create/open/close/delete/list/view/start/result` |
| Verification | `/link`, `/unlink`, `/linkedaccount` |
| Profile | `/profile view/edit` |
| Tips | `/tips` |
| Daily Challenges | `/daily challenge/create`, `/challenge` |
| Achievements | `/achievements view/list/grant/seed` |
| Giveaways | `/giveaway create/end/reroll` |
| Events | `/event create/list/view/join/end/cancel` |
| Polls | `/poll create/close/results` |
| Suggestions | `/suggest`, `/suggestions list/approve/deny/implement` |
| Tickets | `/ticket panel/close/claim/add` |
| Welcome/Goodbye | `/welcome setup/disable`, `/goodbye setup/disable` |
| Articles | `/article add/view/search` |
| Instructions | `/instruction add/edit/delete/view/search` |
| Server Stats | `/stats bot/server` |
| Announcements | `/announce send/news` |
| Admin | `/admin verifyaccount/unlinkaccount/givexp/givecoins/config/setlogchannel/automod` |
| Moderation | `/mod ban/kick/timeout/warn/warnings/clearwarnings/purge/unban` |
| Reaction Roles | `/reactionrole create/list/delete` |

## Architecture decisions

- Bot lives inside the `api-server` artifact alongside the Express API — single process, no extra deployment needed
- Bot gracefully starts only if `BOT_TOKEN` env is set; logs a warning and continues API serving if not set
- All commands use Discord.js v14 slash commands registered globally via REST on bot startup
- XP is awarded on messages (1 per minute per user) and on quiz/challenge/event completion
- Bracket generation supports single elimination and round robin; teams get Discord roles auto-created
- Automod (anti-spam, anti-link) works via `messageCreate` event checking server config per guild
- YouTube auto-posting uses a 15-minute cron job checking the YouTube Data API v3
- Giveaway expiry is checked every minute via cron, ended giveaways are settled with random winner selection
- ADMIN_GUILD_ID = `1514915686273646612` — owner-only operations are gated to this guild

## Product

Smash Knights is a full-featured Discord bot serving the SmashKarts gaming community with:
- **Knowledge base**: Dex entries for weapons, maps, techniques, parkour routes, articles, video instructions
- **Competitive**: Full tournament system with brackets (solo/duo/team), match reporting, placement tracking
- **Social**: XP leveling, economy with shop, achievements, badges, giveaways, events, polls, suggestions
- **Verification**: Multi-step SmashKarts account linking (OTP + screenshot verification)
- **Community tools**: Tickets, welcome/goodbye messages, logging, automod, reaction roles, announcements
- **Media**: YouTube auto-posting to configured channels, media library

## User preferences

- ADMIN_GUILD_ID: 1514915686273646612

## Gotchas

- After adding new DB schema files, always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck`
- Run `pnpm --filter @workspace/db run push` after any schema change to apply to the database
- discord.js optional native deps (`bufferutil`, `utf-8-validate`, `zlib-sync`) are externalized in `build.mjs`
- The bot uses `GatewayIntentBits.MessageContent` — make sure this privileged intent is enabled in the Discord Developer Portal

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Discord Developer Portal: https://discord.com/developers/applications
- DB schema files: `lib/db/src/schema/`
- Command registry: `artifacts/api-server/src/bot/index.ts`
