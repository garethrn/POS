'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products
router.get('/', auth, (req, res) => {
  try {
    const { category_id, search, include_inactive } = req.query;
    const conditions = [];
    const params = [];

    if (include_inactive !== 'true') {
      conditions.push('p.is_active = 1');
    }
    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }
    if (search) {
      conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.name
    `).all(...params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', auth, (req, res) => {
  try {
    const row = db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', auth, (req, res) => {
  try {
    const {
      name, sku, barcode, price, cost = 0, stock = 0,
      category_id, description, image_url, is_active = 1
    } = req.body;

    if (!name || !sku || price === undefined) {
      return res.status(400).json({ error: 'name, sku, and price are required' });
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO products
        (id, name, sku, barcode, price, cost, stock, category_id, description, image_url, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, sku, barcode || null, price, cost, stock, category_id || null,
           description || null, image_url || null, is_active ? 1 : 0, now, now);

    res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const {
      name, sku, barcode, price, cost, stock,
      category_id, description, image_url, is_active
    } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE products SET
        name        = COALESCE(?, name),
        sku         = COALESCE(?, sku),
        barcode     = COALESCE(?, barcode),
        price       = COALESCE(?, price),
        cost        = COALESCE(?, cost),
        stock       = COALESCE(?, stock),
        category_id = COALESCE(?, category_id),
        description = COALESCE(?, description),
        image_url   = COALESCE(?, image_url),
        is_active   = COALESCE(?, is_active),
        updated_at  = ?
      WHERE id = ?
    `).run(
      name ?? null, sku ?? null, barcode ?? null, price ?? null, cost ?? null,
      stock ?? null, category_id ?? null, description ?? null, image_url ?? null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      now, req.params.id
    );

    res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const now = new Date().toISOString();
    db.prepare('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(now, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
