// config loader — env vars for hosted, config.json for local
// works without config.json on hosted platforms

let fileConfig = {};
try {
    fileConfig = require('./config.json');
} catch (_) {}

const config = {
    token: process.env.BOT_TOKEN || fileConfig.token || '',
    clientId: process.env.CLIENT_ID || fileConfig.clientId || '',
    guildId: process.env.GUILD_ID || fileConfig.guildId || '',
    botName: process.env.BOT_NAME || fileConfig.botName || 'Controller Support',
    bannerPath: fileConfig.bannerPath || './assets/banner.png',

    // Verification settings
    verifiedRoleId: process.env.VERIFIED_ROLE_ID || fileConfig.verifiedRoleId || '',   // role given after verify
    memberRoleId: process.env.MEMBER_ROLE_ID || fileConfig.memberRoleId || '',         // optional base member role
    unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID || fileConfig.unverifiedRoleId || '', // role for new joins
    verifyChannelName: process.env.VERIFY_CHANNEL || fileConfig.verifyChannelName || 'verify',
    logChannelName: process.env.LOG_CHANNEL || fileConfig.logChannelName || 'verify-logs',

    // RestoreCord: auto-kick unverified after X seconds (0/empty = disabled)
    kickUnverified: process.env.KICK_UNVERIFIED === 'true' || fileConfig.kickUnverified || false,
    kickDelaySeconds: parseInt(process.env.KICK_DELAY || fileConfig.kickDelaySeconds || 600, 10),

    colors: {
        primary: 0x5865F2,
        success: 0x57F287,
        danger: 0xED4245,
        warning: 0xFEE75C
    }
};

module.exports = config;
