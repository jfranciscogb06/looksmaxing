import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'looksmaxing.db');

let db;
let dbReady = false;

export function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        createTables()
          .then(() => {
            dbReady = true;
            console.log('Database tables initialized');
            resolve();
          })
          .catch(reject);
      }
    });
  });
}

async function createTables() {
  const run = promisify(db.run.bind(db));

  // Users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(err => {
    console.error('Error creating users table:', err);
    throw err;
  });

  // Scans table
  await run(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      image_path TEXT,
      landmarks TEXT,
      water_retention REAL,
      inflammation_index REAL,
      lymph_congestion_score REAL,
      facial_fat_layer REAL,
      definition_score REAL,
      potential_ceiling REAL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).catch(err => {
    console.error('Error creating scans table:', err);
    throw err;
  });

  // Create indexes
  await run(`CREATE INDEX IF NOT EXISTS idx_scans_user_date ON scans(user_id, scan_date)`).catch(err => {
    console.error('Error creating index:', err);
    throw err;
  });
}

export function isDbReady() {
  return dbReady;
}

export function getDb() {
  return db;
}

export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}


