'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET / - list active suppliers with product count
router.get('/', (req, res) => {
  try {
    const suppliers = db.prepare(`
      SELECT s.*,
             COUNT(p.id) AS product_count
        FROM suppliers s
        LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = 1
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.name ASC
    `).all();
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get supplier by id
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create supplier
router.post('/', (req, res) => {
  try {
    const { name, contact, phone, email, address, account_no } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const now      = new Date().toISOString();
    const id       = uuidv4();
    db.prepare(`
      INSERT INTO suppliers (id, name, contact, phone, email, address, account_no, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, name, contact || null, phone || null, email || null, address || null, account_no || null, now, now);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update supplier
router.put('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const { name, contact, phone, email, address, account_no } = req.body;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE suppliers
         SET name = ?, contact = ?, phone = ?, email = ?, address = ?, account_no = ?, updated_at = ?
       WHERE id = ?
    `).run(
      name       ?? supplier.name,
      contact    ?? supplier.contact,
      phone      ?? supplier.phone,
      email      ?? supplier.email,
      address    ?? supplier.address,
      account_no ?? supplier.account_no,
      now,
      req.params.id,
    );
    res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    db.prepare('UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
