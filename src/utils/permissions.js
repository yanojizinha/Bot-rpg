function isOwner(userId, ownerId) {
  return userId === ownerId;
}

function canManageCharacters(userId, storage, ownerId) {
  return isOwner(userId, ownerId) || storage.isAdmin(userId);
}

module.exports = {
  isOwner,
  canManageCharacters
};
