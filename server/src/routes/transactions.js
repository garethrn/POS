'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions
router.get('/', auth, (req, res) => {
  try {
    const { since, until, cashier_id, status, payment_method } = req.query;
    const conditions = [];
    const params = [];

    if (since) {
      conditions.push('t.created_at >= ?');
      params.push(since);
    }
    if (until) {
      conditions.push('t.created_at <= ?');
      params.push(until);
    }
    if (cashier_id) {
      conditions.push('t.cashier_id = ?');
      params.push(cashier_id);
    }
    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (payment_method) {
      conditions.push('t.payment_method = ?');
      params.push(payment_method);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT t.*, u.username AS cashier_name, c.name AS customer_name
      FROM transactions t
      LEFT JOIN users u ON t.cashier_id = u.id
      LEFT JOIN customers c ON t.customer_id = c.id
      ${where}
      ORDER BY t.created_at DESC
    `).all(...params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/:id  (with items)
router.get('/:id', auth, (req, res) => {
  try {
    const transaction = db.prepare(`
      SELECT t.*, u.username AS cashier_name, c.name AS customer_name
      FROM transactions t
      LEFT JOIN users u ON t.cashier_id = u.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const items = db.prepare(
      'SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY created_at'
    ).all(req.params.id);

    res.json({ ...transaction, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/', auth, (req, res) => {
  try {
    const {
      id: providedId,
      receipt_number,
      customer_id,
      subtotal,
      tax = 0,
      discount = 0,
      total,
      payment_method,
      amount_paid,
      change_amount = 0,
      status = 'completed',
      notes,
      items = [],
      created_at: providedCreatedAt,
    } = req.body;

    if (subtotal === undefined || total === undefined || !payment_method || amount_paid === undefined) {
      return res.status(400).json({ error: 'subtotal, total, payment_method, and amount_paid are required' });
    }

    const now = new Date().toISOString();
    const id = providedId || uuidv4();
    const createdAt = providedCreatedAt || now;

    // Generate a receipt number if not provided
    const receiptNum = receipt_number || `RCP-${uuidv4().slice(0, 8).toUpperCase()}`;

    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO transactions
          (id, receipt_number, customer_id, subtotal, tax, discount, total,
           payment_method, amount_paid, change_amount, status, notes, cashier_id, synced, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, receiptNum, customer_id || null, subtotal, tax, discount, total,
        payment_method, amount_paid, change_amount, status, notes || null,
        req.user.id, createdAt, now
      );

      for (const item of items) {
        const itemId = item.id || uuidv4();
        db.prepare(`
          INSERT INTO transaction_items
            (id, transaction_id, product_id, product_name, product_sku, quantity, unit_price, discount, total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          itemId, id,
          item.product_id || null,
          item.product_name,
          item.product_sku || null,
          item.quantity,
          item.unit_price,
          item.discount || 0,
          item.total,
          item.created_at || now
        );

        // Decrement stock if product_id is provided
        if (item.product_id) {
          db.prepare('UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?')
            .run(item.quantity, now, item.product_id);
        }
      }
    });

    createTransaction();

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    const savedItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(id);

    res.status(201).json({ ...transaction, items: savedItems });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Receipt number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
