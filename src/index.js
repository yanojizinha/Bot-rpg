const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {
  Client,
  Collection,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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

function parseAge(raw) {
  const text = String(raw || '').trim();

  if (!text) return null;

  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
    return { error: true };
  }

  return parsed;
}

function parseInventory(raw) {
  const text = String(raw || '').trim();

  if (!text) return [];

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(\d+)\s+(.+)$/);

      if (match) {
        return {
          name: match[2].trim(),
          quantity: Number(match[1])
        };
      }

      return {
        name: item,
        quantity: 1
      };
    });
}

function buildStep2Modal(sessionId) {
  const modal = new ModalBuilder()
    .setCustomId(`create-character:step2:${sessionId}`)
    .setTitle('Criar personagem • 2/3');

  const claInput = new TextInputBuilder()
    .setCustomId('cla')
    .setLabel('Clã')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const generoInput = new TextInputBuilder()
    .setCustomId('genero')
    .setLabel('Gênero')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const classeInput = new TextInputBuilder()
    .setCustomId('classe')
    .setLabel('Classe')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const rankInput = new TextInputBuilder()
    .setCustomId('rank')
    .setLabel('Rank')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const origemInput = new TextInputBuilder()
    .setCustomId('origem')
    .setLabel('Origem')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(claInput),
    new ActionRowBuilder().addComponents(generoInput),
    new ActionRowBuilder().addComponents(classeInput),
    new ActionRowBuilder().addComponents(rankInput),
    new ActionRowBuilder().addComponents(origemInput)
  );

  return modal;
}

function buildStep3Modal(sessionId) {
  const modal = new ModalBuilder()
    .setCustomId(`create-character:step3:${sessionId}`)
    .setTitle('Criar personagem • 3/3');

  const personalidadeInput = new TextInputBuilder()
    .setCustomId('personalidade')
    .setLabel('Personalidade')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  const historiaInput = new TextInputBuilder()
    .setCustomId('historia')
    .setLabel('História')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(4000);

  const habilidadesInput = new TextInputBuilder()
    .setCustomId('habilidades')
    .setLabel('Habilidades')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);

  const aparenciaInput = new TextInputBuilder()
    .setCustomId('aparencia')
    .setLabel('Aparência (texto opcional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000)
    .setPlaceholder('Se houver imagem, ela será a aparência principal.');

  const inventarioInput = new TextInputBuilder()
    .setCustomId('inventario')
    .setLabel('Inventário inicial')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000)
    .setPlaceholder('Ex: Katana, 3 Poções, 2 Kunais, Mapa antigo');

  modal.addComponents(
    new ActionRowBuilder().addComponents(personalidadeInput),
    new ActionRowBuilder().addComponents(historiaInput),
    new ActionRowBuilder().addComponents(habilidadesInput),
    new ActionRowBuilder().addComponents(aparenciaInput),
    new ActionRowBuilder().addComponents(inventarioInput)
  );

  return modal;
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

      const parts = interaction.customId.split(':');
      const step = parts[1];
      const sessionId = parts[2];

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

      if (step === 'step1') {
        const nome = interaction.fields.getTextInputValue('nome').trim();
        const sobrenome = interaction.fields.getTextInputValue('sobrenome').trim();
        const idadeRaw = interaction.fields.getTextInputValue('idade').trim();
        const raca = interaction.fields.getTextInputValue('raca').trim();
        const familia = interaction.fields.getTextInputValue('familia').trim();

        const idade = parseAge(idadeRaw);

        if (idade && idade.error) {
          return interaction.reply({
            content: '❌ A idade precisa ser um número inteiro válido.',
            ephemeral: true
          });
        }

        session.data.nome = nome;
        session.data.sobrenome = sobrenome;
        session.data.idade = idade;
        session.data.raca = raca;
        session.data.familia = familia;

        return interaction.showModal(buildStep2Modal(sessionId));
      }

      if (step === 'step2') {
        session.data.cla = interaction.fields.getTextInputValue('cla').trim();
        session.data.genero = interaction.fields.getTextInputValue('genero').trim();
        session.data.classe = interaction.fields.getTextInputValue('classe').trim();
        session.data.rank = interaction.fields.getTextInputValue('rank').trim();
        session.data.origem = interaction.fields.getTextInputValue('origem').trim();

        return interaction.showModal(buildStep3Modal(sessionId));
      }

      if (step === 'step3') {
        session.data.personalidade = interaction.fields
          .getTextInputValue('personalidade')
          .trim();
        session.data.historia = interaction.fields
          .getTextInputValue('historia')
          .trim();
        session.data.habilidades = interaction.fields
          .getTextInputValue('habilidades')
          .trim();
        session.data.aparencia = interaction.fields
          .getTextInputValue('aparencia')
          .trim();

        const inventarioRaw = interaction.fields
          .getTextInputValue('inventario')
          .trim();

        session.data.inventario = parseInventory(inventarioRaw);

        const character = storage.createCharacter({
          guildId: interaction.guildId,
          playerId: session.playerId,
          createdBy: interaction.user.id,
          nome: session.data.nome,
          sobrenome: session.data.sobrenome,
          idade: session.data.idade,
          raca: session.data.raca,
          familia: session.data.familia,
          cla: session.data.cla,
          genero: session.data.genero,
          classe: session.data.classe,
          rank: session.data.rank,
          origem: session.data.origem,
          aparencia: session.data.aparencia,
          personalidade: session.data.personalidade,
          historia: session.data.historia,
          habilidades: session.data.habilidades,
          inventario: session.data.inventario,
          imageUrl: session.imageUrl
        });

        client.rpgCreateSessions.delete(sessionId);

        const user = await client.users.fetch(session.playerId);

        return interaction.reply({
          content: `✅ Personagem criado com a ficha completa para ${user}.`,
          embeds: [buildCharacterEmbed(character, user, 1, 1)],
          ephemeral: true
        });
      }

      return interaction.reply({
        content: '❌ Etapa de criação inválida.',
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
