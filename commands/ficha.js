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
