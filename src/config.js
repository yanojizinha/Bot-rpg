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
