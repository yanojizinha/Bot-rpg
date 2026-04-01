const { SlashCommandBuilder } = require('discord.js');
const { canManageCharacters } = require('../utils/permissions');
const { buildCharacterEmbed } = require('../utils/characterEmbed');

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-personagem')
    .setDescription('Cria uma ficha completa de personagem para um jogador')

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
    )

    .addStringOption((option) =>
      option
        .setName('nome')
        .setDescription('Nome do personagem')
        .setRequired(true)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('sobrenome')
        .setDescription('Sobrenome do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addIntegerOption((option) =>
      option
        .setName('idade')
        .setDescription('Idade do personagem')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(999)
    )

    .addStringOption((option) =>
      option
        .setName('raca')
        .setDescription('Raça do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('familia')
        .setDescription('Família do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('cla')
        .setDescription('Clã do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('genero')
        .setDescription('Gênero do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('classe')
        .setDescription('Classe do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('rank')
        .setDescription('Rank do personagem')
        .setRequired(false)
        .setMaxLength(100)
    )

    .addStringOption((option) =>
      option
        .setName('origem')
        .setDescription('Origem do personagem')
        .setRequired(false)
        .setMaxLength(1000)
    )

    .addStringOption((option) =>
      option
        .setName('personalidade')
        .setDescription('Personalidade do personagem')
        .setRequired(false)
        .setMaxLength(1000)
    )

    .addStringOption((option) =>
      option
        .setName('historia')
        .setDescription('História do personagem')
        .setRequired(false)
        .setMaxLength(4000)
    )

    .addStringOption((option) =>
      option
        .setName('habilidades')
        .setDescription('Habilidades do personagem')
        .setRequired(false)
        .setMaxLength(2000)
    )

    .addStringOption((option) =>
      option
        .setName('aparencia')
        .setDescription('Aparência em texto')
        .setRequired(false)
        .setMaxLength(1000)
    )

    .addStringOption((option) =>
      option
        .setName('inventario')
        .setDescription('Itens iniciais. Ex: Katana, 3 Poções, 2 Kunais')
        .setRequired(false)
        .setMaxLength(1000)
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

    const nome = interaction.options.getString('nome');
    if (!nome?.trim()) {
      return interaction.reply({
        content: '❌ O comando `/criar-personagem` está desatualizado no Discord. Rode `npm run deploy` novamente.',
        ephemeral: true
      });
    }

    const sobrenome = interaction.options.getString('sobrenome')?.trim() || '';
    const idade = interaction.options.getInteger('idade');
    const raca = interaction.options.getString('raca')?.trim() || '';
    const familia = interaction.options.getString('familia')?.trim() || '';
    const cla = interaction.options.getString('cla')?.trim() || '';
    const genero = interaction.options.getString('genero')?.trim() || '';
    const classe = interaction.options.getString('classe')?.trim() || '';
    const rank = interaction.options.getString('rank')?.trim() || '';
    const origem = interaction.options.getString('origem')?.trim() || '';
    const personalidade = interaction.options.getString('personalidade')?.trim() || '';
    const historia = interaction.options.getString('historia')?.trim() || '';
    const habilidades = interaction.options.getString('habilidades')?.trim() || '';
    const aparencia = interaction.options.getString('aparencia')?.trim() || '';
    const inventarioRaw = interaction.options.getString('inventario')?.trim() || '';

    const inventario = parseInventory(inventarioRaw);

    const character = storage.createCharacter({
      guildId: interaction.guildId,
      playerId: targetUser.id,
      createdBy: interaction.user.id,
      nome: nome.trim(),
      sobrenome,
      idade,
      raca,
      familia,
      cla,
      genero,
      classe,
      rank,
      origem,
      aparencia,
      personalidade,
      historia,
      habilidades,
      inventario,
      imageUrl: image?.url || ''
    });

    const embed = buildCharacterEmbed(character, targetUser, 1, 1);

    return interaction.reply({
      content: `✅ Personagem criado com sucesso para ${targetUser}.`,
      embeds: [embed],
      ephemeral: true
    });
  }
};
