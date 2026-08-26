// config loader — env vars for hosted, config.json for local
// works without config.json on hosted platforms

let fileConfig = {};
try {
    fileConfig = require('./config.json');
} catch (_) {
    // config.json doesn't exist — running on hosted platform, env vars only
}

const config = {
    token: process.env.BOT_TOKEN || fileConfig.token || '',
    clientId: process.env.CLIENT_ID || fileConfig.clientId || '',
    guildId: process.env.GUILD_ID || fileConfig.guildId || '',
    ticketLogChannelId: process.env.LOG_CHANNEL_ID || fileConfig.ticketLogChannelId || '',
    ticketCategoryName: fileConfig.ticketCategoryName || 'Tickets',
    supportRoleId: process.env.SUPPORT_ROLE_ID || fileConfig.supportRoleId || '',
    bannerPath: fileConfig.bannerPath || './assets/banner.png',
    colors: fileConfig.colors || {
        primary: 0x5865F2,
        success: 0x57F287,
        danger: 0xED4245,
        warning: 0xFEE75C
    },
    ticketCategories: fileConfig.ticketCategories || [
        { label: 'Support', value: 'support', description: 'Get help with an issue', emoji: '🛠️', color: 0x5865F2 },
        { label: 'Buy', value: 'buy', description: 'Purchase a product or service', emoji: '💰', color: 0x57F287 },
        { label: 'Resell', value: 'resell', description: 'Reseller inquiries', emoji: '🔄', color: 0xFEE75C },
        { label: 'Partnership', value: 'partnership', description: 'Collaborate with us', emoji: '🤝', color: 0xEB459E },
        { label: 'Apply for Team', value: 'apply', description: 'Join our team', emoji: '📋', color: 0xED4245 }
    ]
};

module.exports = config;
