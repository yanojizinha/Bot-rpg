require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  InteractionType,
  MessageFlags,
} = require('discord.js');

const { initDatabase, closeDatabase } = require('./src/database');
const { isRpgManager } = require('./src/utils/permissions');
const { buildCharacterEmbed, buildCharacterSelectRow } = require('./src/utils/characterEmbeds');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.pendingCharacterCreates = new Map();
client.characterViewSessions = new Map();
client.db = null;

const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function cleanupMap(map, maxAgeMs) {
  const now = Date.now();
  for (const [key, value] of map.entries()) {
    if (!value?.createdAt || now - value.createdAt > maxAgeMs) {
      map.delete(key);
    }
  }
}

client.once(Events.ClientReady, async readyClient => {
  client.db = await initDatabase(process.env.DATABASE_PATH);

  setInterval(() => {
    cleanupMap(client.pendingCharacterCreates, 10 * 60 * 1000);
    cleanupMap(client.characterViewSessions, 30 * 60 * 1000);
  }, 5 * 60 * 1000).unref();

  console.log(`✅ Bot de RPG online como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      if (!interaction.customId.startsWith('criar_personagem:')) return;

      const token = interaction.customId.split(':')[1];
      const context = client.pendingCharacterCreates.get(token);

      if (!context) {
        await interaction.reply({
          content: 'Esse formulário expirou. Use `/criar-personagem` novamente.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const allowed = await isRpgManager(client.db, interaction.guildId, interaction.user.id, process.env.OWNER_ID);
      if (!allowed) {
        await interaction.reply({
          content: 'Você não tem permissão para criar personagens.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const nome = interaction.fields.getTextInputValue('nome').trim();
      const sobrenome = interaction.fields.getTextInputValue('sobrenome').trim();
      const idadeRaw = interaction.fields.getTextInputValue('idade').trim();
      const raca = interaction.fields.getTextInputValue('raca').trim();
      const familia = interaction.fields.getTextInputValue('familia').trim();

      const idade = Number(idadeRaw);
      if (!Number.isInteger(idade) || idade < 0 || idade > 9999) {
        await interaction.reply({
          content: 'A idade precisa ser um número inteiro válido.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const now = new Date().toISOString();
      const result = await client.db.run(
        `INSERT INTO rpg_characters (
          guild_id, player_id, created_by,
          nome, sobrenome, idade, raca, familia, image_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          context.guildId,
          context.playerId,
          interaction.user.id,
          nome,
          sobrenome || null,
          idade,
          raca || null,
          familia || null,
          context.imageUrl || null,
          now,
          now,
        ],
      );

      const createdCharacter = await client.db.get(
        'SELECT * FROM rpg_characters WHERE id = ? AND guild_id = ?',
        [result.lastID, context.guildId],
      );

      client.pendingCharacterCreates.delete(token);

      const embed = buildCharacterEmbed(createdCharacter, interaction.guild, interaction.user, {
        titlePrefix: '✅ Personagem criado',
        pageText: 'Ficha recém-criada',
      });

      await interaction.reply({
        content: `Personagem criado para <@${context.playerId}> com sucesso.`,
        embeds: [embed],
      });
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (!interaction.customId.startsWith('ficha_select:')) return;

      const token = interaction.customId.split(':')[1];
      const session = client.characterViewSessions.get(token);

      if (!session) {
        await interaction.reply({
          content: 'Essa visualização expirou. Use `/ficha` novamente.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (session.viewerId !== interaction.user.id) {
        await interaction.reply({
          content: 'Só quem abriu essa ficha pode trocar de personagem nesse menu.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const characterId = Number(interaction.values[0]);
      const character = await client.db.get(
        'SELECT * FROM rpg_characters WHERE id = ? AND guild_id = ?',
        [characterId, session.guildId],
      );

      if (!character) {
        await interaction.reply({
          content: 'Esse personagem não foi encontrado.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = buildCharacterEmbed(character, interaction.guild, interaction.user, {
        titlePrefix: '📖 Ficha de personagem',
        pageText: `${session.characters.findIndex(c => c.id === character.id) + 1}/${session.characters.length}`,
      });

      session.createdAt = Date.now();
      client.characterViewSessions.set(token, session);

      await interaction.update({
        embeds: [embed],
        components: [buildCharacterSelectRow(token, session.characters, character.id)],
      });
    }
  } catch (error) {
    console.error('❌ Erro ao tratar interação:', error);

    const payload = {
      content: 'Ocorreu um erro ao executar essa ação.',
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      try {
        await interaction.followUp(payload);
      } catch {}
    } else {
      try {
        await interaction.reply(payload);
      } catch {}
    }
  }
});

process.on('SIGINT', async () => {
  await closeDatabase(client.db);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase(client.db);
  process.exit(0);
});

client.generateToken = generateToken;
client.login(process.env.DISCORD_TOKEN);
