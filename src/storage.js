const fs = require('node:fs');
const path = require('node:path');

const EMPTY_DB = {
  version: 1,
  admins: [],
  characters: [],
  counters: {
    characterId: 1
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

class Storage {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(EMPTY_DB, null, 2),
        'utf8'
      );
    }
  }

  read() {
    this.ensureFile();
    const raw = fs.readFileSync(this.filePath, 'utf8');

    try {
      const parsed = JSON.parse(raw);

      if (!parsed.admins) parsed.admins = [];
      if (!parsed.characters) parsed.characters = [];
      if (!parsed.counters) parsed.counters = { characterId: 1 };

      return parsed;
    } catch (error) {
      throw new Error(`Falha ao ler banco JSON: ${error.message}`);
    }
  }

  write(data) {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  isAdmin(userId) {
    const db = this.read();
    return db.admins.some((admin) => admin.userId === userId);
  }

  listAdmins() {
    const db = this.read();
    return deepClone(db.admins);
  }

  addAdmin(userId, addedBy) {
    const db = this.read();

    if (db.admins.some((admin) => admin.userId === userId)) {
      return false;
    }

    db.admins.push({
      userId,
      addedBy,
      addedAt: new Date().toISOString()
    });

    this.write(db);
    return true;
  }

  removeAdmin(userId) {
    const db = this.read();
    const before = db.admins.length;
    db.admins = db.admins.filter((admin) => admin.userId !== userId);
    this.write(db);
    return db.admins.length !== before;
  }

  createCharacter(payload) {
    const db = this.read();
    const id = db.counters.characterId++;

    const character = {
      id,
      guildId: payload.guildId,
      playerId: payload.playerId,
      createdBy: payload.createdBy,
      nome: payload.nome || '',
      sobrenome: payload.sobrenome || '',
      idade: payload.idade ?? null,
      raca: payload.raca || '',
      familia: payload.familia || '',
      cla: payload.cla || '',
      genero: payload.genero || '',
      classe: payload.classe || '',
      rank: payload.rank || '',
      origem: payload.origem || '',
      aparencia: payload.aparencia || '',
      personalidade: payload.personalidade || '',
      historia: payload.historia || '',
      habilidades: payload.habilidades || '',
      inventario: payload.inventario || '',
      imageUrl: payload.imageUrl || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.characters.push(character);
    this.write(db);

    return deepClone(character);
  }

  listCharactersByPlayer(guildId, playerId) {
    const db = this.read();
    return deepClone(
      db.characters
        .filter((character) => character.guildId === guildId && character.playerId === playerId)
        .sort((a, b) => a.id - b.id)
    );
  }

  getCharacterById(guildId, id) {
    const db = this.read();
    const character = db.characters.find(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    return character ? deepClone(character) : null;
  }

  updateCharacter(guildId, id, patch) {
    const db = this.read();
    const index = db.characters.findIndex(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    if (index === -1) {
      return null;
    }

    db.characters[index] = {
      ...db.characters[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.write(db);
    return deepClone(db.characters[index]);
  }

  deleteCharacter(guildId, id) {
    const db = this.read();
    const target = db.characters.find(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    if (!target) {
      return null;
    }

    db.characters = db.characters.filter(
      (item) => !(item.guildId === guildId && item.id === Number(id))
    );

    this.write(db);
    return deepClone(target);
  }
}

module.exports = Storage;
