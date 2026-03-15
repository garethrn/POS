'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories
router.get('/', auth, (req, res) => {
  try {
    const { include_inactive } = req.query;
    let rows;
    if (include_inactive === 'true') {
      rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
    } else {
      rows = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY name').all();
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/:id
router.get('/:id', auth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Category not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories
router.post('/', auth, (req, res) => {
  try {
    const { name, color = '#4CAF50', is_active = 1 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const now = new Date().toISOString();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO categories (id, name, color, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, color, is_active ? 1 : 0, now, now);

    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const { name, color, is_active } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE categories
      SET name       = COALESCE(?, name),
          color      = COALESCE(?, color),
          is_active  = COALESCE(?, is_active),
          updated_at = ?
      WHERE id = ?
    `).run(
      name ?? null,
      color ?? null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      now,
      req.params.id
    );

    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id  (soft delete)
router.delete('/:id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const now = new Date().toISOString();
    db.prepare('UPDATE categories SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(now, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
