const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsDir, file));
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    console.log(`[Controller Support] Deploying ${commands.length} command(s) to guild ${config.guildId}...`);

    try {
        const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log(`[Controller Support] Successfully deployed ${data.length} command(s).`);
        console.log('[Controller Support] Commands:');
        for (const cmd of data) {
            console.log(`  /${cmd.name} — ${cmd.description}`);
        }
    } catch (err) {
        console.error('[Controller Support] Deploy error:', err);
    }

    process.exit(0);
})();
