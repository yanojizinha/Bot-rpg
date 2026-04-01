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

function formatInventory(inventory) {
  if (!Array.isArray(inventory) || inventory.length === 0) {
    return 'Vazio';
  }

  const content = inventory
    .map((item) => `• ${item.name} x${item.quantity}`)
    .join('\n');

  if (content.length <= 1024) {
    return content;
  }

  return `${content.slice(0, 1021)}...`;
}

function buildCharacterEmbed(character, user, total = 1, index = 1) {
  const fullName =
    [character.nome, character.sobrenome].filter(Boolean).join(' ').trim() ||
    'Sem nome';

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
        value: character.imageUrl
          ? 'Definida pela imagem da ficha.'
          : clip(character.aparencia),
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
        value: formatInventory(character.inventario),
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
