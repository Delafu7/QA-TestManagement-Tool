const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/qa-tool.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
