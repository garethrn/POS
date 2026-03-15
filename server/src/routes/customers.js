'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers
router.get('/', auth, (req, res) => {
  try {
    const { search, include_inactive } = req.query;
    const conditions = [];
    const params = [];

    if (include_inactive !== 'true') {
      conditions.push('is_active = 1');
    }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.prepare(`SELECT * FROM customers ${where} ORDER BY name`).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', auth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Customer not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/', auth, (req, res) => {
  try {
    const { name, email, phone, address, loyalty_points = 0, is_active = 1 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const now = new Date().toISOString();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO customers (id, name, email, phone, address, loyalty_points, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email || null, phone || null, address || null,
           loyalty_points, is_active ? 1 : 0, now, now);

    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const { name, email, phone, address, loyalty_points, is_active } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE customers SET
        name           = COALESCE(?, name),
        email          = COALESCE(?, email),
        phone          = COALESCE(?, phone),
        address        = COALESCE(?, address),
        loyalty_points = COALESCE(?, loyalty_points),
        is_active      = COALESCE(?, is_active),
        updated_at     = ?
      WHERE id = ?
    `).run(
      name ?? null, email ?? null, phone ?? null, address ?? null,
      loyalty_points ?? null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      now, req.params.id
    );

    res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id  (soft delete)
router.delete('/:id', auth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const now = new Date().toISOString();
    db.prepare('UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(now, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
