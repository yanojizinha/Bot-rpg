# Projeto completo - arquivo por arquivo

## package.json

```json
{
  "name": "discord-rpg-bot",
  "version": "1.0.0",
  "description": "Bot de RPG para Discord com ficha de personagem, admins próprios e suporte a Railway.",
  "main": "src/index.js",
  "type": "commonjs",
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "start": "node src/index.js",
    "deploy": "node deploy-commands.js"
  },
  "dependencies": {
    "discord.js": "^14.19.3",
    "dotenv": "^16.4.5"
  }
}
```

## .env.example

```
DISCORD_TOKEN=COLOQUE_SEU_TOKEN_AQUI
CLIENT_ID=COLOQUE_SEU_CLIENT_ID_AQUI
GUILD_ID=COLOQUE_SEU_GUILD_ID_AQUI
OWNER_ID=COLOQUE_SUA_ID_DISCORD_AQUI

# No Railway, crie um Volume e monte em /data
# Depois defina DATA_DIR=/data
DATA_DIR=./data

# Opcional
NODE_ENV=production
PORT=3000

```

## deploy-commands.js

```js
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

```

## src/config.js

```js
require('dotenv').config();

const path = require('node:path');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }
  return value;
}

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

module.exports = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: required('GUILD_ID'),
  ownerId: required('OWNER_ID'),
  dataDir,
  dataFile: path.join(dataDir, 'rpg-storage.json'),
  port: Number(process.env.PORT || 3000)
};

```

## src/storage.js

```js
const fs = require('node:fs');
const path = require('node:path');

const EMPTY_DB = {
  version: 1,
  admins: [],
  characters: [],
  counters: {
    characterId: 1
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

class Storage {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(EMPTY_DB, null, 2),
        'utf8'
      );
    }
  }

  read() {
    this.ensureFile();
    const raw = fs.readFileSync(this.filePath, 'utf8');

    try {
      const parsed = JSON.parse(raw);

      if (!parsed.admins) parsed.admins = [];
      if (!parsed.characters) parsed.characters = [];
      if (!parsed.counters) parsed.counters = { characterId: 1 };

      return parsed;
    } catch (error) {
      throw new Error(`Falha ao ler banco JSON: ${error.message}`);
    }
  }

  write(data) {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  isAdmin(userId) {
    const db = this.read();
    return db.admins.some((admin) => admin.userId === userId);
  }

  listAdmins() {
    const db = this.read();
    return deepClone(db.admins);
  }

  addAdmin(userId, addedBy) {
    const db = this.read();

    if (db.admins.some((admin) => admin.userId === userId)) {
      return false;
    }

    db.admins.push({
      userId,
      addedBy,
      addedAt: new Date().toISOString()
    });

    this.write(db);
    return true;
  }

  removeAdmin(userId) {
    const db = this.read();
    const before = db.admins.length;
    db.admins = db.admins.filter((admin) => admin.userId !== userId);
    this.write(db);
    return db.admins.length !== before;
  }

  createCharacter(payload) {
    const db = this.read();
    const id = db.counters.characterId++;

    const character = {
      id,
      guildId: payload.guildId,
      playerId: payload.playerId,
      createdBy: payload.createdBy,
      nome: payload.nome || '',
      sobrenome: payload.sobrenome || '',
      idade: payload.idade ?? null,
      raca: payload.raca || '',
      familia: payload.familia || '',
      cla: payload.cla || '',
      genero: payload.genero || '',
      classe: payload.classe || '',
      rank: payload.rank || '',
      origem: payload.origem || '',
      aparencia: payload.aparencia || '',
      personalidade: payload.personalidade || '',
      historia: payload.historia || '',
      habilidades: payload.habilidades || '',
      inventario: payload.inventario || '',
      imageUrl: payload.imageUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.characters.push(character);
    this.write(db);

    return deepClone(character);
  }

  listCharactersByPlayer(guildId, playerId) {
    const db = this.read();
    return deepClone(
      db.characters
        .filter((character) => character.guildId === guildId && character.playerId === playerId)
        .sort((a, b) => a.id - b.id)
    );
  }

  getCharacterById(guildId, id) {
    const db = this.read();
    const character = db.characters.find(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    return character ? deepClone(character) : null;
  }

  updateCharacter(guildId, id, patch) {
    const db = this.read();
    const index = db.characters.findIndex(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    if (index === -1) {
      return null;
    }

    db.characters[index] = {
      ...db.characters[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.write(db);
    return deepClone(db.characters[index]);
  }

  deleteCharacter(guildId, id) {
    const db = this.read();
    const target = db.characters.find(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    if (!target) {
      return null;
    }

    db.characters = db.characters.filter(
      (item) => !(item.guildId === guildId && item.id === Number(id))
    );

    this.write(db);
    return deepClone(target);
  }
}

module.exports = Storage;

```

## src/utils/permissions.js

```js
function isOwner(userId, ownerId) {
  return userId === ownerId;
}

function canManageCharacters(userId, storage, ownerId) {
  return isOwner(userId, ownerId) || storage.isAdmin(userId);
}

module.exports = {
  isOwner,
  canManageCharacters
};

```

## src/utils/characterEmbed.js

```js
const { EmbedBuilder } = require('discord.js');

function safe(text, fallback = 'Não definido') {
  if (text === null || text === undefined) return fallback;
  if (typeof text === 'string' && text.trim().length === 0) return fallback;
  return String(text);
}

function clip(text, max = 1024) {
  const value = safe(text, '');
  if (!value) return 'Não definido';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function buildCharacterEmbed(character, user, total = 1, index = 1) {
  const fullName = [character.nome, character.sobrenome].filter(Boolean).join(' ').trim() || 'Sem nome';

  const embed = new EmbedBuilder()
    .setTitle(`Ficha de ${fullName}`)
    .setDescription(`ID da ficha: **#${character.id}**`)
    .addFields(
      {
        name: 'Jogador',
        value: `${user}`,
        inline: true
      },
      {
        name: 'Idade',
        value: safe(character.idade, 'Não definida'),
        inline: true
      },
      {
        name: 'Raça',
        value: safe(character.raca),
        inline: true
      },
      {
        name: 'Família',
        value: safe(character.familia),
        inline: true
      },
      {
        name: 'Clã',
        value: safe(character.cla),
        inline: true
      },
      {
        name: 'Classe',
        value: safe(character.classe),
        inline: true
      },
      {
        name: 'Rank',
        value: safe(character.rank),
        inline: true
      },
      {
        name: 'Gênero',
        value: safe(character.genero),
        inline: true
      },
      {
        name: 'Origem',
        value: safe(character.origem),
        inline: true
      },
      {
        name: 'Aparência',
        value: clip(character.aparencia),
        inline: false
      },
      {
        name: 'Personalidade',
        value: clip(character.personalidade),
        inline: false
      },
      {
        name: 'História',
        value: clip(character.historia),
        inline: false
      },
      {
        name: 'Habilidades',
        value: clip(character.habilidades),
        inline: false
      },
      {
        name: 'Inventário',
        value: clip(character.inventario),
        inline: false
      }
    )
    .setColor(0x8b5cf6)
    .setFooter({
      text: `Personagem ${index} de ${total} • Criado em ${new Date(character.createdAt).toLocaleDateString('pt-BR')}`
    })
    .setTimestamp(new Date(character.updatedAt));

  if (character.imageUrl) {
    embed.setImage(character.imageUrl);
  }

  return embed;
}

module.exports = {
  buildCharacterEmbed
};

```

## src/commands/admin-rpg.js

```js
const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-rpg')
    .setDescription('Gerencia quem pode criar, editar e apagar personagens')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adicionar')
        .setDescription('Adiciona um administrador do sistema RPG')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('Usuário que poderá gerenciar personagens')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remover')
        .setDescription('Remove um administrador do sistema RPG')
        .addUserOption((option) =>
          option
            .setName('usuario')
            .setDescription('Usuário a ser removido da lista de admins')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('listar')
        .setDescription('Lista os administradores do sistema RPG')
    ),

  async execute(interaction, context) {
    const { storage, ownerId } = context;

    if (!isOwner(interaction.user.id, ownerId)) {
      return interaction.reply({
        content: '❌ Apenas a dona do bot pode usar esse comando.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'listar') {
      const admins = storage.listAdmins();

      const lines = admins.length
        ? admins.map((admin, index) => `${index + 1}. <@${admin.userId}> • adicionado por <@${admin.addedBy}>`)
        : ['Nenhum admin extra cadastrado.'];

      return interaction.reply({
        content: `👑 **Owner fixa:** <@${ownerId}>\n\n**Admins do RPG:**\n${lines.join('\n')}`,
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('usuario', true);

    if (user.id === ownerId) {
      return interaction.reply({
        content: 'ℹ️ Você já é a administradora fixa do sistema.',
        ephemeral: true
      });
    }

    if (subcommand === 'adicionar') {
      const added = storage.addAdmin(user.id, interaction.user.id);

      return interaction.reply({
        content: added
          ? `✅ ${user} agora pode criar, editar e apagar personagens.`
          : `ℹ️ ${user} já estava na lista de admins do RPG.`,
        ephemeral: true
      });
    }

    if (subcommand === 'remover') {
      const removed = storage.removeAdmin(user.id);

      return interaction.reply({
        content: removed
          ? `✅ ${user} foi removido da lista de admins do RPG.`
          : `ℹ️ ${user} não estava na lista de admins do RPG.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: '❌ Subcomando inválido.',
      ephemeral: true
    });
  }
};

```

## src/commands/criar-personagem.js

```js
const crypto = require('node:crypto');
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const { canManageCharacters } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-personagem')
    .setDescription('Cria uma nova ficha de personagem para um jogador')
    .addUserOption((option) =>
      option
        .setName('jogador')
        .setDescription('Jogador que receberá a ficha')
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName('imagem')
        .setDescription('Imagem do personagem')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { storage, ownerId } = context;

    if (!canManageCharacters(interaction.user.id, storage, ownerId)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para criar personagens.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('jogador', true);
    const image = interaction.options.getAttachment('imagem');

    if (targetUser.bot) {
      return interaction.reply({
        content: '❌ Não é permitido criar personagem para contas de bot.',
        ephemeral: true
      });
    }

    if (image && image.contentType && !image.contentType.startsWith('image/')) {
      return interaction.reply({
        content: '❌ O anexo enviado em "imagem" precisa ser uma imagem válida.',
        ephemeral: true
      });
    }

    const sessionId = crypto.randomUUID();

    interaction.client.rpgCreateSessions.set(sessionId, {
      guildId: interaction.guildId,
      playerId: targetUser.id,
      createdBy: interaction.user.id,
      imageUrl: image?.url || '',
      createdAt: Date.now()
    });

    const modal = new ModalBuilder()
      .setCustomId(`create-character:${sessionId}`)
      .setTitle('Criar personagem');

    const nomeInput = new TextInputBuilder()
      .setCustomId('nome')
      .setLabel('Nome')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const sobrenomeInput = new TextInputBuilder()
      .setCustomId('sobrenome')
      .setLabel('Sobrenome')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const idadeInput = new TextInputBuilder()
      .setCustomId('idade')
      .setLabel('Idade')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('Ex: 19')
      .setMaxLength(3);

    const racaInput = new TextInputBuilder()
      .setCustomId('raca')
      .setLabel('Raça')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const familiaInput = new TextInputBuilder()
      .setCustomId('familia')
      .setLabel('Família')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(sobrenomeInput),
      new ActionRowBuilder().addComponents(idadeInput),
      new ActionRowBuilder().addComponents(racaInput),
      new ActionRowBuilder().addComponents(familiaInput)
    );

    return interaction.showModal(modal);
  }
};

```

## src/commands/ficha.js

```js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { buildCharacterEmbed } = require('../utils/characterEmbed');

function buildMenu(characters, viewerId) {
  if (characters.length <= 1) return [];

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ficha')
    .setDescription('Mostra as fichas registradas de um jogador neste servidor')
    .addUserOption((option) =>
      option
        .setName('jogador')
        .setDescription('Jogador que você quer consultar')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { storage } = context;
    const targetUser = interaction.options.getUser('jogador') || interaction.user;
    const characters = storage.listCharactersByPlayer(interaction.guildId, targetUser.id);

    if (!characters.length) {
      return interaction.reply({
        content: `ℹ️ ${targetUser} não possui personagens cadastrados neste servidor.`,
        ephemeral: true
      });
    }

    const first = characters[0];
    const embed = buildCharacterEmbed(first, targetUser, characters.length, 1);
    const components = buildMenu(characters, interaction.user.id);

    return interaction.reply({
      embeds: [embed],
      components,
      ephemeral: false
    });
  }
};

```

## src/commands/meus-personagens.js

```js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { buildCharacterEmbed } = require('../utils/characterEmbed');

function buildMenu(characters, viewerId) {
  if (characters.length <= 1) return [];

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meus-personagens')
    .setDescription('Mostra os seus personagens cadastrados neste servidor'),

  async execute(interaction, context) {
    const { storage } = context;
    const characters = storage.listCharactersByPlayer(interaction.guildId, interaction.user.id);

    if (!characters.length) {
      return interaction.reply({
        content: 'ℹ️ Você ainda não possui personagens cadastrados neste servidor.',
        ephemeral: true
      });
    }

    const first = characters[0];
    const embed = buildCharacterEmbed(first, interaction.user, characters.length, 1);
    const components = buildMenu(characters, interaction.user.id);

    return interaction.reply({
      embeds: [embed],
      components
    });
  }
};

```

## src/commands/editar-personagem.js

```js
const { SlashCommandBuilder } = require('discord.js');
const { canManageCharacters } = require('../utils/permissions');
const { buildCharacterEmbed } = require('../utils/characterEmbed');

const TEXT_FIELDS = {
  nome: 'nome',
  sobrenome: 'sobrenome',
  raca: 'raca',
  familia: 'familia',
  cla: 'cla',
  genero: 'genero',
  classe: 'classe',
  rank: 'rank',
  origem: 'origem',
  aparencia: 'aparencia',
  personalidade: 'personalidade',
  historia: 'historia',
  habilidades: 'habilidades',
  inventario: 'inventario'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editar-personagem')
    .setDescription('Edita um campo da ficha de um personagem')
    .addIntegerOption((option) =>
      option
        .setName('id')
        .setDescription('ID da ficha do personagem')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('campo')
        .setDescription('Campo que será alterado')
        .setRequired(true)
        .addChoices(
          { name: 'nome', value: 'nome' },
          { name: 'sobrenome', value: 'sobrenome' },
          { name: 'idade', value: 'idade' },
          { name: 'raça', value: 'raca' },
          { name: 'família', value: 'familia' },
          { name: 'clã', value: 'cla' },
          { name: 'gênero', value: 'genero' },
          { name: 'classe', value: 'classe' },
          { name: 'rank', value: 'rank' },
          { name: 'origem', value: 'origem' },
          { name: 'aparência', value: 'aparencia' },
          { name: 'personalidade', value: 'personalidade' },
          { name: 'história', value: 'historia' },
          { name: 'habilidades', value: 'habilidades' },
          { name: 'inventário', value: 'inventario' },
          { name: 'imagem', value: 'imagem' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('valor')
        .setDescription('Novo valor do campo')
        .setRequired(false)
        .setMaxLength(1900)
    )
    .addAttachmentOption((option) =>
      option
        .setName('imagem')
        .setDescription('Nova imagem do personagem')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { storage, ownerId } = context;

    if (!canManageCharacters(interaction.user.id, storage, ownerId)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para editar personagens.',
        ephemeral: true
      });
    }

    const id = interaction.options.getInteger('id', true);
    const field = interaction.options.getString('campo', true);
    const value = interaction.options.getString('valor');
    const image = interaction.options.getAttachment('imagem');

    const character = storage.getCharacterById(interaction.guildId, id);

    if (!character) {
      return interaction.reply({
        content: `❌ Não encontrei nenhuma ficha com ID #${id} neste servidor.`,
        ephemeral: true
      });
    }

    const patch = {};

    if (field === 'idade') {
      if (!value) {
        return interaction.reply({
          content: '❌ Para editar a idade, envie um valor numérico em `valor`.',
          ephemeral: true
        });
      }

      const age = Number(value);

      if (!Number.isInteger(age) || age < 0 || age > 999) {
        return interaction.reply({
          content: '❌ A idade precisa ser um número inteiro válido.',
          ephemeral: true
        });
      }

      patch.idade = age;
    } else if (field === 'imagem') {
      if (image) {
        if (image.contentType && !image.contentType.startsWith('image/')) {
          return interaction.reply({
            content: '❌ O anexo precisa ser uma imagem válida.',
            ephemeral: true
          });
        }

        patch.imageUrl = image.url;
      } else if (value && /^https?:\/\//i.test(value)) {
        patch.imageUrl = value;
      } else {
        return interaction.reply({
          content: '❌ Para o campo imagem, envie um anexo em `imagem` ou uma URL em `valor`.',
          ephemeral: true
        });
      }
    } else if (TEXT_FIELDS[field]) {
      if (typeof value !== 'string') {
        return interaction.reply({
          content: '❌ Esse campo precisa receber um valor em texto.',
          ephemeral: true
        });
      }

      patch[TEXT_FIELDS[field]] = value.trim();
    } else {
      return interaction.reply({
        content: '❌ Campo inválido.',
        ephemeral: true
      });
    }

    const updated = storage.updateCharacter(interaction.guildId, id, patch);
    const user = await interaction.client.users.fetch(updated.playerId);

    return interaction.reply({
      content: `✅ Ficha #${updated.id} atualizada com sucesso.`,
      embeds: [buildCharacterEmbed(updated, user, 1, 1)],
      ephemeral: true
    });
  }
};

```

## src/commands/apagar-personagem.js

```js
const { SlashCommandBuilder } = require('discord.js');
const { canManageCharacters } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apagar-personagem')
    .setDescription('Apaga uma ficha de personagem')
    .addIntegerOption((option) =>
      option
        .setName('id')
        .setDescription('ID da ficha')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { storage, ownerId } = context;

    if (!canManageCharacters(interaction.user.id, storage, ownerId)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para apagar personagens.',
        ephemeral: true
      });
    }

    const id = interaction.options.getInteger('id', true);
    const deleted = storage.deleteCharacter(interaction.guildId, id);

    if (!deleted) {
      return interaction.reply({
        content: `❌ Não encontrei nenhuma ficha com ID #${id} neste servidor.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content: `🗑️ A ficha **#${deleted.id}** de **${deleted.nome} ${deleted.sobrenome || ''}** foi apagada.`,
      ephemeral: true
    });
  }
};

```

## src/index.js

```js
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

```

## README.md

```md
# Bot de RPG para Discord

Projeto pronto para um bot de RPG com:

- `/criar-personagem`
- `/ficha`
- `/meus-personagens`
- `/editar-personagem`
- `/apagar-personagem`
- `/admin-rpg`

## 1) Instalação local

```bash
npm install
```

Copie:

```bash
cp .env.example .env
```

Preencha o `.env`:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
OWNER_ID=...
DATA_DIR=./data
```

Registre os comandos:

```bash
npm run deploy
```

Inicie:

```bash
npm start
```

## 2) Railway

### Recomendado
Como esse projeto salva os dados em arquivo JSON, no Railway você deve criar um **Volume** e montar em `/data`, para não perder os dados quando houver novo deploy ou reinício. Railway documenta volumes como armazenamento persistente para serviços, e a própria documentação separa volumes dentro das opções de Data & Storage. citeturn750101search1turn750101search3

Depois disso, adicione a variável:

```env
DATA_DIR=/data
```

### Variáveis no Railway
No serviço do Railway, abra **Variables** e adicione:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `OWNER_ID`
- `DATA_DIR=/data`

A documentação do Railway mostra que variáveis ficam no serviço e podem ser adicionadas pela aba **Variables**, inclusive em modo bruto. citeturn750101search9turn750101search12

### Deploy
Você pode fazer deploy pelo GitHub ou pela CLI. Railway também documenta `railway up` para subir o projeto pela CLI. citeturn750101search8turn750101search11

### Start command
Se o Railway não detectar sozinho, configure o Start Command como:

```bash
npm start
```

A documentação do Railway diz que o Start Command define o processo usado para iniciar o deploy e que, para apps Node, o Railpack tenta usar `npm start` quando esse script existe no `package.json`. citeturn750101search4turn750101search13

```
