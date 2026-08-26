# Controller Support — Discord Ticket Bot

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
- Custom banner embed
- Ticket transcripts on close
- Staff claim system
- Audit logging

## Protections (Anti-Nuke)

- **1 ticket per user** — users can't spam ticket creation
- **60s cooldown** between ticket creation attempts
- **Close cooldown** — prevents rapid close spam
- **Safe delete** — bot only deletes channels inside the "Tickets" category with `ticket-` prefix
- **Mass-delete detection** — if 5+ channels deleted in 30s, triggers server lockdown + alert
- **Mass role escalation alert** — detects rapid admin role grants
- **Channel count safeguard** — blocks creation if server hits 500 channels
- **Permission-gated buttons** — Close = owner or staff, Claim/Transcript = staff only
- **Audit log** — every open, close, claim, transcript, and protection trigger is logged
- **Startup recovery** — rebuilds ticket tracking from existing channels on restart
