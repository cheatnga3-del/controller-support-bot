const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════
// OPEN TICKET
// ════════════════════════════════════════════════════════
async function handleTicketOpen(interaction, client, config, protection) {
    const { userTicketCache, registerTicket, unregisterTicket, hasOpenTicket, auditLog } = protection;

    const categoryValue = interaction.values[0];
    const categoryConfig = config.ticketCategories.find(c => c.value === categoryValue);
    if (!categoryConfig) {
        return interaction.reply({ content: 'Invalid category.', ephemeral: true });
    }

    const guild = interaction.guild;
    const user = interaction.user;

    // ── Find or create per-category parent channel ──
    // e.g. category "buy" → a "Payments" category channel
    const categoryChannelName = categoryConfig.categoryName || categoryConfig.label; // e.g. "Payments" or "Support"

    let ticketCategory = guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === categoryChannelName.toLowerCase()
    );

    if (!ticketCategory) {
        ticketCategory = await guild.channels.create({
            name: categoryChannelName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ]
        });
    }

    // ── Per-category persistent ticket counter ──
    // Stored in a persistent file so numbers NEVER reset — they continue
    // across all closes, restarts, and redeploys (support → 0001, 0002, 0003...)
    const prefix = categoryConfig.value; // "buy", "support", etc.

    const storage = require('../storage.js');
    const ticketNumber = storage.nextTicketNumber(prefix);

    const channelName = `${prefix}-${String(ticketNumber).padStart(4, '0')}`;

    // ── Create the ticket channel ──
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        topic: `owner:${user.id}|category:${categoryValue}|status:open`,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            {
                id: client.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles
                ]
            }
        ]
    });

    // ── Add support role access ──
    if (config.supportRoleId) {
        await ticketChannel.permissionOverwrites.edit(config.supportRoleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            EmbedLinks: true,
            AttachFiles: true
        });
    }

    // ── Register ticket ──
    registerTicket(user.id, ticketChannel.id, categoryValue);

    // ── Build ticket embed ──
    const ticketEmbed = new EmbedBuilder()
        .setColor(categoryConfig.color)
        .setTitle(`${categoryConfig.emoji} ${categoryConfig.label} Ticket`)
        .setDescription(
            `Welcome ${user}, your ticket has been created.\n\n` +
            `**Category:** ${categoryConfig.emoji} ${categoryConfig.label}\n` +
            `**Ticket ID:** \`${channelName}\`\n\n` +
            `A staff member will be with you shortly.\n` +
            `Please describe your issue or inquiry in detail.`
        )
        .setFooter({ text: 'Controller Support • Tickets' })
        .setTimestamp();

    // ── Action buttons ──
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
        new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👋'),
        new ButtonBuilder()
            .setCustomId('transcript_ticket')
            .setLabel('Transcript')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝')
    );

    // ── Send the embed in the ticket channel ──
    await ticketChannel.send({
        content: `<@${user.id}> <@&${config.supportRoleId}>`,
        embeds: [ticketEmbed],
        components: [actionRow]
    });

    // ── Reply to the select menu ──
    await interaction.reply({
        content: `Ticket opened: <#${ticketChannel.id}>`,
        ephemeral: true
    });

    // ── Reset the panel dropdown so it can be re-picked immediately ──
    try {
        const freshMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_category_select')
                .setPlaceholder('Select a ticket category...')
                .addOptions(
                    config.ticketCategories.map(cat => ({
                        label: cat.label,
                        value: cat.value,
                        description: cat.description,
                        emoji: cat.emoji
                    }))
                )
        );
        await interaction.message.edit({ components: [freshMenu] });
    } catch (err) {
        console.log(`[Controller Support] Could not reset panel: ${err.message}`);
    }

    // ── Audit log ──
    await auditLog(guild, 'Ticket Opened',
        `**User:** ${user.tag} (${user.id})\n**Category:** ${categoryConfig.label}\n**Channel:** <#${ticketChannel.id}>`,
        config.colors.success
    );
}

// ════════════════════════════════════════════════════════
// CLOSE TICKET
// ════════════════════════════════════════════════════════
async function handleCloseTicket(interaction, client, config, protection) {
    const { userTicketCache, unregisterTicket, auditLog, safeDeleteChannel } = protection;

    await interaction.deferReply();

    const channel = interaction.channel;
    const user = interaction.user;
    const guild = interaction.guild;

    // ── Extract owner from topic ──
    const topicParts = channel.topic ? channel.topic.split('|') : [];
    const ownerPart = topicParts.find(p => p.startsWith('owner:'));
    const ownerId = ownerPart ? ownerPart.split(':')[1] : null;
    const categoryPart = topicParts.find(p => p.startsWith('category:'));
    const categoryValue = categoryPart ? categoryPart.split(':')[1] : 'unknown';
    const categoryConfig = config.ticketCategories.find(c => c.value === categoryValue);

    // ── Generate transcript ──
    const messages = [];
    let lastAuthor = '';
    let fetchDone = false;
    let lastId = undefined;

    while (!fetchDone) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) {
            fetchDone = true;
            break;
        }

        for (const [, msg] of fetched) {
            const timestamp = msg.createdAt.toISOString();
            if (msg.author.id === lastAuthor) {
                messages.push(`  [${timestamp}] ${msg.content || '[embed/attachment]'}`);
            } else {
                messages.push(`\n[${timestamp}] ${msg.author.tag} (${msg.author.id}):\n  ${msg.content || '[embed/attachment]'}`);
            }
            lastAuthor = msg.author.id;
        }

        lastId = fetched.last()?.id;
        if (fetched.size < 100) fetchDone = true;
    }

    messages.reverse(); // Chronological order
    const transcript = messages.join('\n') || 'No messages.';

    // ── Save transcript to PERSISTENT storage (survives close + redeploy) ──
    const storage = require('../storage.js');
    const persistedFile = storage.saveTranscript(categoryValue, channel.name, transcript);

    // Also keep a temp copy to attach to the log message
    let transcriptAttachment = null;
    const transcriptDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });
    const transcriptFile = path.join(transcriptDir, `${channel.name}.txt`);
    try {
        fs.writeFileSync(transcriptFile, transcript, 'utf-8');
        transcriptAttachment = new AttachmentBuilder(transcriptFile, { name: `${channel.name}-transcript.txt` });
    } catch (_) {}

    // ── Send transcript to log channel ──
    const logChannel = guild.channels.cache.get(config.ticketLogChannelId);
    if (logChannel) {
        const closeEmbed = new EmbedBuilder()
            .setColor(config.colors.danger)
            .setTitle(`🔒 Ticket Closed: ${channel.name}`)
            .setDescription(
                `**Closed by:** ${user.tag} (${user.id})\n` +
                `**Ticket owner:** <@${ownerId || 'unknown'}>\n` +
                `**Category:** ${categoryConfig ? categoryConfig.label : categoryValue}\n` +
                `**Channel:** #${channel.name}\n` +
                (persistedFile ? `**Transcript saved:** \`${persistedFile}\`` : '')
            )
            .setTimestamp();

        const logPayload = { embeds: [closeEmbed] };
        if (transcriptAttachment) logPayload.files = [transcriptAttachment];
        await logChannel.send(logPayload);
    }

    // ── Unregister ticket ──
    if (ownerId) {
        unregisterTicket(ownerId, channel.id);
    }

    // ── Audit log ──
    await auditLog(guild, 'Ticket Closed',
        `**By:** ${user.tag} | **Owner:** <@${ownerId || 'unknown'}> | **Category:** ${categoryConfig ? categoryConfig.label : categoryValue} | **Channel:** ${channel.name}`,
        config.colors.danger
    );

    // ── Final message before deletion ──
    const closingEmbed = new EmbedBuilder()
        .setColor(config.colors.danger)
        .setTitle('Ticket Closing...')
        .setDescription('This ticket will be deleted in 5 seconds.\nTranscript has been saved.')
        .setTimestamp();

    await interaction.editReply({ embeds: [closingEmbed] });

    // ── Delete transcript file after save ──
    setTimeout(async () => {
        try { fs.unlinkSync(transcriptFile); } catch (_) {}

        // ── Safe delete ──
        const deleted = await safeDeleteChannel(channel);
        if (!deleted) {
            console.log(`[Protection] Refused to delete channel: ${channel.name}`);
        }
    }, 5000);
}

// ════════════════════════════════════════════════════════
// CLAIM TICKET
// ════════════════════════════════════════════════════════
async function handleClaimTicket(interaction, client, config, protection) {
    const { auditLog } = protection;

    const channel = interaction.channel;
    const user = interaction.user;

    // ── Update topic to reflect claim ──
    let topic = channel.topic || '';
    if (topic.includes('claimed:')) {
        topic = topic.replace(/claimed:[^|]+/, `claimed:${user.id}`);
    } else {
        topic += `|claimed:${user.id}`;
    }
    topic = topic.replace('status:open', 'status:claimed');

    await channel.setTopic(topic, `Claimed by ${user.tag}`);

    // ── Update channel name to show claimed ──
    const originalName = channel.name.replace('-claimed', '');
    await channel.setName(`${originalName}-claimed`, `Claimed by ${user.tag}`);

    // ── Claim embed ──
    const claimEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('👋 Ticket Claimed')
        .setDescription(
            `This ticket has been claimed by **${user.tag}**.\n` +
            `They will be assisting you from here.`
        )
        .setTimestamp();

    await interaction.reply({ embeds: [claimEmbed] });

    // ── Audit ──
    await auditLog(interaction.guild, 'Ticket Claimed',
        `**By:** ${user.tag} | **Channel:** <#${channel.id}>`,
        config.colors.primary
    );
}

// ════════════════════════════════════════════════════════
// TRANSCRIPT
// ════════════════════════════════════════════════════════
async function handleTranscript(interaction, client, config, protection) {
    const { auditLog } = protection;

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;

    // ── Fetch all messages ──
    const messages = [];
    let lastAuthor = '';
    let fetchDone = false;
    let lastId = undefined;

    while (!fetchDone) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) {
            fetchDone = true;
            break;
        }

        for (const [, msg] of fetched) {
            const timestamp = msg.createdAt.toISOString();
            const content = msg.content || '[embed/attachment]';
            if (msg.author.id === lastAuthor) {
                messages.push(`  [${timestamp}] ${content}`);
            } else {
                messages.push(`\n[${timestamp}] ${msg.author.tag} (${msg.author.id}):\n  ${content}`);
            }
            lastAuthor = msg.author.id;
        }

        lastId = fetched.last()?.id;
        if (fetched.size < 100) fetchDone = true;
    }

    messages.reverse();
    const transcript = messages.join('\n') || 'No messages.';

    // ── Persist transcript (proof, survives redeploy) ──
    const storage = require('../storage.js');
    const catPart = (channel.topic || '').split('|').find(p => p.startsWith('category:'));
    const category = catPart ? catPart.split(':')[1] : channel.name.split('-')[0];
    storage.saveTranscript(category, channel.name, transcript);

    // ── Save temporarily for attachment ──
    const transcriptDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });

    const transcriptFile = path.join(transcriptDir, `${channel.name}-transcript.txt`);
    fs.writeFileSync(transcriptFile, transcript, 'utf-8');

    const attachment = new AttachmentBuilder(transcriptFile, { name: `${channel.name}-transcript.txt` });

    await interaction.editReply({
        content: 'Transcript generated:',
        files: [attachment]
    });

    // ── Cleanup temp file ──
    setTimeout(() => {
        try { fs.unlinkSync(transcriptFile); } catch (_) {}
    }, 10000);

    // ── Audit ──
    await auditLog(interaction.guild, 'Transcript Generated',
        `**By:** ${interaction.user.tag} | **Channel:** <#${channel.id}>`,
        config.colors.warning
    );
}

module.exports = {
    handleTicketOpen,
    handleCloseTicket,
    handleClaimTicket,
    handleTranscript
};
