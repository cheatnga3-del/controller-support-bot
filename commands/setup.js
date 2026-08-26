const {
    SlashCommandBuilder,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    CategoryChannel
} = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller')
        .setDescription('Set up the Controller Support ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config, protectionCtx) {
        // ── Defer (can take a moment) ──
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;

        // ══════════════════════════════════════
        // 1. Create/find "Tickets" category
        // ══════════════════════════════════════
        let ticketCategory = guild.channels.cache.find(
            ch => ch.type === ChannelType.GuildCategory && ch.name === 'Tickets'
        );

        if (!ticketCategory) {
            ticketCategory = await guild.channels.create({
                name: 'Tickets',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
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

        // ══════════════════════════════════════
        // 2. Create/find #ticket-panel channel
        // ══════════════════════════════════════
        let panelChannel = guild.channels.cache.find(ch => ch.name === 'ticket-panel');

        if (!panelChannel) {
            panelChannel = await guild.channels.create({
                name: 'ticket-panel',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.SendMessages],
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });
        }

        // ══════════════════════════════════════
        // 3. Build and send the panel embed
        // ══════════════════════════════════════
        let bannerAttachment = null;
        const bannerPath = path.resolve(__dirname, '..', config.bannerPath);
        if (fs.existsSync(bannerPath)) {
            bannerAttachment = new AttachmentBuilder(bannerPath, { name: 'banner.png' });
        }

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('🎮 Controller Support')
            .setDescription(
                '**Need help?** Open a ticket and our team will assist you.\n\n' +
                '**Available Categories:**\n' +
                '🛠️ **Support** — Get help with an issue\n' +
                '💰 **Buy** — Purchase a product or service\n' +
                '🔄 **Resell** — Reseller inquiries\n' +
                '🤝 **Partnership** — Collaborate with us\n' +
                '📋 **Apply for Team** — Join our team\n\n' +
                '*Select a category below to open a ticket.*'
            )
            .setFooter({ text: 'Controller Support • Tickets' })
            .setTimestamp();

        if (bannerAttachment) {
            embed.setImage('attachment://banner.png');
        }

        const selectMenu = new ActionRowBuilder().addComponents(
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

        // Clear old messages in panel channel (keep it clean)
        try {
            const oldMessages = await panelChannel.messages.fetch({ limit: 10 });
            for (const [, msg] of oldMessages) {
                if (msg.author.id === client.user.id) {
                    await msg.delete().catch(() => {});
                }
            }
        } catch (_) {}

        const sendOptions = {
            embeds: [embed],
            components: [selectMenu]
        };
        if (bannerAttachment) {
            sendOptions.files = [bannerAttachment];
        }

        await panelChannel.send(sendOptions);

        // ══════════════════════════════════════
        // 4. Create log channel if it doesn't exist
        // ══════════════════════════════════════
        let logChannel = guild.channels.cache.get(config.ticketLogChannelId);
        if (!logChannel) {
            logChannel = await guild.channels.create({
                name: 'ticket-logs',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages
                        ]
                    }
                ]
            });
        }

        // ══════════════════════════════════════
        // Done
        // ══════════════════════════════════════
        await interaction.editReply({
            content: [
                `✅ **Controller Support** ticket system is live.`,
                `> Panel: <#${panelChannel.id}>`,
                `> Category: \`${ticketCategory.name}\``,
                `> Logs: <#${logChannel.id}>`,
                bannerAttachment ? `> Banner: Attached` : `> Banner: Not found (optional)`,
                ``,
                `**Protections active:**`,
                `• 1 open ticket per user`,
                `• 60s cooldown between ticket creation`,
                `• Mass-delete detection (auto-lockdown)`,
                `• Mass role escalation alerts`,
                `• Audit logging on all actions`,
                `• Safe channel deletion (ticket channels only)`
            ].join('\n')
        });
    }
};
