const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller-close')
        .setDescription('Force-close the current Controller Support ticket')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config, protectionCtx) {
        const { userTicketCache, unregisterTicket, auditLog, safeDeleteChannel } = protectionCtx;
        const { handleCloseTicket } = require('../handlers/ticketHandler');

        // ── Validate this is a ticket channel ──
        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: 'This command can only be used in a ticket channel.',
                ephemeral: true
            });
        }

        // ── Staff can force-close any ticket ──
        await handleCloseTicket(interaction, client, config, {
            userTicketCache,
            unregisterTicket,
            auditLog,
            safeDeleteChannel
        });
    }
};
