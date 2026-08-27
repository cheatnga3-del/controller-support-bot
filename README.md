# Controller Support — Discord Ticket Bot v6

## Install

1. **Install Node.js** (v18+): https://nodejs.org
2. Open terminal in this folder
3. Run:
   ```
   npm install
   ```
4. Edit `config.json` — fill in:
   - `token` → your bot token
   - `clientId` → your bot's application ID
   - `guildId` → your server ID
   - `ticketLogChannelId` → log channel ID (or leave blank, `/setup` creates one)
   - `supportRoleId` → your staff/support role ID
5. Deploy commands:
   ```
   node deploy.js
   ```
6. Start the bot:
   ```
   node index.js
   ```
7. In Discord, run `/setup` in any channel — this creates the ticket panel, category, and log channel.

## Commands

| Command | Permission | Description |
|---------|-----------|-------------|
| `/setup` | Manage Server | Creates the full ticket system (panel, category, log channel) |
| `/panel` | Manage Server | Resends the panel embed in the current channel |
| `/close` | Manage Server | Force-closes the current ticket |

## Features

- 5 ticket categories: Support, Buy, Resell, Partnership, Apply for Team
- Each category gets its own parent folder (e.g. Buy tickets go under a "Payments" category)
- Per-category ticket numbering (buy-0001, support-0001, etc.)
- **Persistent counters** — numbers never reset, they keep counting up forever even after tickets close
- **Persistent transcripts** — every close saves a transcript to the volume for proof
- Custom banner embed
- Ticket transcripts on close
- Staff claim system
- Audit logging
- No cooldown between ticket creation

## Persistent Storage (Railway Volume)

The bot saves ticket counters and transcripts to a persistent volume so they survive restarts AND redeploys.

**To enable on Railway:**
1. Go to your project → **Volumes** tab
2. Add a volume, mount path: `/data`
3. Deploy

That's it. Counters and transcripts now live in `/data` (counters.json + transcripts/ folder).

Without a volume, data only persists for local run (saved in a `./data` folder).

## Protections (Anti-Nuke)

- **1 ticket per user** — users can't spam ticket creation
- **Per-category numbering** — tickets counted within their own category
- **Safe delete** — bot only deletes channels inside ticket category folders with the `{category}-` prefix
- **Mass-delete detection** — if 5+ channels deleted in 30s, triggers server lockdown + alert
- **Mass role escalation alert** — detects rapid admin role grants
- **Channel count safeguard** — blocks creation if server hits 500 channels
- **Permission-gated buttons** — Close = owner or staff, Claim/Transcript = staff only
- **Audit log** — every open, close, claim, transcript, and protection trigger is logged
- **Startup recovery** — rebuilds ticket tracking from existing channels on restart
