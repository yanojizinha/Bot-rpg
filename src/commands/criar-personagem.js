const crypto = require('node:crypto');
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const { canManageCharacters } = require('../utils/permissions');

function buildStep1Modal(sessionId) {
  const modal = new ModalBuilder()
    .setCustomId(`create-character:step1:${sessionId}`)
    .setTitle('Criar personagem • 1/3');

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

  return modal;
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
      createdAt: Date.now(),
      data: {}
    });

    return interaction.showModal(buildStep1Modal(sessionId));
  }
};
