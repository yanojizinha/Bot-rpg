const fs = require('node:fs');
const path = require('node:path');

const EMPTY_DB = {
  version: 2,
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
    this.migrateIfNeeded();
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

  migrateIfNeeded() {
    const db = this.readRaw();
    let changed = false;

    if (!db.version) {
      db.version = 1;
      changed = true;
    }

    if (!Array.isArray(db.admins)) {
      db.admins = [];
      changed = true;
    }

    if (!Array.isArray(db.characters)) {
      db.characters = [];
      changed = true;
    }

    if (!db.counters || typeof db.counters.characterId !== 'number') {
      db.counters = { characterId: 1 };
      changed = true;
    }

    for (const character of db.characters) {
      if (!Array.isArray(character.inventario)) {
        if (
          typeof character.inventario === 'string' &&
          character.inventario.trim().length > 0
        ) {
          character.inventario = [
            {
              name: character.inventario.trim(),
              quantity: 1
            }
          ];
        } else {
          character.inventario = [];
        }
        changed = true;
      }

      if (typeof character.aparencia !== 'string') {
        character.aparencia = '';
        changed = true;
      }

      if (typeof character.nome !== 'string') {
        character.nome = '';
        changed = true;
      }

      if (typeof character.sobrenome !== 'string') {
        character.sobrenome = '';
        changed = true;
      }

      if (typeof character.raca !== 'string') {
        character.raca = '';
        changed = true;
      }

      if (typeof character.familia !== 'string') {
        character.familia = '';
        changed = true;
      }

      if (typeof character.cla !== 'string') {
        character.cla = '';
        changed = true;
      }

      if (typeof character.genero !== 'string') {
        character.genero = '';
        changed = true;
      }

      if (typeof character.classe !== 'string') {
        character.classe = '';
        changed = true;
      }

      if (typeof character.rank !== 'string') {
        character.rank = '';
        changed = true;
      }

      if (typeof character.origem !== 'string') {
        character.origem = '';
        changed = true;
      }

      if (typeof character.personalidade !== 'string') {
        character.personalidade = '';
        changed = true;
      }

      if (typeof character.historia !== 'string') {
        character.historia = '';
        changed = true;
      }

      if (typeof character.habilidades !== 'string') {
        character.habilidades = '';
        changed = true;
      }

      if (typeof character.imageUrl !== 'string') {
        character.imageUrl = '';
        changed = true;
      }
    }

    if (db.version !== 2) {
      db.version = 2;
      changed = true;
    }

    if (changed) {
      this.write(db);
    }
  }

  readRaw() {
    this.ensureFile();
    const raw = fs.readFileSync(this.filePath, 'utf8');

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Falha ao ler banco JSON: ${error.message}`);
    }
  }

  read() {
    const parsed = this.readRaw();

    if (!parsed.admins) parsed.admins = [];
    if (!parsed.characters) parsed.characters = [];
    if (!parsed.counters) parsed.counters = { characterId: 1 };

    return parsed;
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

      inventario: Array.isArray(payload.inventario) ? payload.inventario : [],
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
        .filter(
          (character) =>
            character.guildId === guildId &&
            character.playerId === playerId
        )
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

    const nextCharacter = {
      ...db.characters[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };

    if (!Array.isArray(nextCharacter.inventario)) {
      nextCharacter.inventario = [];
    }

    db.characters[index] = nextCharacter;
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

  getInventory(guildId, id) {
    const character = this.getCharacterById(guildId, id);

    if (!character) {
      return null;
    }

    if (!Array.isArray(character.inventario)) {
      character.inventario = [];
    }

    return deepClone(character.inventario);
  }

  addInventoryItem(guildId, id, itemName, quantity = 1) {
    const db = this.read();

    const index = db.characters.findIndex(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    if (index === -1) {
      return null;
    }

    if (!Array.isArray(db.characters[index].inventario)) {
      db.characters[index].inventario = [];
    }

    const cleanName = String(itemName || '').trim();

    if (!cleanName) {
      return null;
    }

    const existing = db.characters[index].inventario.find(
      (item) => item.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      db.characters[index].inventario.push({
        name: cleanName,
        quantity
      });
    }

    db.characters[index].updatedAt = new Date().toISOString();
    this.write(db);

    return deepClone(db.characters[index]);
  }

  removeInventoryItem(guildId, id, itemName, quantity = 1) {
    const db = this.read();

    const index = db.characters.findIndex(
      (item) => item.guildId === guildId && item.id === Number(id)
    );

    if (index === -1) {
      return null;
    }

    if (!Array.isArray(db.characters[index].inventario)) {
      db.characters[index].inventario = [];
    }

    const cleanName = String(itemName || '').trim();

    const existing = db.characters[index].inventario.find(
      (item) => item.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (!existing) {
      return false;
    }

    existing.quantity -= quantity;

    db.characters[index].inventario = db.characters[index].inventario.filter(
      (item) => item.quantity > 0
    );

    db.characters[index].updatedAt = new Date().toISOString();
    this.write(db);

    return deepClone(db.characters[index]);
  }

  useInventoryItem(guildId, id, itemName, quantity = 1) {
    return this.removeInventoryItem(guildId, id, itemName, quantity);
  }
}

module.exports = Storage;
