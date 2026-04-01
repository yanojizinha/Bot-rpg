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
