const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {
  Client,
  Collection,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const config = require('./config');
const Storage = require('./storage');
const { buildCharacterEmbed } = require('./utils/characterEmbed');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const storage = new Storage(config.dataFile);

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));

  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`⚠️ O arquivo ${file} não exporta "data" e "execute".`);
  }
}

function startStatusServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8'
    });

    res.end(
      JSON.stringify({
        ok: true,
        bot: client.user ? client.user.tag : null,
        uptime: process.uptime()
      })
    );
  });

  server.listen(config.port, () => {
    console.log(`🌐 Servidor HTTP local em http://0.0.0.0:${config.port}`);
  });
}

function buildCharacterMenu(characters, viewerId) {
  if (characters.length <= 1) return [];

  const options = characters.slice(0, 25).map((character) => ({
    label: `#${character.id} • ${
      [character.nome, character.sobrenome].filter(Boolean).join(' ').trim() ||
      'Sem nome'
    }`.slice(0, 100),
    description: `${character.raca || 'Sem raça'} • ${
      character.familia || 'Sem família'
    }`.slice(0, 100),
    value: String(character.id)
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`character-select:${viewerId}`)
    .setPlaceholder('Selecione um personagem')
    .addOptions(options);

  return [new ActionRowBuilder().addComponents(menu)];
}

client.once('clientReady', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log(`📦 Banco em uso: ${config.dataFile}`);
  startStatusServer();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        return interaction.reply({
          content: '❌ Comando não encontrado.',
          ephemeral: true
        });
      }

      return command.execute(interaction, {
        storage,
        ownerId: config.ownerId
      });
    }

    if (interaction.isStringSelectMenu()) {
      if (!interaction.customId.startsWith('character-select:')) return;

      const viewerId = interaction.customId.split(':')[1];

      if (interaction.user.id !== viewerId) {
        return interaction.reply({
          content: '❌ Só quem abriu essa ficha pode trocar o personagem.',
          ephemeral: true
        });
      }

      const selectedId = Number(interaction.values[0]);
      const character = storage.getCharacterById(interaction.guildId, selectedId);

      if (!character) {
        return interaction.reply({
          content: '❌ Essa ficha não foi encontrada.',
          ephemeral: true
        });
      }

      const user = await client.users.fetch(character.playerId);
      const allCharacters = storage.listCharactersByPlayer(
        interaction.guildId,
        character.playerId
      );

      const currentIndex =
        allCharacters.findIndex((item) => item.id === character.id) + 1;

      return interaction.update({
        embeds: [
          buildCharacterEmbed(
            character,
            user,
            allCharacters.length,
            currentIndex
          )
        ],
        components: buildCharacterMenu(allCharacters, viewerId)
      });
    }
  } catch (error) {
    console.error('❌ Erro durante interação:', error);

    if (interaction.replied || interaction.deferred) {
      return interaction
        .followUp({
          content: '❌ Ocorreu um erro ao processar essa interação.',
          ephemeral: true
        })
        .catch(() => null);
    }

    return interaction
      .reply({
        content: '❌ Ocorreu um erro ao processar essa interação.',
        ephemeral: true
      })
      .catch(() => null);
  }
});

client.login(config.token).catch((error) => {
  console.error('❌ Falha ao logar no Discord:', error);
  process.exit(1);
});
