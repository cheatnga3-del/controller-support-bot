// config loader — env vars take priority (for hosting), falls back to config.json (local)
const path = require('path');

const fileConfig = require('./config.json');

const config = {
    token: process.env.BOT_TOKEN || fileConfig.token,
    clientId: process.env.CLIENT_ID || fileConfig.clientId,
    guildId: process.env.GUILD_ID || fileConfig.guildId,
    ticketLogChannelId: process.env.LOG_CHANNEL_ID || fileConfig.ticketLogChannelId,
    ticketCategoryName: fileConfig.ticketCategoryName,
    supportRoleId: process.env.SUPPORT_ROLE_ID || fileConfig.supportRoleId,
    bannerPath: fileConfig.bannerPath,
    colors: fileConfig.colors,
    ticketCategories: fileConfig.ticketCategories
};

module.exports = config;
