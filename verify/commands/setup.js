const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller-verify-setup')
        .setDescription('Create the verification panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config) {
        await interaction.deferReply({ ephemeral: true });

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

        await interaction.channel.send(payload);
        await interaction.editReply({ content: 'Verification panel posted here.' });
    }
};
