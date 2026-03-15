'use strict';

require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'pos.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'cashier',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#4CAF50',
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    sku          TEXT NOT NULL UNIQUE,
    barcode      TEXT,
    price        REAL NOT NULL,
    cost         REAL NOT NULL DEFAULT 0,
    stock        INTEGER NOT NULL DEFAULT 0,
    category_id  TEXT REFERENCES categories(id),
    description  TEXT,
    image_url    TEXT,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT,
    phone          TEXT,
    address        TEXT,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id             TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL UNIQUE,
    customer_id    TEXT REFERENCES customers(id),
    subtotal       REAL NOT NULL,
    tax            REAL NOT NULL DEFAULT 0,
    discount       REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL,
    payment_method TEXT NOT NULL,
    amount_paid    REAL NOT NULL,
    change_amount  REAL NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'completed',
    notes          TEXT,
    cashier_id     TEXT REFERENCES users(id),
    synced         INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    id             TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id),
    product_id     TEXT,
    product_name   TEXT NOT NULL,
    product_sku    TEXT,
    quantity       INTEGER NOT NULL,
    unit_price     REAL NOT NULL,
    discount       REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL,
    created_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const crypto = require('crypto');

// ── Seed default admin user ──────────────────────────────────────────────────

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  // Use ADMIN_PASSWORD env var if set; otherwise generate a random password and log it.
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(10).toString('hex');
  if (!process.env.ADMIN_PASSWORD) {
    console.log('='.repeat(60));
    console.log('FIRST RUN: Default admin credentials created:');
    console.log('  Username: admin');
    console.log(`  Password: ${adminPassword}`);
    console.log('Change this password immediately after first login.');
    console.log('='.repeat(60));
  }
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, username, password, role, created_at, updated_at)
    VALUES (?, ?, ?, 'admin', ?, ?)
  `).run(uuidv4(), 'admin', hashedPassword, now, now);
}

// ── Seed default settings ────────────────────────────────────────────────────

const defaultSettings = [
  { key: 'store_name',       value: 'My Store' },
  { key: 'store_address',    value: '' },
  { key: 'store_phone',      value: '' },
  { key: 'store_email',      value: '' },
  { key: 'currency',         value: 'USD' },
  { key: 'currency_symbol',  value: '$' },
  { key: 'tax_rate',         value: '0' },
  { key: 'receipt_footer',   value: 'Thank you for your purchase!' },
  { key: 'low_stock_alert',  value: '10' },
];

const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO NOTHING
`);

const seedSettings = db.transaction(() => {
  const now = new Date().toISOString();
  for (const s of defaultSettings) {
    upsertSetting.run(s.key, s.value, now);
  }
});
seedSettings();

module.exports = db;
