const {
    Client,
    GatewayIntentBits,
    Collection,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    REST,
    Routes,
    Partials
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,      // needs Server Members intent enabled
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.GuildMember, Partials.Channel]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', file));
    client.commands.set(command.data.name, command);
}

// ── Audit / log helper ──
async function log(guild, color, title, description) {
    try {
        const ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === config.logChannelName);
        if (!ch) return;
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
        await ch.send({ embeds: [embed] });
    } catch (_) {}
}

// ── Find or create verify channel ──
async function findVerifyChannel(guild) {
    let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === config.verifyChannelName);
    if (!ch) {
        ch = await guild.channels.create({
            name: config.verifyChannelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionFlagsBits.SendMessages] }
            ]
        });
    }
    return ch;
}

// ── Post/refresh the verify panel ──
async function postVerifyPanel(channel) {
    const bannerPath = path.resolve(__dirname, config.bannerPath);
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

    // clear old bot panels
    try {
        const msgs = await channel.messages.fetch({ limit: 10 });
        for (const [, m] of msgs) {
            if (m.author.id === client.user.id) await m.delete().catch(() => {});
        }
    } catch (_) {}

    await channel.send(payload);
}

// ── Mark verified ──
async function verifyMember(member) {
    const rolesToAdd = [];
    if (config.verifiedRoleId) rolesToAdd.push(config.verifiedRoleId);
    if (config.memberRoleId) rolesToAdd.push(config.memberRoleId);

    for (const roleId of rolesToAdd) {
        try {
            if (!member.roles.cache.has(roleId)) await member.roles.add(roleId);
        } catch (e) { console.error(`[Verify] Failed to add role ${roleId}:`, e.message); }
    }

    // remove unverified role if configured
    if (config.unverifiedRoleId && member.roles.cache.has(config.unverifiedRoleId)) {
        try {
            await member.roles.remove(config.unverifiedRoleId);
        } catch (e) { console.error('[Verify] Failed to remove unverified role:', e.message); }
    }

    await log(member.guild, config.colors.success, '✅ User Verified',
        `**${member.user.tag}** (${member.user.id}) has been verified.`);
}

// ── Ready ──
client.once('ready', async () => {
    console.log(`[Controller Verify] Logged in as ${client.user.tag}`);

    // Register slash commands
    try {
        const cmds = [];
        for (const [, cmd] of client.commands) cmds.push(cmd.data.toJSON());
        const rest = new REST({ version: '10' }).setToken(config.token);
        await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: cmds });
        console.log(`[Controller Verify] Registered ${cmds.length} command(s).`);
    } catch (err) {
        console.error('[Controller Verify] Command registration failed:', err.message);
    }

    // Post verify panel in every guild
    for (const guild of client.guilds.cache.values()) {
        try {
            const ch = await findVerifyChannel(guild);
            await postVerifyPanel(ch);
            console.log(`[Controller Verify] Panel ready in ${guild.name}`);
        } catch (err) {
            console.error(`[Controller Verify] Panel setup failed in ${guild.name}:`, err.message);
        }
    }
});

// ── On new member join ──
client.on('guildMemberAdd', async (member) => {
    try {
        // Apply unverified role if configured
        if (config.unverifiedRoleId) {
            await member.roles.add(config.unverifiedRoleId).catch(() => {});
        }
        await log(member.guild, config.colors.warning, '📥 Member Joined',
            `**${member.user.tag}** (${member.user.id}) joined and needs verification.`);

        // RestoreCord-style: schedule kick if not verified
        if (config.kickUnverified && config.kickDelaySeconds > 0) {
            setTimeout(async () => {
                try {
                    const fresh = await member.guild.members.fetch(member.id);
                    if (fresh && !fresh.roles.cache.has(config.verifiedRoleId)) {
                        await fresh.kick('Failed to verify within the time limit.');
                        await log(fresh.guild, config.colors.danger, '⏰ Kicked: Not Verified',
                            `**${fresh.user.tag}** did not verify within ${config.kickDelaySeconds}s.`);
                    }
                } catch (_) {}
            }, config.kickDelaySeconds * 1000);
        }
    } catch (err) {
        console.error('[Verify] guildMemberAdd error:', err.message);
    }
});

// ── Interactions ──
client.on('interactionCreate', async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        try {
            await cmd.execute(interaction, client, config);
        } catch (err) {
            console.error(`[Verify] Command error (${interaction.commandName}):`, err);
            const reply = { content: 'Something broke. Ping a dev.', ephemeral: true };
            if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
            else await interaction.reply(reply);
        }
    }

    // Verify button
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            try {
                await verifyMember(interaction.member);
                await interaction.reply({
                    content: '✅ You are now verified! Welcome in.',
                    ephemeral: true
                });
            } catch (err) {
                console.error('[Verify] Button error:', err);
                await interaction.reply({
                    content: 'Verification failed. Please contact staff.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
});

process.on('unhandledRejection', (err) => console.error('[Verify] Unhandled rejection:', err));

client.login(config.token);
