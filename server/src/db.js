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

  CREATE TABLE IF NOT EXISTS suppliers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    contact     TEXT,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    account_no  TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id           TEXT PRIMARY KEY,
    po_number    TEXT NOT NULL UNIQUE,
    supplier_id  TEXT REFERENCES suppliers(id),
    status       TEXT NOT NULL DEFAULT 'pending',
    subtotal     REAL NOT NULL DEFAULT 0,
    tax          REAL NOT NULL DEFAULT 0,
    total        REAL NOT NULL DEFAULT 0,
    notes        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                TEXT PRIMARY KEY,
    po_id             TEXT NOT NULL REFERENCES purchase_orders(id),
    product_id        TEXT REFERENCES products(id),
    product_name      TEXT NOT NULL,
    quantity_ordered  INTEGER NOT NULL DEFAULT 0,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    unit_cost         REAL NOT NULL DEFAULT 0,
    total_cost        REAL NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock_adjustments (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    notes       TEXT,
    user_id     TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id                TEXT PRIMARY KEY,
    cashier_id        TEXT REFERENCES users(id),
    cashier_name      TEXT,
    opening_cash      REAL NOT NULL DEFAULT 0,
    closing_cash      REAL,
    expected_cash     REAL,
    cash_difference   REAL,
    total_sales       REAL NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'open',
    notes             TEXT,
    opened_at         TEXT NOT NULL,
    closed_at         TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS laybys (
    id             TEXT PRIMARY KEY,
    layby_number   TEXT NOT NULL UNIQUE,
    customer_id    TEXT REFERENCES customers(id),
    customer_name  TEXT,
    subtotal       REAL NOT NULL DEFAULT 0,
    tax            REAL NOT NULL DEFAULT 0,
    discount       REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL DEFAULT 0,
    deposit        REAL NOT NULL DEFAULT 0,
    balance_due    REAL NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'active',
    notes          TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS layby_items (
    id           TEXT PRIMARY KEY,
    layby_id     TEXT NOT NULL REFERENCES laybys(id),
    product_id   TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    sku          TEXT,
    quantity     INTEGER NOT NULL DEFAULT 1,
    unit_price   REAL NOT NULL DEFAULT 0,
    discount     REAL NOT NULL DEFAULT 0,
    total        REAL NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_prices (
    id          TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    product_id  TEXT NOT NULL REFERENCES products(id),
    price       REAL NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(customer_id, product_id)
  );
`);

// ── Migrations: add columns to existing tables ───────────────────────────────

const addProductColumns = [
  'ALTER TABLE products ADD COLUMN supplier_id TEXT',
  'ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0',
  'ALTER TABLE products ADD COLUMN max_stock INTEGER DEFAULT 0',
  'ALTER TABLE products ADD COLUMN reorder_point INTEGER DEFAULT 5',
];
for (const sql of addProductColumns) {
  try { db.prepare(sql).run(); } catch (e) { /* column already exists */ }
}

const addCustomerColumns = [
  'ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0',
  'ALTER TABLE customers ADD COLUMN account_type TEXT DEFAULT \'cash\'',
  'ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0',
];
for (const sql of addCustomerColumns) {
  try { db.prepare(sql).run(); } catch (e) { /* column already exists */ }
}

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
