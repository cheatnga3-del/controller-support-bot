const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('controller-verify-user')
        .setDescription('Manually verify a user')
        .addUserOption(opt => opt.setName('user').setDescription('The user to verify').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, client, config) {
        const target = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        const rolesToAdd = [];
        if (config.verifiedRoleId) rolesToAdd.push(config.verifiedRoleId);
        if (config.memberRoleId) rolesToAdd.push(config.memberRoleId);

        for (const roleId of rolesToAdd) {
            try {
                if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
            } catch (e) { /* ignore */ }
        }

        if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
            try { await member.roles.remove(config.unverifiedRoleId); } catch (_) {}
        }

        await interaction.reply({
            content: `Verified **${target.tag}**.`,
            ephemeral: true
        });
    }
};
