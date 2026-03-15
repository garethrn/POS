'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { auth } = require('../middleware/auth');

const VALID_REASONS = ['damage', 'theft', 'correction', 'write_off', 'recount', 'other'];

router.use(auth);

// GET / - list adjustments with product name, optional ?from= &to= filters
router.get('/', (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT sa.*, p.name AS product_name, p.sku AS product_sku
        FROM stock_adjustments sa
        LEFT JOIN products p ON p.id = sa.product_id
       WHERE 1=1
    `;
    const params = [];
    if (from) { sql += ' AND sa.created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND sa.created_at <= ?'; params.push(to);   }
    sql += ' ORDER BY sa.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create adjustment, update product stock
router.post('/', (req, res) => {
  try {
    const { product_id, quantity, reason, notes } = req.body;
    if (!product_id)                     return res.status(400).json({ error: 'product_id is required' });
    if (quantity === undefined || quantity === null) return res.status(400).json({ error: 'quantity is required' });
    if (!VALID_REASONS.includes(reason)) return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });

    const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const now = new Date().toISOString();
    const id  = uuidv4();

    const adjust = db.transaction(() => {
      // Re-read stock inside the transaction to avoid TOCTOU race
      const current = db.prepare('SELECT stock FROM products WHERE id = ?').get(product_id);
      const newStock = current.stock + quantity;
      if (newStock < 0) throw Object.assign(new Error('Adjustment would result in negative stock'), { statusCode: 400 });

      db.prepare(`
        INSERT INTO stock_adjustments (id, product_id, quantity, reason, notes, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, product_id, quantity, reason, notes || null, req.user.id, now);
      db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?')
        .run(newStock, now, product_id);
    });
    try {
      adjust();
    } catch (txErr) {
      if (txErr.statusCode === 400) return res.status(400).json({ error: txErr.message });
      throw txErr;
    }

    const adjustment = db.prepare(`
      SELECT sa.*, p.name AS product_name, p.sku AS product_sku
        FROM stock_adjustments sa
        LEFT JOIN products p ON p.id = sa.product_id
       WHERE sa.id = ?
    `).get(id);
    res.status(201).json(adjustment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
