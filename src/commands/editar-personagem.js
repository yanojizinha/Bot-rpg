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
  personalidade: 'personalidade',
  historia: 'historia',
  habilidades: 'habilidades'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editar-personagem')
    .setDescription('Edita um campo da ficha de um personagem')
    .addIntegerOption((option) =>
      option
        .setName('id')
        .setDescription('ID da ficha')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('campo')
        .setDescription('Campo que será editado')
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
          { name: 'personalidade', value: 'personalidade' },
          { name: 'história', value: 'historia' },
          { name: 'habilidades', value: 'habilidades' },
          { name: 'aparência', value: 'aparencia' },
          { name: 'imagem', value: 'imagem' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('valor')
        .setDescription('Novo valor para o campo')
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
        content: `❌ Não encontrei nenhuma ficha com ID **#${id}** neste servidor.`,
        ephemeral: true
      });
    }

    const patch = {};

    if (field === 'idade') {
      if (!value) {
        return interaction.reply({
          content: '❌ Para editar a idade, envie um número em `valor`.',
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
            content: '❌ O anexo enviado precisa ser uma imagem válida.',
            ephemeral: true
          });
        }

        patch.imageUrl = image.url;
      } else if (value && /^https?:\/\//i.test(value)) {
        patch.imageUrl = value.trim();
      } else {
        return interaction.reply({
          content: '❌ Para editar a imagem, envie um anexo em `imagem` ou uma URL em `valor`.',
          ephemeral: true
        });
      }
    } else if (field === 'aparencia') {
      if (!value?.trim()) {
        return interaction.reply({
          content: '❌ Esse campo precisa de um valor em texto.',
          ephemeral: true
        });
      }

      patch.aparencia = value.trim();
    } else if (TEXT_FIELDS[field]) {
      if (!value?.trim()) {
        return interaction.reply({
          content: '❌ Esse campo precisa de um valor em texto.',
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

    if (!updated) {
      return interaction.reply({
        content: '❌ Não consegui atualizar essa ficha.',
        ephemeral: true
      });
    }

    const user = await interaction.client.users.fetch(updated.playerId);

    return interaction.reply({
      content: `✅ A ficha **#${updated.id}** foi atualizada com sucesso.`,
      embeds: [buildCharacterEmbed(updated, user, 1, 1)],
      ephemeral: true
    });
  }
};
