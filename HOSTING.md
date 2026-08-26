# Hosting Guide — Controller Support Bot

Your bot needs to run 24/7. Your PC shutting off = bot offline. Here's how to fix that.

---

## Option 1: Railway (Recommended — Free)

**$5 free credit/month, enough for a bot like this.**

1. Push your code to GitHub:
   ```
   cd controller-support-bot
   git init
   git add .
   git commit -m "controller support bot"
   ```
   Create a repo on github.com, then:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/controller-support-bot.git
   git push -u origin main
   ```

2. Go to https://railway.app → Sign in with GitHub

3. Click **New Project** → **Deploy from GitHub Repo** → select your repo

4. Go to **Variables** tab and add:
   ```
   BOT_TOKEN        = your bot token
   CLIENT_ID        = your bot application ID
   GUILD_ID         = your server ID
   LOG_CHANNEL_ID   = (leave empty if you want /setup to create one)
   SUPPORT_ROLE_ID  = your support role ID
   ```

5. Railway auto-detects the Dockerfile and deploys. Done.

---

## Option 2: Render (Free Tier)

**Free background worker, sleeps after 15min inactivity but auto-wakes.**

1. Push code to GitHub (same as above)

2. Go to https://render.com → Sign in with GitHub

3. **New** → **Background Worker** → Connect your repo

4. Settings:
   - Build Command: `npm install`
   - Start Command: `node index.js`

5. Go to **Environment** → add the same variables as Railway above

6. Deploy. It'll spin up and stay running.

**Note:** Free tier spins down after 15 min of no events. For a ticket bot that's usually fine — it wakes back up when someone opens a ticket.

---

## Option 3: A Cheap VPS ($3-5/month)

**Always on, no sleep, full control.**

Providers: Hetzner ($4/mo), DigitalOcean ($4/mo), Oracle Cloud (free tier)

1. SSH into your VPS:
   ```
   ssh root@YOUR_VPS_IP
   ```

2. Install Node.js:
   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs
   ```

3. Upload your bot files:
   ```
   # from your PC, in the bot folder:
   scp -r ./* root@YOUR_VPS_IP:/root/controller-support-bot/
   ```

4. On the VPS:
   ```
   cd /root/controller-support-bot
   npm install
   node index.js
   ```

5. To keep it running after disconnect, use pm2:
   ```
   npm install -g pm2
   pm2 start index.js --name controller-support
   pm2 save
   pm2 startup    # follow the command it gives you
   ```

6. Bot is now 24/7. `pm2 logs controller-support` to check.

---

## Option 4: Oracle Cloud Free Tier (Forever Free)

**Free ARM instance, always on, never expires.**

1. Sign up at https://cloud.oracle.com (free tier)
2. Create an ARM instance (Ubuntu 22.04, 4GB RAM)
3. SSH in, same VPS steps as above

---

## Which one should you pick?

| Option | Cost | Uptime | Difficulty |
|--------|------|--------|------------|
| Railway | Free ($5 credit) | 24/7 | Easy |
| Render | Free | 24/7 (with sleep) | Easy |
| VPS | $3-5/mo | 24/7 always | Medium |
| Oracle | Free forever | 24/7 always | Medium |

**My recommendation:** Railway if you want easy + free. VPS if you want full control.

---

## After hosting is live

The bot runs the same — `/setup` in Discord creates the panel, tickets work, protections work. The only difference is it's not tied to your PC anymore.
