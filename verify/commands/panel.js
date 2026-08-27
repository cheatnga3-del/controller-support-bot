const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller-verify-panel')
        .setDescription('(Re)post the verify panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config) {
        const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const path = require('path');
        const fs = require('fs');

        const bannerPath = path.resolve(__dirname, '..', config.bannerPath);
        const bannerAttach = fs.existsSync(bannerPath)
            ? new AttachmentBuilder(bannerPath, { name: 'banner.png' })
            : null;

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`✅ ${config.botName} Verification`)
            .setDescription(
                '**Welcome!** To gain access to the server, please verify yourself.\n\n' +
                'Click the **Verify** button below to complete verification.\n' +
                '*By verifying you agree to our server rules.*'
            )
            .setFooter({ text: config.botName + ' • Verification' })
            .setTimestamp();
        if (bannerAttach) embed.setImage('attachment://banner.png');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

        const payload = { embeds: [embed], components: [row] };
        if (bannerAttach) payload.files = [bannerAttach];

        await interaction.reply({ ephemeral: true, content: 'Panel sent.' });
        await interaction.channel.send(payload);
    }
};
