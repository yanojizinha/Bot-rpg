require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./src/config');

async function deployCommands() {
  const commandsPath = path.join(__dirname, 'src', 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  const commands = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.warn(`⚠️ Ignorando ${file}: exporte "data" e "execute".`);
      continue;
    }

    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log(`🔁 Registrando ${commands.length} comandos...`);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );

  console.log('✅ Slash commands registrados com sucesso.');
}

deployCommands().catch((error) => {
  console.error('❌ Erro ao registrar comandos:', error);
  process.exit(1);
});
