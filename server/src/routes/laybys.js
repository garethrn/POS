'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET / - list laybys with customer name, optional ?status= filter
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT l.*, c.name AS customer_name
        FROM laybys l
        LEFT JOIN customers c ON c.id = l.customer_id
       WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND l.status = ?'; params.push(status); }
    sql += ' ORDER BY l.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get layby with items
router.get('/:id', (req, res) => {
  try {
    const layby = db.prepare(`
      SELECT l.*, c.name AS customer_name
        FROM laybys l
        LEFT JOIN customers c ON c.id = l.customer_id
       WHERE l.id = ?
    `).get(req.params.id);
    if (!layby) return res.status(404).json({ error: 'Layby not found' });
    layby.items = db.prepare('SELECT * FROM layby_items WHERE layby_id = ?').all(req.params.id);
    res.json(layby);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create layby with items
router.post('/', (req, res) => {
  try {
    const { customer_id, customer_name, items, subtotal = 0, tax = 0, discount = 0, total, deposit = 0, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const now          = new Date().toISOString();
    const id           = uuidv4();
    const laybyNumber  = 'LB-' + Date.now();
    const finalTotal   = total ?? (subtotal + tax - discount);
    const balance_due  = Math.max(0, finalTotal - deposit);

    const create = db.transaction(() => {
      db.prepare(`
        INSERT INTO laybys (id, layby_number, customer_id, customer_name, subtotal, tax, discount, total, deposit, balance_due, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).run(id, laybyNumber, customer_id || null, customer_name || null,
             subtotal, tax, discount, finalTotal, deposit, balance_due, notes || null, now, now);

      for (const it of items) {
        db.prepare(`
          INSERT INTO layby_items (id, layby_id, product_id, product_name, sku, quantity, unit_price, discount, total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), id, it.product_id || null, it.product_name, it.sku || null,
               it.quantity || 1, it.unit_price || 0, it.discount || 0,
               it.total ?? ((it.unit_price || 0) * (it.quantity || 1)), now);
      }
    });
    create();

    const layby   = db.prepare('SELECT * FROM laybys WHERE id = ?').get(id);
    layby.items   = db.prepare('SELECT * FROM layby_items WHERE layby_id = ?').all(id);
    res.status(201).json(layby);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/deposit - add deposit, update balance
router.post('/:id/deposit', (req, res) => {
  try {
    const layby = db.prepare('SELECT * FROM laybys WHERE id = ?').get(req.params.id);
    if (!layby)                    return res.status(404).json({ error: 'Layby not found' });
    if (layby.status !== 'active') return res.status(400).json({ error: 'Layby is not active' });

    const { amount } = req.body;
    if (!amount || amount <= 0)    return res.status(400).json({ error: 'amount must be positive' });

    const newDeposit    = layby.deposit    + amount;
    const newBalanceDue = Math.max(0, layby.total - newDeposit);
    const now           = new Date().toISOString();

    db.prepare('UPDATE laybys SET deposit = ?, balance_due = ?, updated_at = ? WHERE id = ?')
      .run(newDeposit, newBalanceDue, now, req.params.id);
    res.json(db.prepare('SELECT * FROM laybys WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/complete - convert to transaction and mark completed
router.post('/:id/complete', (req, res) => {
  try {
    const layby = db.prepare('SELECT * FROM laybys WHERE id = ?').get(req.params.id);
    if (!layby)                    return res.status(404).json({ error: 'Layby not found' });
    if (layby.status !== 'active') return res.status(400).json({ error: 'Layby is not active' });

    const { payment_method = 'cash', amount_paid } = req.body;
    const items     = db.prepare('SELECT * FROM layby_items WHERE layby_id = ?').all(layby.id);
    const now       = new Date().toISOString();
    const txId      = uuidv4();
    const receiptNo = 'LB-' + uuidv4().slice(0, 8).toUpperCase();
    const paid      = amount_paid ?? layby.total;
    const change    = Math.max(0, paid - layby.balance_due);

    const complete = db.transaction(() => {
      db.prepare(`
        INSERT INTO transactions (id, receipt_number, customer_id, subtotal, tax, discount, total, payment_method, amount_paid, change_amount, status, notes, cashier_id, synced, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 0, ?, ?)
      `).run(txId, receiptNo, layby.customer_id, layby.subtotal, layby.tax, layby.discount,
             layby.total, payment_method, paid, change,
             `Layby ${layby.layby_number}`, req.user.id, now, now);

      for (const it of items) {
        db.prepare(`
          INSERT INTO transaction_items (id, transaction_id, product_id, product_name, product_sku, quantity, unit_price, discount, total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), txId, it.product_id, it.product_name, it.sku,
               it.quantity, it.unit_price, it.discount, it.total, now);
        if (it.product_id) {
          db.prepare('UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?')
            .run(it.quantity, now, it.product_id);
        }
      }
      db.prepare("UPDATE laybys SET status = 'completed', updated_at = ? WHERE id = ?")
        .run(now, layby.id);
    });
    complete();

    res.json({
      layby:       db.prepare('SELECT * FROM laybys WHERE id = ?').get(layby.id),
      transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/cancel - cancel layby
router.post('/:id/cancel', (req, res) => {
  try {
    const layby = db.prepare('SELECT id, status FROM laybys WHERE id = ?').get(req.params.id);
    if (!layby)                        return res.status(404).json({ error: 'Layby not found' });
    if (layby.status === 'completed')  return res.status(400).json({ error: 'Cannot cancel a completed layby' });
    if (layby.status === 'cancelled')  return res.status(400).json({ error: 'Layby already cancelled' });
    db.prepare("UPDATE laybys SET status = 'cancelled', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
