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
  runMigrations();
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

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      account_no TEXT,
      is_active INT DEFAULT 1,
      local_only INT DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE,
      supplier_id TEXT REFERENCES suppliers(id),
      status TEXT DEFAULT 'pending',
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id),
      product_id TEXT REFERENCES products(id),
      product_name TEXT,
      quantity_ordered INT DEFAULT 0,
      quantity_received INT DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INT NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      cashier_name TEXT,
      opening_cash REAL DEFAULT 0,
      closing_cash REAL,
      expected_cash REAL,
      cash_difference REAL,
      total_sales REAL DEFAULT 0,
      transaction_count INT DEFAULT 0,
      status TEXT DEFAULT 'open',
      notes TEXT,
      opened_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS laybys (
      id TEXT PRIMARY KEY,
      layby_number TEXT UNIQUE,
      customer_id TEXT REFERENCES customers(id),
      customer_name TEXT,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      deposit REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS layby_items (
      id TEXT PRIMARY KEY,
      layby_id TEXT NOT NULL REFERENCES laybys(id),
      product_id TEXT REFERENCES products(id),
      product_name TEXT,
      sku TEXT,
      quantity INT DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
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
        description=?, is_active=?, supplier_id=?, min_stock=?, max_stock=?, reorder_point=?, updated_at=?
       WHERE id=?`
    ).run(
      product.name, product.sku || null, product.barcode || null,
      product.category_id || null, product.price || 0, product.cost || 0,
      product.stock || 0, product.description || null,
      product.is_active !== undefined ? product.is_active : 1,
      product.supplier_id || null,
      product.min_stock || 0, product.max_stock || 0, product.reorder_point || 5,
      now, product.id
    );
    return { id: product.id };
  }
  const id = uuidv4();
  db.prepare(
    `INSERT INTO products (id, name, sku, barcode, category_id, price, cost, stock, description, is_active, supplier_id, min_stock, max_stock, reorder_point, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, product.name, product.sku || null, product.barcode || null,
    product.category_id || null, product.price || 0, product.cost || 0,
    product.stock || 0, product.description || null,
    product.is_active !== undefined ? product.is_active : 1,
    product.supplier_id || null,
    product.min_stock || 0, product.max_stock || 0, product.reorder_point || 5,
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

// ── Migrations ────────────────────────────────────────────────────────────────
const migrations = [
  'ALTER TABLE products ADD COLUMN supplier_id TEXT',
  'ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0',
  'ALTER TABLE products ADD COLUMN max_stock INTEGER DEFAULT 0',
  'ALTER TABLE products ADD COLUMN reorder_point INTEGER DEFAULT 5',
  'ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT 0',
  "ALTER TABLE customers ADD COLUMN account_type TEXT DEFAULT 'cash'",
  'ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0',
  'ALTER TABLE transaction_items ADD COLUMN product_sku TEXT',
];

function runMigrations() {
  for (const sql of migrations) {
    try { db.prepare(sql).run(); } catch(e) { /* column already exists */ }
  }
}

// ── Suppliers ──────────────────────────────────────────────────────────────────
function getSuppliers() {
  return db.prepare(`SELECT * FROM suppliers WHERE is_active=1 ORDER BY name`).all();
}

function saveSupplier(supplier) {
  const now = new Date().toISOString();
  if (supplier.id) {
    db.prepare(`UPDATE suppliers SET name=?,contact=?,phone=?,email=?,address=?,account_no=?,is_active=?,updated_at=? WHERE id=?`)
      .run(supplier.name, supplier.contact||null, supplier.phone||null, supplier.email||null,
           supplier.address||null, supplier.account_no||null,
           supplier.is_active!==undefined?supplier.is_active:1, now, supplier.id);
    return { id: supplier.id };
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO suppliers (id,name,contact,phone,email,address,account_no,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, supplier.name, supplier.contact||null, supplier.phone||null, supplier.email||null,
         supplier.address||null, supplier.account_no||null,
         supplier.is_active!==undefined?supplier.is_active:1, now, now);
  return { id };
}

function deleteSupplier(id) {
  db.prepare(`UPDATE suppliers SET is_active=0, updated_at=? WHERE id=?`).run(new Date().toISOString(), id);
  return { success: true };
}

// ── Purchase Orders ────────────────────────────────────────────────────────────
function getPurchaseOrders() {
  return db.prepare(`SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id ORDER BY po.created_at DESC`).all();
}

function getPurchaseOrder(id) {
  const po = db.prepare(`SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id WHERE po.id=?`).get(id);
  if (!po) return null;
  po.items = db.prepare(`SELECT * FROM purchase_order_items WHERE po_id=?`).all(id);
  return po;
}

function savePurchaseOrder({ po, items }) {
  const now = new Date().toISOString();
  const id = uuidv4();
  const poNumber = `PO-${Date.now()}`;
  const subtotal = items.reduce((s, i) => s + (i.unit_cost * i.quantity_ordered), 0);
  db.prepare(`INSERT INTO purchase_orders (id,po_number,supplier_id,status,subtotal,total,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, poNumber, po.supplier_id||null, 'pending', subtotal, subtotal, po.notes||null, now, now);
  for (const item of items) {
    db.prepare(`INSERT INTO purchase_order_items (id,po_id,product_id,product_name,quantity_ordered,quantity_received,unit_cost,total_cost,created_at) VALUES (?,?,?,?,?,0,?,?,?)`)
      .run(uuidv4(), id, item.product_id||null, item.product_name||'', item.quantity_ordered||0, item.unit_cost||0, (item.quantity_ordered||0)*(item.unit_cost||0), now);
  }
  return { id, po_number: poNumber };
}

function receivePurchaseOrder(id) {
  const now = new Date().toISOString();
  const receive = db.transaction(() => {
    const items = db.prepare(`SELECT * FROM purchase_order_items WHERE po_id=?`).all(id);
    for (const item of items) {
      db.prepare(`UPDATE purchase_order_items SET quantity_received=quantity_ordered WHERE id=?`).run(item.id);
      if (item.product_id) {
        db.prepare(`UPDATE products SET stock=stock+?, updated_at=? WHERE id=?`).run(item.quantity_ordered, now, item.product_id);
      }
    }
    db.prepare(`UPDATE purchase_orders SET status='received', updated_at=? WHERE id=?`).run(now, id);
  });
  receive();
  return { success: true };
}

// ── Stock Adjustments ──────────────────────────────────────────────────────────
function getStockAdjustments(filters = {}) {
  let query = `SELECT sa.*, p.name AS product_name FROM stock_adjustments sa LEFT JOIN products p ON sa.product_id=p.id`;
  const params = [];
  if (filters.product_id) { query += ` WHERE sa.product_id=?`; params.push(filters.product_id); }
  query += ` ORDER BY sa.created_at DESC`;
  if (filters.limit) { query += ` LIMIT ?`; params.push(filters.limit); }
  return db.prepare(query).all(...params);
}

function saveStockAdjustment(adj) {
  const now = new Date().toISOString();
  const id = uuidv4();
  const adjust = db.transaction(() => {
    db.prepare(`INSERT INTO stock_adjustments (id,product_id,quantity,reason,notes,created_at) VALUES (?,?,?,?,?,?)`)
      .run(id, adj.product_id, adj.quantity, adj.reason, adj.notes||null, now);
    db.prepare(`UPDATE products SET stock=MAX(0,stock+?), updated_at=? WHERE id=?`).run(adj.quantity, now, adj.product_id);
  });
  adjust();
  return { id };
}

// ── Shifts ─────────────────────────────────────────────────────────────────────
function getCurrentShift() {
  return db.prepare(`SELECT * FROM shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`).get() || null;
}

function getShifts() {
  return db.prepare(`SELECT * FROM shifts ORDER BY created_at DESC`).all();
}

function openShift({ opening_cash, cashier_name }) {
  const existing = getCurrentShift();
  if (existing) return existing;
  const now = new Date().toISOString();
  const id = uuidv4();
  db.prepare(`INSERT INTO shifts (id,cashier_name,opening_cash,status,opened_at,created_at,updated_at) VALUES (?,?,?,'open',?,?,?)`)
    .run(id, cashier_name||'Cashier', opening_cash||0, now, now, now);
  return { id };
}

function closeShift({ id, closing_cash, notes }) {
  const now = new Date().toISOString();
  const shift = db.prepare(`SELECT * FROM shifts WHERE id=?`).get(id);
  if (!shift) throw new Error('Shift not found');
  const shiftStart = shift.opened_at;
  const cashSalesRow = db.prepare(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) as count FROM transactions WHERE payment_method='cash' AND status='completed' AND created_at>=? AND created_at<=?`).get(shiftStart, now);
  const allSalesRow = db.prepare(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) as count FROM transactions WHERE status='completed' AND created_at>=? AND created_at<=?`).get(shiftStart, now);
  const expectedCash = (shift.opening_cash || 0) + (cashSalesRow.total || 0);
  const difference = (closing_cash || 0) - expectedCash;
  db.prepare(`UPDATE shifts SET status='closed',closing_cash=?,expected_cash=?,cash_difference=?,total_sales=?,transaction_count=?,notes=?,closed_at=?,updated_at=? WHERE id=?`)
    .run(closing_cash||0, expectedCash, difference, allSalesRow.total||0, allSalesRow.count||0, notes||null, now, now, id);
  return { success: true };
}

// ── Laybys ─────────────────────────────────────────────────────────────────────
function getLaybys(filters = {}) {
  let query = `SELECT l.*, c.name AS customer_name_ref FROM laybys l LEFT JOIN customers c ON l.customer_id=c.id WHERE 1=1`;
  const params = [];
  if (filters.status) { query += ` AND l.status=?`; params.push(filters.status); }
  query += ` ORDER BY l.created_at DESC`;
  return db.prepare(query).all(...params);
}

function getLayby(id) {
  const layby = db.prepare(`SELECT * FROM laybys WHERE id=?`).get(id);
  if (!layby) return null;
  layby.items = db.prepare(`SELECT * FROM layby_items WHERE layby_id=?`).all(id);
  return layby;
}

function saveLayby({ layby, items }) {
  const now = new Date().toISOString();
  const id = layby.id || uuidv4();
  const laybyNumber = layby.layby_number || `LB-${Date.now()}`;
  const save = db.transaction(() => {
    if (layby.id) {
      db.prepare(`UPDATE laybys SET customer_id=?,customer_name=?,subtotal=?,tax=?,discount=?,total=?,deposit=?,balance_due=?,status=?,notes=?,updated_at=? WHERE id=?`)
        .run(layby.customer_id||null, layby.customer_name||'Walk-in', layby.subtotal||0, layby.tax||0, layby.discount||0, layby.total||0, layby.deposit||0, layby.balance_due||0, layby.status||'active', layby.notes||null, now, layby.id);
    } else {
      db.prepare(`INSERT INTO laybys (id,layby_number,customer_id,customer_name,subtotal,tax,discount,total,deposit,balance_due,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, laybyNumber, layby.customer_id||null, layby.customer_name||'Walk-in', layby.subtotal||0, layby.tax||0, layby.discount||0, layby.total||0, layby.deposit||0, layby.balance_due||0, layby.status||'active', layby.notes||null, now, now);
      for (const item of (items||[])) {
        db.prepare(`INSERT INTO layby_items (id,layby_id,product_id,product_name,sku,quantity,unit_price,discount,total,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .run(uuidv4(), id, item.product_id||null, item.product_name, item.sku||null, item.quantity||1, item.unit_price||0, item.discount||0, item.total||0, now);
      }
    }
  });
  save();
  return { id, layby_number: laybyNumber };
}

function addLaybyDeposit({ id, amount, payment_method }) {
  const now = new Date().toISOString();
  const layby = db.prepare(`SELECT * FROM laybys WHERE id=?`).get(id);
  if (!layby) throw new Error('Layby not found');
  const newDeposit = (layby.deposit || 0) + (amount || 0);
  const newBalance = Math.max(0, (layby.total || 0) - newDeposit);
  db.prepare(`UPDATE laybys SET deposit=?,balance_due=?,updated_at=? WHERE id=?`).run(newDeposit, newBalance, now, id);
  return { success: true };
}

function completeLayby({ id, payment_method }) {
  const now = new Date().toISOString();
  const layby = db.prepare(`SELECT * FROM laybys WHERE id=?`).get(id);
  if (!layby) throw new Error('Layby not found');
  const items = db.prepare(`SELECT * FROM layby_items WHERE layby_id=?`).all(id);
  const complete = db.transaction(() => {
    const receiptNumber = `R${Date.now()}`;
    const txnId = uuidv4();
    db.prepare(`INSERT INTO transactions (id,receipt_number,customer_id,subtotal,tax,discount,total,payment_method,amount_tendered,change_due,status,notes,synced,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,0,'completed',?,0,?,?)`)
      .run(txnId, receiptNumber, layby.customer_id||null, layby.subtotal, layby.tax, layby.discount, layby.total, payment_method||'cash', layby.total, `Layby ${layby.layby_number}`, now, now);
    for (const item of items) {
      db.prepare(`INSERT INTO transaction_items (id,transaction_id,product_id,product_name,sku,quantity,unit_price,cost,discount,total,created_at) VALUES (?,?,?,?,?,?,?,0,?,?,?)`)
        .run(uuidv4(), txnId, item.product_id||null, item.product_name, item.sku||null, item.quantity, item.unit_price, item.discount||0, item.total, now);
      if (item.product_id) {
        db.prepare(`UPDATE products SET stock=MAX(0,stock-?), updated_at=? WHERE id=?`).run(item.quantity, now, item.product_id);
      }
    }
    db.prepare(`UPDATE laybys SET status='completed',balance_due=0,deposit=total,updated_at=? WHERE id=?`).run(now, id);
  });
  complete();
  return { success: true };
}

function cancelLayby(id) {
  db.prepare(`UPDATE laybys SET status='cancelled', updated_at=? WHERE id=?`).run(new Date().toISOString(), id);
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
  getSuppliers,
  saveSupplier,
  deleteSupplier,
  getPurchaseOrders,
  getPurchaseOrder,
  savePurchaseOrder,
  receivePurchaseOrder,
  getStockAdjustments,
  saveStockAdjustment,
  getCurrentShift,
  getShifts,
  openShift,
  closeShift,
  getLaybys,
  getLayby,
  saveLayby,
  addLaybyDeposit,
  completeLayby,
  cancelLayby,
};
