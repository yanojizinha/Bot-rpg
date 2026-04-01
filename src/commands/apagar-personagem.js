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
