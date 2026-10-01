const Database = require('better-sqlite3');

const db = new Database('members.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS members (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username TEXT,
  full_name TEXT NOT NULL,
  is_opted_out INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS cooldowns (
  chat_id INTEGER NOT NULL,
  command TEXT NOT NULL,
  next_available_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, command)
);
`);

function upsertMember({ chatId, userId, username, fullName }) {
  const stmt = db.prepare(`
    INSERT INTO members (chat_id, user_id, username, full_name, updated_at)
    VALUES (@chatId, @userId, @username, @fullName, @updatedAt)
    ON CONFLICT(chat_id, user_id)
    DO UPDATE SET
      username = excluded.username,
      full_name = excluded.full_name,
      updated_at = excluded.updated_at
  `);

  stmt.run({
    chatId,
    userId,
    username: username || null,
    fullName,
    updatedAt: Date.now()
  });
}

function setOptOut({ chatId, userId, isOptedOut }) {
  db.prepare(`
    UPDATE members
    SET is_opted_out = @isOptedOut, updated_at = @updatedAt
    WHERE chat_id = @chatId AND user_id = @userId
  `).run({
    chatId,
    userId,
    isOptedOut: isOptedOut ? 1 : 0,
    updatedAt: Date.now()
  });
}

function getTaggableMembers(chatId) {
  return db
    .prepare(`
      SELECT user_id, username, full_name
      FROM members
      WHERE chat_id = ? AND is_opted_out = 0
      ORDER BY updated_at DESC
    `)
    .all(chatId);
}

function getCooldown(chatId, command) {
  const row = db
    .prepare(`SELECT next_available_at FROM cooldowns WHERE chat_id = ? AND command = ?`)
    .get(chatId, command);
  return row ? row.next_available_at : 0;
}

function setCooldown(chatId, command, nextAvailableAt) {
  db.prepare(`
    INSERT INTO cooldowns (chat_id, command, next_available_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id, command)
    DO UPDATE SET next_available_at = excluded.next_available_at
  `).run(chatId, command, nextAvailableAt);
}

module.exports = {
  upsertMember,
  setOptOut,
  getTaggableMembers,
  getCooldown,
  setCooldown
};
