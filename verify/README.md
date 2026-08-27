# Controller Verify — Discord Verification Bot (RestoreCord style)

A verification bot using the same name (Controller Support) and banner as the ticket bot. New members must click a Verify button to receive access roles. Compatible with a RestoreCord workflow (gates new joins behind verification).

## Setup

1. Install Node.js v18+
2. `cd verify` then `npm install`
3. Edit `verify/config.json` — fill in:
   - `token` → bot token
   - `clientId` → application ID
   - `guildId` → server ID
   - `verifiedRoleId` → role given after verify
   - `unverifiedRoleId` → (optional) role applied to new joins
   - `memberRoleId` → (optional) base member role
4. Register + run:
   ```
   node index.js
   ```
5. The bot auto-posts the verify panel into a `#verify` channel and registers its commands.
6. Or run `/controller-verify-setup` in any channel to place the panel.

## Commands

- `/controller-verify-setup` — post verify panel in current channel
- `/controller-verify-panel` — re-post the panel
- `/controller-verify-user` — manually verify a user

## RestoreCord-style auto-kick

Enable in config (`config.json` under `kickUnverified` and `kickDelaySeconds`) or via env vars:
```
KICK_UNVERIFIED=true
KICK_DELAY=600
```
New members who don't verify within the delay get kicked and logged.

## Required Discord intents

- **Server Members Intent** must be enabled in the Developer Portal (needed to detect joins).
- **Message Content Intent**.

## Invite

Use a link with `bot` + `applications.commands` scopes and Manage Roles permission:
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=8
```

## Hosting

Same as the main bot — push to GitHub, deploy on Railway/Render (Dockerfile included). Add env vars instead of config.json when hosted.
