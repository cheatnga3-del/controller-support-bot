const {
    Client,
    GatewayIntentBits,
    Collection,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    Partials
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');
const { handleTicketOpen, handleCloseTicket, handleClaimTicket, handleTranscript } = require('./handlers/ticketHandler');

// ── Anti-Abuse: In-memory tracking ──
const userTicketCache = new Map();   // userId -> { channelId, createdAt }
const rateLimitCache = new Map();     // userId -> lastAction timestamp
const cooldownCache = new Map();      // channelId -> lastClose timestamp

// ── Protection Constants ──
const MAX_TICKETS_PER_USER = 1;
const TICKET_COOLDOWN_MS = 60000;       // 1 min between ticket creation
const CLOSE_COOLDOWN_MS = 5000;         // 5 sec between close actions
const MAX_CHANNELS_PER_GUILD = 500;     // Discord limit safeguard
const BOT_PROTECTED_PERMISSIONS = [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.Administrator
];

// ── Client ──
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();

// ── Load commands ──
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', file));
    client.commands.set(command.data.name, command);
}

// ── Protection Helpers ──

function isRateLimited(userId) {
    const last = rateLimitCache.get(userId);
    if (!last) return false;
    return (Date.now() - last) < TICKET_COOLDOWN_MS;
}

function setRateLimit(userId) {
    rateLimitCache.set(userId, Date.now());
}

function hasOpenTicket(userId) {
    return userTicketCache.has(userId);
}

function registerTicket(userId, channelId) {
    userTicketCache.set(userId, { channelId, createdAt: Date.now() });
}

function unregisterTicket(userId) {
    userTicketCache.delete(userId);
}

function getOpenTicketCount() {
    return userTicketCache.size;
}

function isCloseCooldown(channelId) {
    const last = cooldownCache.get(channelId);
    if (!last) return false;
    return (Date.now() - last) < CLOSE_COOLDOWN_MS;
}

function setCloseCooldown(channelId) {
    cooldownCache.set(channelId, Date.now());
}

// ── Guild channel count check ──
function canCreateChannel(guild) {
    return guild.channels.cache.size < MAX_CHANNELS_PER_GUILD;
}

// ── Safe channel deletion — only deletes ticket channels, never guild essentials ──
async function safeDeleteChannel(channel) {
    // Guard: only delete channels under the "Tickets" category or with ticket naming
    if (!channel.parent || channel.parent.name !== config.ticketCategoryName) {
        console.log(`[Protection] Blocked deletion of non-ticket channel: ${channel.name}`);
        return false;
    }
    if (!channel.name.startsWith('ticket-')) {
        console.log(`[Protection] Blocked deletion of non-ticket channel: ${channel.name}`);
        return false;
    }
    try {
        await channel.delete('Ticket closed');
        return true;
    } catch (err) {
        console.error(`[Protection] Failed to delete channel ${channel.name}:`, err.message);
        return false;
    }
}

// ── Audit Log ──
async function auditLog(guild, action, detail, color = 0xED4245) {
    const logChannelId = config.ticketLogChannelId;
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`[AUDIT] ${action}`)
        .setDescription(detail)
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (_) {}
}

// ── Ready ──
client.once('ready', async () => {
    console.log(`[Controller Support] Logged in as ${client.user.tag}`);
    console.log(`[Controller Support] Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`[Controller Support] Protections active: rate-limit, one-ticket-per-user, safe-delete, audit-log`);

    client.user.setActivity('Support Tickets', { type: 3 });

    // Rebuild open ticket cache from existing channels on startup
    for (const guild of client.guilds.cache.values()) {
        for (const [, channel] of guild.channels.cache) {
            if (channel.type === ChannelType.GuildText && channel.name.startsWith('ticket-')) {
                // Extract userId from topic if present
                if (channel.topic && channel.topic.startsWith('owner:')) {
                    const ownerId = channel.topic.split(':')[1];
                    if (ownerId && !userTicketCache.has(ownerId)) {
                        registerTicket(ownerId, channel.id);
                        console.log(`[Controller Support] Recovered open ticket: ${channel.name} (owner: ${ownerId})`);
                    }
                }
            }
        }
    }
});

// ── Interaction Router ──
client.on('interactionCreate', async (interaction) => {

    // ══════════════════════════════════════════
    // SLASH COMMANDS
    // ══════════════════════════════════════════
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // /setup and /panel require MANAGE_GUILD
        if (['controller', 'controller-panel'].includes(interaction.commandName)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: 'You need **Manage Server** permission to use this.',
                    ephemeral: true
                });
            }
        }

        try {
            await command.execute(interaction, client, config, {
                userTicketCache,
                registerTicket,
                unregisterTicket,
                hasOpenTicket,
                auditLog,
                safeDeleteChannel
            });
        } catch (err) {
            console.error(`[Controller Support] Command error (${interaction.commandName}):`, err);
            const reply = { content: 'Something broke. Ping a dev.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    // ══════════════════════════════════════════
    // BUTTONS (Close / Claim / Transcript)
    // ══════════════════════════════════════════
    if (interaction.isButton()) {
        const [action] = interaction.customId.split('_');

        // ── Close Button ──
        if (action === 'close') {
            // Protection: only ticket owner or staff can close
            const isOwner = interaction.channel.topic?.startsWith(`owner:${interaction.user.id}`);
            const isStaff = interaction.member.roles.cache.has(config.supportRoleId) ||
                            interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

            if (!isOwner && !isStaff) {
                return interaction.reply({
                    content: 'Only the ticket owner or staff can close this ticket.',
                    ephemeral: true
                });
            }

            // Protection: close cooldown
            if (isCloseCooldown(interaction.channel.id)) {
                return interaction.reply({
                    content: 'Slow down. Wait a few seconds between actions.',
                    ephemeral: true
                });
            }
            setCloseCooldown(interaction.channel.id);

            await handleCloseTicket(interaction, client, config, {
                userTicketCache,
                unregisterTicket,
                auditLog,
                safeDeleteChannel
            });
        }

        // ── Claim Button ──
        if (action === 'claim') {
            if (!interaction.member.roles.cache.has(config.supportRoleId) &&
                !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: 'Only staff can claim tickets.',
                    ephemeral: true
                });
            }

            await handleClaimTicket(interaction, client, config, {
                auditLog
            });
        }

        // ── Transcript Button ──
        if (action === 'transcript') {
            if (!interaction.member.roles.cache.has(config.supportRoleId) &&
                !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: 'Only staff can generate transcripts.',
                    ephemeral: true
                });
            }

            await handleTranscript(interaction, client, config, {
                auditLog
            });
        }
    }

    // ══════════════════════════════════════════
    // SELECT MENU (Ticket Category)
    // ══════════════════════════════════════════
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_category_select') {

            // ── Protection: Rate Limit ──
            if (isRateLimited(interaction.user.id)) {
                return interaction.reply({
                    content: `You're creating tickets too fast. Wait ${Math.ceil(TICKET_COOLDOWN_MS / 1000)}s.`,
                    ephemeral: true
                });
            }

            // ── Protection: One open ticket per user ──
            if (hasOpenTicket(interaction.user.id)) {
                return interaction.reply({
                    content: 'You already have an open ticket. Close it first before opening a new one.',
                    ephemeral: true
                });
            }

            // ── Protection: Guild channel limit ──
            if (!canCreateChannel(interaction.guild)) {
                await auditLog(interaction.guild, 'PROTECTION TRIGGERED',
                    `Guild at ${interaction.guild.channels.cache.size} channels. Ticket creation blocked.`, 0xED4245);
                return interaction.reply({
                    content: 'Server channel limit reached. Contact staff.',
                    ephemeral: true
                });
            }

            // ── Set rate limit ──
            setRateLimit(interaction.user.id);

            await handleTicketOpen(interaction, client, config, {
                userTicketCache,
                registerTicket,
                unregisterTicket,
                hasOpenTicket,
                auditLog,
                safeDeleteChannel
            });
        }
    }
});

// ── Anti-Abuse: Watch for mass channel deletes ──
let deleteCount = 0;
let deleteWindowStart = Date.now();

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const now = Date.now();

    // Reset window every 30 seconds
    if (now - deleteWindowStart > 30000) {
        deleteCount = 0;
        deleteWindowStart = now;
    }

    deleteCount++;

    // If 5+ channels deleted in 30 seconds, alert + lock
    if (deleteCount >= 5) {
        await auditLog(channel.guild, '🚨 MASS DELETE DETECTED',
            `${deleteCount} channels deleted in 30 seconds. Possible nuke attempt.\nCheck server immediately.`, 0xED4245);

        // Try to lock down general chat
        for (const [, ch] of channel.guild.channels.cache) {
            if (ch.name === 'general' || ch.name === 'chat') {
                try {
                    await ch.permissionOverwrites.edit(channel.guild.roles.everyone, {
                        SendMessages: false
                    }, 'Anti-nuke lockdown');
                } catch (_) {}
            }
        }

        deleteCount = 0;
    }
});

// ── Anti-Abuse: Watch for mass role changes ──
let roleChangeCount = 0;
let roleWindowStart = Date.now();

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.guild) return;
    const now = Date.now();

    if (now - roleWindowStart > 30000) {
        roleChangeCount = 0;
        roleWindowStart = now;
    }

    const oldRoles = oldMember.roles.cache.map(r => r.id);
    const newRoles = newMember.roles.cache.map(r => r.id);
    const added = newRoles.filter(r => !oldRoles.includes(r));
    const removed = newRoles.filter(r => !oldRoles.includes(r));

    // Only count if a high-level role was added
    if (added.length > 0) {
        const hasAdmin = newMember.permissions.has(PermissionFlagsBits.Administrator);
        if (hasAdmin) {
            roleChangeCount++;
            if (roleChangeCount >= 3) {
                await auditLog(oldMember.guild, '🚨 MASS ROLE ESCALATION',
                    `Multiple users received admin roles in 30 seconds. Possible nuke.`, 0xED4245);
                roleChangeCount = 0;
            }
        }
    }
});

// ── Anti-Abuse: Guard bot role from being moved/deleted ──
client.on('roleDelete', async (role) => {
    if (!role.guild) return;
    if (role.managed) {
        await auditLog(role.guild, '⚠️ Managed Role Deleted',
            `Role "${role.name}" (ID: ${role.id}) was deleted. If this was the bot's role, re-add it.`, 0xFEE75C);
    }
});

// ── Global error handler ──
process.on('unhandledRejection', (err) => {
    console.error('[Controller Support] Unhandled rejection:', err);
});

client.login(config.token);
