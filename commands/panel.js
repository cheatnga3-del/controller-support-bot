const {
    SlashCommandBuilder,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller-panel')
        .setDescription('Resend the Controller Support ticket panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config) {
        const bannerPath = path.resolve(__dirname, '..', config.bannerPath);
        const bannerAttachment = new AttachmentBuilder(bannerPath, { name: 'banner.png' });

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
            .setImage('attachment://banner.png')
            .setFooter({ text: 'Controller Support • Tickets' })
            .setTimestamp();

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

        await interaction.reply({ ephemeral: true, content: 'Panel sent.' });

        await interaction.channel.send({
            embeds: [embed],
            files: [bannerAttachment],
            components: [selectMenu]
        });
    }
};
