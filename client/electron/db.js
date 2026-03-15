'use strict';

const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

let db;

function initialize() {
  const dbPath = path.join(app.getPath('userData'), 'pos.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema();
  seedSettings();
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6c757d',
      is_active INT DEFAULT 1,
      local_only INT DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      category_id TEXT REFERENCES categories(id),
      price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      stock INT DEFAULT 0,
      description TEXT,
      is_active INT DEFAULT 1,
      local_only INT DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      loyalty_points INT DEFAULT 0,
      is_active INT DEFAULT 1,
      local_only INT DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      receipt_number TEXT,
      customer_id TEXT REFERENCES customers(id),
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      amount_tendered REAL DEFAULT 0,
      change_due REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      synced INT DEFAULT 0,
      sync_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      product_id TEXT REFERENCES products(id),
      product_name TEXT NOT NULL,
      sku TEXT,
      quantity INT DEFAULT 1,
      unit_price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

const DEFAULT_SETTINGS = {
  server_url: '',
  last_sync_time: '',
  auth_token: '',
  tax_rate: '10',
  currency: 'USD',
  receipt_header: 'Thank you for your business',
  receipt_footer: '',
  store_name: 'My Store',
  store_phone: '',
  store_address: '',
};

function seedSettings() {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, value);
  }
}

// ── Products ─────────────────────────────────────────────────────────────────
function getProducts() {
  return db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY p.name`
    )
    .all();
}

function saveProduct(product) {
  const now = new Date().toISOString();
  if (product.id) {
    db.prepare(
      `UPDATE products SET
        name=?, sku=?, barcode=?, category_id=?, price=?, cost=?, stock=?,
        description=?, is_active=?, updated_at=?
       WHERE id=?`
    ).run(
      product.name, product.sku || null, product.barcode || null,
      product.category_id || null, product.price || 0, product.cost || 0,
      product.stock || 0, product.description || null,
      product.is_active !== undefined ? product.is_active : 1,
      now, product.id
    );
    return { id: product.id };
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO products (id, name, sku, barcode, category_id, price, cost, stock, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, product.name, product.sku || null, product.barcode || null,
    product.category_id || null, product.price || 0, product.cost || 0,
    product.stock || 0, product.description || null,
    product.is_active !== undefined ? product.is_active : 1,
    now, now
  );
  return { id };
}

function deleteProduct(id) {
  db.prepare(`UPDATE products SET is_active=0, updated_at=? WHERE id=?`)
    .run(new Date().toISOString(), id);
  return { success: true };
}

// ── Categories ────────────────────────────────────────────────────────────────
function getCategories() {
  return db
    .prepare(`SELECT * FROM categories WHERE is_active=1 ORDER BY name`)
    .all();
}

function saveCategory(category) {
  const now = new Date().toISOString();
  if (category.id) {
    db.prepare(
      `UPDATE categories SET name=?, color=?, is_active=?, updated_at=? WHERE id=?`
    ).run(
      category.name, category.color || '#6c757d',
      category.is_active !== undefined ? category.is_active : 1,
      now, category.id
    );
    return { id: category.id };
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO categories (id, name, color, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, category.name, category.color || '#6c757d', 1, now, now);
  return { id };
}

function deleteCategory(id) {
  db.prepare(`UPDATE categories SET is_active=0, updated_at=? WHERE id=?`)
    .run(new Date().toISOString(), id);
  return { success: true };
}

// ── Customers ─────────────────────────────────────────────────────────────────
function getCustomers() {
  return db
    .prepare(`SELECT * FROM customers WHERE is_active=1 ORDER BY name`)
    .all();
}

function saveCustomer(customer) {
  const now = new Date().toISOString();
  if (customer.id) {
    db.prepare(
      `UPDATE customers SET name=?, email=?, phone=?, address=?, loyalty_points=?, is_active=?, updated_at=? WHERE id=?`
    ).run(
      customer.name, customer.email || null, customer.phone || null,
      customer.address || null, customer.loyalty_points || 0,
      customer.is_active !== undefined ? customer.is_active : 1,
      now, customer.id
    );
    return { id: customer.id };
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO customers (id, name, email, phone, address, loyalty_points, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, customer.name, customer.email || null, customer.phone || null,
    customer.address || null, customer.loyalty_points || 0, 1, now, now
  );
  return { id };
}

function deleteCustomer(id) {
  db.prepare(`UPDATE customers SET is_active=0, updated_at=? WHERE id=?`)
    .run(new Date().toISOString(), id);
  return { success: true };
}

// ── Transactions ──────────────────────────────────────────────────────────────
function getTransactions(filters = {}) {
  let query = `
    SELECT t.*, c.name AS customer_name
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.startDate) {
    query += ` AND t.created_at >= ?`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ` AND t.created_at <= ?`;
    params.push(filters.endDate);
  }
  if (filters.customer_id) {
    query += ` AND t.customer_id = ?`;
    params.push(filters.customer_id);
  }
  query += ` ORDER BY t.created_at DESC`;
  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }
  return db.prepare(query).all(...params);
}

function getTransaction(id) {
  const transaction = db
    .prepare(
      `SELECT t.*, c.name AS customer_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       WHERE t.id = ?`
    )
    .get(id);
  if (!transaction) return null;
  transaction.items = db
    .prepare(`SELECT * FROM transaction_items WHERE transaction_id = ?`)
    .all(id);
  return transaction;
}

function saveTransaction({ transaction, items }) {
  const now = new Date().toISOString();
  const id = transaction.id || uuidv4();

  const receiptNumber =
    transaction.receipt_number || `R${Date.now()}`;

  const saveTransactionStmt = db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO transactions
        (id, receipt_number, customer_id, subtotal, tax, discount, total,
         payment_method, amount_tendered, change_due, status, notes, synced, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      id, receiptNumber,
      transaction.customer_id || null,
      transaction.subtotal || 0,
      transaction.tax || 0,
      transaction.discount || 0,
      transaction.total || 0,
      transaction.payment_method || 'cash',
      transaction.amount_tendered || 0,
      transaction.change_due || 0,
      transaction.status || 'completed',
      transaction.notes || null,
      transaction.created_at || now,
      now
    );

    for (const item of items) {
      const itemId = item.id || uuidv4();
      db.prepare(
        `INSERT OR REPLACE INTO transaction_items
          (id, transaction_id, product_id, product_name, sku, quantity, unit_price, cost, discount, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        itemId, id,
        item.product_id || null,
        item.product_name,
        item.sku || null,
        item.quantity || 1,
        item.unit_price || 0,
        item.cost || 0,
        item.discount || 0,
        item.total || 0,
        now
      );

      if (item.product_id) {
        db.prepare(
          `UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?`
        ).run(item.quantity || 1, now, item.product_id);
      }
    }
  });

  saveTransactionStmt();
  return { id, receipt_number: receiptNumber };
}

// ── Settings ──────────────────────────────────────────────────────────────────
function getSettings() {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function saveSettings(settings) {
  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
  );
  const saveAll = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, value, now);
    }
  });
  saveAll();
  return { success: true };
}

// ── Sync helpers ──────────────────────────────────────────────────────────────
function getSyncData(since) {
  const sinceDate = since || '1970-01-01T00:00:00.000Z';
  return {
    products: db
      .prepare(`SELECT * FROM products WHERE updated_at > ?`)
      .all(sinceDate),
    categories: db
      .prepare(`SELECT * FROM categories WHERE updated_at > ?`)
      .all(sinceDate),
    customers: db
      .prepare(`SELECT * FROM customers WHERE updated_at > ?`)
      .all(sinceDate),
    transactions: db
      .prepare(`SELECT * FROM transactions WHERE updated_at > ? AND synced = 0`)
      .all(sinceDate),
    transaction_items: db
      .prepare(
        `SELECT ti.* FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         WHERE t.updated_at > ? AND t.synced = 0`
      )
      .all(sinceDate),
  };
}

function applySyncData(data) {
  const now = new Date().toISOString();

  const applyAll = db.transaction(() => {
    for (const cat of data.categories || []) {
      db.prepare(
        `INSERT INTO categories (id, name, color, is_active, local_only, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, color=excluded.color,
           is_active=excluded.is_active, updated_at=excluded.updated_at
         WHERE excluded.updated_at > categories.updated_at`
      ).run(
        cat.id, cat.name, cat.color || '#6c757d', cat.is_active ?? 1,
        cat.created_at || now, cat.updated_at || now
      );
    }

    for (const prod of data.products || []) {
      db.prepare(
        `INSERT INTO products (id, name, sku, barcode, category_id, price, cost, stock, description, is_active, local_only, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, sku=excluded.sku, barcode=excluded.barcode,
           category_id=excluded.category_id, price=excluded.price, cost=excluded.cost,
           stock=excluded.stock, description=excluded.description,
           is_active=excluded.is_active, updated_at=excluded.updated_at
         WHERE excluded.updated_at > products.updated_at`
      ).run(
        prod.id, prod.name, prod.sku || null, prod.barcode || null,
        prod.category_id || null, prod.price || 0, prod.cost || 0,
        prod.stock || 0, prod.description || null, prod.is_active ?? 1,
        prod.created_at || now, prod.updated_at || now
      );
    }

    for (const cust of data.customers || []) {
      db.prepare(
        `INSERT INTO customers (id, name, email, phone, address, loyalty_points, is_active, local_only, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, email=excluded.email, phone=excluded.phone,
           address=excluded.address, loyalty_points=excluded.loyalty_points,
           is_active=excluded.is_active, updated_at=excluded.updated_at
         WHERE excluded.updated_at > customers.updated_at`
      ).run(
        cust.id, cust.name, cust.email || null, cust.phone || null,
        cust.address || null, cust.loyalty_points || 0, cust.is_active ?? 1,
        cust.created_at || now, cust.updated_at || now
      );
    }

    for (const txn of data.transactions || []) {
      db.prepare(
        `INSERT INTO transactions
          (id, receipt_number, customer_id, subtotal, tax, discount, total,
           payment_method, amount_tendered, change_due, status, notes, synced, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           receipt_number=excluded.receipt_number, customer_id=excluded.customer_id,
           subtotal=excluded.subtotal, tax=excluded.tax, discount=excluded.discount,
           total=excluded.total, payment_method=excluded.payment_method,
           status=excluded.status, synced=1, updated_at=excluded.updated_at
         WHERE excluded.updated_at > transactions.updated_at`
      ).run(
        txn.id, txn.receipt_number || null, txn.customer_id || null,
        txn.subtotal || 0, txn.tax || 0, txn.discount || 0, txn.total || 0,
        txn.payment_method || 'cash', txn.amount_tendered || 0,
        txn.change_due || 0, txn.status || 'completed',
        txn.notes || null, txn.created_at || now, txn.updated_at || now
      );
    }

    for (const item of data.transaction_items || []) {
      db.prepare(
        `INSERT OR IGNORE INTO transaction_items
          (id, transaction_id, product_id, product_name, sku, quantity, unit_price, cost, discount, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        item.id, item.transaction_id, item.product_id || null,
        item.product_name, item.sku || null, item.quantity || 1,
        item.unit_price || 0, item.cost || 0, item.discount || 0,
        item.total || 0, item.created_at || now
      );
    }
  });

  applyAll();
  return { success: true };
}

function markSynced(ids) {
  if (!ids || ids.length === 0) return { success: true };
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `UPDATE transactions SET synced=1, updated_at=? WHERE id=?`
  );
  const updateAll = db.transaction(() => {
    for (const id of ids) stmt.run(now, id);
  });
  updateAll();
  return { success: true };
}

module.exports = {
  initialize,
  getProducts,
  saveProduct,
  deleteProduct,
  getCategories,
  saveCategory,
  deleteCategory,
  getCustomers,
  saveCustomer,
  deleteCustomer,
  getTransactions,
  getTransaction,
  saveTransaction,
  getSettings,
  saveSettings,
  getSyncData,
  applySyncData,
  markSynced,
};
