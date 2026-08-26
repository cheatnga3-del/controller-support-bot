const {
    SlashCommandBuilder,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller-panel')
        .setDescription('Resend the Controller Support ticket panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config, protectionCtx) {
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

        const sendOptions = {
            embeds: [embed],
            components: [selectMenu]
        };
        if (bannerAttachment) {
            sendOptions.files = [bannerAttachment];
        }

        await interaction.reply({ ephemeral: true, content: 'Panel sent.' });
        await interaction.channel.send(sendOptions);
    }
};
