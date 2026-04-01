const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {
  Client,
  Collection,
  GatewayIntentBits
} = require('discord.js');

const config = require('./config');
const Storage = require('./storage');
const { canManageCharacters } = require('./utils/permissions');
const { buildCharacterEmbed } = require('./utils/characterEmbed');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const storage = new Storage(config.dataFile);

client.commands = new Collection();
client.rpgCreateSessions = new Map();

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

function cleanupSessions() {
  const now = Date.now();

  for (const [sessionId, session] of client.rpgCreateSessions.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) {
      client.rpgCreateSessions.delete(sessionId);
    }
  }
}

function startStatusServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      bot: client.user ? client.user.tag : null,
      uptime: process.uptime()
    }));
  });

  server.listen(config.port, () => {
    console.log(`🌐 Servidor HTTP local em http://0.0.0.0:${config.port}`);
  });
}

function buildCharacterMenu(characters, viewerId) {
  if (characters.length <= 1) return [];

  const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

  const options = characters.slice(0, 25).map((character) => ({
    label: `#${character.id} • ${[character.nome, character.sobrenome].filter(Boolean).join(' ').trim() || 'Sem nome'}`.slice(0, 100),
    description: `${character.raca || 'Sem raça'} • ${character.familia || 'Sem família'}`.slice(0, 100),
    value: String(character.id)
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`character-select:${viewerId}`)
    .setPlaceholder('Selecione um personagem')
    .addOptions(options);

  return [new ActionRowBuilder().addComponents(menu)];
}

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log(`📦 Banco em uso: ${config.dataFile}`);
  startStatusServer();
  setInterval(cleanupSessions, 60 * 1000);
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

    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith('create-character:')) return;

      const sessionId = interaction.customId.split(':')[1];
      const session = client.rpgCreateSessions.get(sessionId);

      if (!session) {
        return interaction.reply({
          content: '❌ Essa sessão expirou. Use `/criar-personagem` novamente.',
          ephemeral: true
        });
      }

      if (session.guildId !== interaction.guildId) {
        return interaction.reply({
          content: '❌ Essa criação não pertence a este servidor.',
          ephemeral: true
        });
      }

      if (!canManageCharacters(interaction.user.id, storage, config.ownerId)) {
        return interaction.reply({
          content: '❌ Você não tem permissão para concluir essa criação.',
          ephemeral: true
        });
      }

      const nome = interaction.fields.getTextInputValue('nome').trim();
      const sobrenome = interaction.fields.getTextInputValue('sobrenome').trim();
      const idadeRaw = interaction.fields.getTextInputValue('idade').trim();
      const raca = interaction.fields.getTextInputValue('raca').trim();
      const familia = interaction.fields.getTextInputValue('familia').trim();

      let idade = null;
      if (idadeRaw) {
        const parsedAge = Number(idadeRaw);

        if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 999) {
          return interaction.reply({
            content: '❌ A idade precisa ser um número inteiro válido.',
            ephemeral: true
          });
        }

        idade = parsedAge;
      }

      const character = storage.createCharacter({
        guildId: interaction.guildId,
        playerId: session.playerId,
        createdBy: interaction.user.id,
        nome,
        sobrenome,
        idade,
        raca,
        familia,
        imageUrl: session.imageUrl
      });

      client.rpgCreateSessions.delete(sessionId);

      const user = await client.users.fetch(session.playerId);

      return interaction.reply({
        content: `✅ Personagem criado para ${user}. Agora você pode completar a ficha com \`/editar-personagem id:${character.id}\`.`,
        embeds: [buildCharacterEmbed(character, user, 1, 1)],
        ephemeral: true
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
      const allCharacters = storage.listCharactersByPlayer(interaction.guildId, character.playerId);
      const currentIndex = allCharacters.findIndex((item) => item.id === character.id) + 1;

      return interaction.update({
        embeds: [buildCharacterEmbed(character, user, allCharacters.length, currentIndex)],
        components: buildCharacterMenu(allCharacters, viewerId)
      });
    }
  } catch (error) {
    console.error('❌ Erro durante interação:', error);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: '❌ Ocorreu um erro ao processar essa interação.',
        ephemeral: true
      }).catch(() => null);
    }

    return interaction.reply({
      content: '❌ Ocorreu um erro ao processar essa interação.',
      ephemeral: true
    }).catch(() => null);
  }
});

client.login(config.token).catch((error) => {
  console.error('❌ Falha ao logar no Discord:', error);
  process.exit(1);
});
