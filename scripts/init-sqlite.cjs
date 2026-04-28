/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const dbPath = path.join(dataDir, 'plumberos.db');
const schemaPath = path.join(dataDir, 'schema.sqlite.sql');
const seedPath = path.join(dataDir, 'seed.sqlite.sql');

fs.mkdirSync(dataDir, { recursive: true });
if (fs.existsSync(dbPath)) {
  fs.rmSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = DELETE');
db.pragma('foreign_keys = ON');
db.function('uuid', randomUUID);

db.exec(fs.readFileSync(schemaPath, 'utf8'));
db.exec(fs.readFileSync(seedPath, 'utf8'));
db.close();

console.log('SQLite database created:', dbPath);
