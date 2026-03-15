'use strict';

const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/sync/push
 * Body: { categories?, products?, customers?, transactions?, transaction_items? }
 * Upserts each record, using updated_at for conflict resolution (higher timestamp wins).
 */
router.post('/push', auth, (req, res) => {
  try {
    const {
      categories = [],
      products = [],
      customers = [],
      transactions = [],
      transaction_items = [],
    } = req.body;

    const pushAll = db.transaction(() => {
      // ── Categories ──────────────────────────────────────────────────────────
      const upsertCategory = db.prepare(`
        INSERT INTO categories (id, name, color, is_active, created_at, updated_at)
        VALUES (@id, @name, @color, @is_active, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          name       = CASE WHEN excluded.updated_at > categories.updated_at THEN excluded.name       ELSE categories.name       END,
          color      = CASE WHEN excluded.updated_at > categories.updated_at THEN excluded.color      ELSE categories.color      END,
          is_active  = CASE WHEN excluded.updated_at > categories.updated_at THEN excluded.is_active  ELSE categories.is_active  END,
          updated_at = CASE WHEN excluded.updated_at > categories.updated_at THEN excluded.updated_at ELSE categories.updated_at END
      `);
      for (const c of categories) {
        upsertCategory.run({
          id: c.id, name: c.name, color: c.color || '#4CAF50',
          is_active: c.is_active !== undefined ? (c.is_active ? 1 : 0) : 1,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        });
      }

      // ── Products ─────────────────────────────────────────────────────────────
      const upsertProduct = db.prepare(`
        INSERT INTO products
          (id, name, sku, barcode, price, cost, stock, category_id, description, image_url, is_active, created_at, updated_at)
        VALUES
          (@id, @name, @sku, @barcode, @price, @cost, @stock, @category_id, @description, @image_url, @is_active, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          name        = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.name        ELSE products.name        END,
          sku         = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.sku         ELSE products.sku         END,
          barcode     = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.barcode     ELSE products.barcode     END,
          price       = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.price       ELSE products.price       END,
          cost        = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.cost        ELSE products.cost        END,
          stock       = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.stock       ELSE products.stock       END,
          category_id = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.category_id ELSE products.category_id END,
          description = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.description ELSE products.description END,
          image_url   = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.image_url   ELSE products.image_url   END,
          is_active   = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.is_active   ELSE products.is_active   END,
          updated_at  = CASE WHEN excluded.updated_at > products.updated_at THEN excluded.updated_at  ELSE products.updated_at  END
      `);
      for (const p of products) {
        upsertProduct.run({
          id: p.id, name: p.name, sku: p.sku, barcode: p.barcode || null,
          price: p.price, cost: p.cost || 0, stock: p.stock || 0,
          category_id: p.category_id || null, description: p.description || null,
          image_url: p.image_url || null,
          is_active: p.is_active !== undefined ? (p.is_active ? 1 : 0) : 1,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        });
      }

      // ── Customers ────────────────────────────────────────────────────────────
      const upsertCustomer = db.prepare(`
        INSERT INTO customers (id, name, email, phone, address, loyalty_points, is_active, created_at, updated_at)
        VALUES (@id, @name, @email, @phone, @address, @loyalty_points, @is_active, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          name           = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.name           ELSE customers.name           END,
          email          = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.email          ELSE customers.email          END,
          phone          = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.phone          ELSE customers.phone          END,
          address        = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.address        ELSE customers.address        END,
          loyalty_points = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.loyalty_points ELSE customers.loyalty_points END,
          is_active      = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.is_active      ELSE customers.is_active      END,
          updated_at     = CASE WHEN excluded.updated_at > customers.updated_at THEN excluded.updated_at     ELSE customers.updated_at     END
      `);
      for (const c of customers) {
        upsertCustomer.run({
          id: c.id, name: c.name, email: c.email || null, phone: c.phone || null,
          address: c.address || null, loyalty_points: c.loyalty_points || 0,
          is_active: c.is_active !== undefined ? (c.is_active ? 1 : 0) : 1,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        });
      }

      // ── Transactions ─────────────────────────────────────────────────────────
      const upsertTransaction = db.prepare(`
        INSERT INTO transactions
          (id, receipt_number, customer_id, subtotal, tax, discount, total,
           payment_method, amount_paid, change_amount, status, notes, cashier_id, synced, created_at, updated_at)
        VALUES
          (@id, @receipt_number, @customer_id, @subtotal, @tax, @discount, @total,
           @payment_method, @amount_paid, @change_amount, @status, @notes, @cashier_id, 1, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          status     = CASE WHEN excluded.updated_at > transactions.updated_at THEN excluded.status     ELSE transactions.status     END,
          notes      = CASE WHEN excluded.updated_at > transactions.updated_at THEN excluded.notes      ELSE transactions.notes      END,
          synced     = 1,
          updated_at = CASE WHEN excluded.updated_at > transactions.updated_at THEN excluded.updated_at ELSE transactions.updated_at END
      `);
      for (const t of transactions) {
        upsertTransaction.run({
          id: t.id,
          receipt_number: t.receipt_number || `RCP-${t.id.slice(0, 8).toUpperCase()}`,
          customer_id: t.customer_id || null,
          subtotal: t.subtotal, tax: t.tax || 0, discount: t.discount || 0, total: t.total,
          payment_method: t.payment_method, amount_paid: t.amount_paid,
          change_amount: t.change_amount || 0,
          status: t.status || 'completed', notes: t.notes || null,
          cashier_id: t.cashier_id || null,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || new Date().toISOString(),
        });
      }

      // ── Transaction Items ────────────────────────────────────────────────────
      const upsertItem = db.prepare(`
        INSERT INTO transaction_items
          (id, transaction_id, product_id, product_name, product_sku, quantity, unit_price, discount, total, created_at)
        VALUES
          (@id, @transaction_id, @product_id, @product_name, @product_sku, @quantity, @unit_price, @discount, @total, @created_at)
        ON CONFLICT(id) DO NOTHING
      `);
      for (const item of transaction_items) {
        upsertItem.run({
          id: item.id,
          transaction_id: item.transaction_id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          product_sku: item.product_sku || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount || 0,
          total: item.total,
          created_at: item.created_at || new Date().toISOString(),
        });
      }
    });

    pushAll();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sync/pull?since=<ISO timestamp>
 * Returns all records modified since the given timestamp.
 */
router.get('/pull', auth, (req, res) => {
  try {
    const { since } = req.query;
    if (!since) {
      return res.status(400).json({ error: 'Query parameter "since" is required (ISO timestamp)' });
    }

    const categories = db.prepare(
      'SELECT * FROM categories WHERE updated_at > ?'
    ).all(since);

    const products = db.prepare(
      'SELECT * FROM products WHERE updated_at > ?'
    ).all(since);

    const customers = db.prepare(
      'SELECT * FROM customers WHERE updated_at > ?'
    ).all(since);

    const transactions = db.prepare(
      'SELECT * FROM transactions WHERE updated_at > ?'
    ).all(since);

    const transactionIds = transactions.map(t => t.id);
    let transaction_items = [];
    if (transactionIds.length > 0) {
      // Batch the IN query to avoid excessively long SQL with many IDs
      const BATCH_SIZE = 500;
      for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
        const batch = transactionIds.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '?').join(',');
        const rows = db.prepare(
          `SELECT * FROM transaction_items WHERE transaction_id IN (${placeholders})`
        ).all(...batch);
        transaction_items = transaction_items.concat(rows);
      }
    }

    res.json({
      categories,
      products,
      customers,
      transactions,
      transaction_items,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
