const { SlashCommandBuilder } = require('discord.js');
const { canManageCharacters } = require('../utils/permissions');

function formatInventory(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '🎒 Inventário vazio.';
  }

  return items
    .map((item, index) => `${index + 1}. **${item.name}** x${item.quantity}`)
    .join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventario')
    .setDescription('Gerencia o inventário de um personagem')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ver')
        .setDescription('Mostra o inventário do personagem')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID da ficha')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adicionar')
        .setDescription('Adiciona um item ao inventário')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID da ficha')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('item')
            .setDescription('Nome do item')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addIntegerOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Quantidade do item')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remover')
        .setDescription('Remove um item do inventário')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID da ficha')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('item')
            .setDescription('Nome do item')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addIntegerOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Quantidade a remover')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('usar')
        .setDescription('Usa um item do inventário')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID da ficha')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('item')
            .setDescription('Nome do item')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addIntegerOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Quantidade a usar')
            .setRequired(false)
        )
    ),

  async execute(interaction, context) {
    const { storage, ownerId } = context;

    const subcommand = interaction.options.getSubcommand();
    const id = interaction.options.getInteger('id', true);

    const character = storage.getCharacterById(interaction.guildId, id);

    if (!character) {
      return interaction.reply({
        content: `❌ Não encontrei nenhuma ficha com ID **#${id}** neste servidor.`,
        ephemeral: true
      });
    }

    if (subcommand === 'ver') {
      const items = storage.getInventory(interaction.guildId, id);

      return interaction.reply({
        content:
          `🎒 **Inventário da ficha #${id}**\n` +
          `**Personagem:** ${character.nome || 'Sem nome'} ${character.sobrenome || ''}\n\n` +
          formatInventory(items),
        ephemeral: false
      });
    }

    if (!canManageCharacters(interaction.user.id, storage, ownerId)) {
      return interaction.reply({
        content: '❌ Você não tem permissão para alterar inventários.',
        ephemeral: true
      });
    }

    const item = interaction.options.getString('item', true).trim();
    const quantity = interaction.options.getInteger('quantidade') || 1;

    if (!item) {
      return interaction.reply({
        content: '❌ O nome do item não pode ficar vazio.',
        ephemeral: true
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return interaction.reply({
        content: '❌ A quantidade precisa ser um número inteiro maior que 0.',
        ephemeral: true
      });
    }

    if (subcommand === 'adicionar') {
      const updated = storage.addInventoryItem(
        interaction.guildId,
        id,
        item,
        quantity
      );

      if (!updated) {
        return interaction.reply({
          content: '❌ Não consegui adicionar esse item.',
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `✅ Item adicionado à ficha **#${id}**: **${item} x${quantity}**.`,
        ephemeral: true
      });
    }

    if (subcommand === 'remover') {
      const result = storage.removeInventoryItem(
        interaction.guildId,
        id,
        item,
        quantity
      );

      if (result === null) {
        return interaction.reply({
          content: '❌ Não encontrei essa ficha.',
          ephemeral: true
        });
      }

      if (result === false) {
        return interaction.reply({
          content: `❌ O item **${item}** não está no inventário da ficha **#${id}**.`,
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `✅ Item removido da ficha **#${id}**: **${item} x${quantity}**.`,
        ephemeral: true
      });
    }

    if (subcommand === 'usar') {
      const result = storage.useInventoryItem(
        interaction.guildId,
        id,
        item,
        quantity
      );

      if (result === null) {
        return interaction.reply({
          content: '❌ Não encontrei essa ficha.',
          ephemeral: true
        });
      }

      if (result === false) {
        return interaction.reply({
          content: `❌ O item **${item}** não está no inventário da ficha **#${id}**.`,
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `🧪 A ficha **#${id}** usou **${item} x${quantity}**.`,
        ephemeral: false
      });
    }

    return interaction.reply({
      content: '❌ Subcomando inválido.',
      ephemeral: true
    });
  }
};
