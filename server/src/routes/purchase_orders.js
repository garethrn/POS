'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET / - list POs with supplier name, optional ?status= filter
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT po.*, s.name AS supplier_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
    `;
    const params = [];
    if (status) { sql += ' WHERE po.status = ?'; params.push(status); }
    sql += ' ORDER BY po.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get PO with items
router.get('/:id', (req, res) => {
  try {
    const po = db.prepare(`
      SELECT po.*, s.name AS supplier_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.id = ?
    `).get(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    po.items = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(req.params.id);
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create PO with items
router.post('/', (req, res) => {
  try {
    const { supplier_id, notes, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const now      = new Date().toISOString();
    const id       = uuidv4();
    const poNumber = 'PO-' + Date.now();

    let subtotal = 0;
    for (const it of items) {
      subtotal += (it.quantity_ordered || 0) * (it.unit_cost || 0);
    }
    const tax   = req.body.tax   || 0;
    const total = subtotal + tax;

    const createPO = db.transaction(() => {
      db.prepare(`
        INSERT INTO purchase_orders (id, po_number, supplier_id, status, subtotal, tax, total, notes, created_at, updated_at)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
      `).run(id, poNumber, supplier_id || null, subtotal, tax, total, notes || null, now, now);

      for (const it of items) {
        const qty  = it.quantity_ordered || 0;
        const cost = it.unit_cost        || 0;
        db.prepare(`
          INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity_ordered, quantity_received, unit_cost, total_cost, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
        `).run(uuidv4(), id, it.product_id || null, it.product_name, qty, cost, qty * cost, now);
      }
    });
    createPO();

    const po   = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    po.items   = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(id);
    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id/receive - receive items, update stock, mark PO received
router.put('/:id/receive', (req, res) => {
  try {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!po)                         return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'cancelled')   return res.status(400).json({ error: 'Cannot receive a cancelled PO' });
    if (po.status === 'received')    return res.status(400).json({ error: 'PO already fully received' });

    // items: [{ id, quantity_received }]
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const now = new Date().toISOString();
    const warnings = [];
    const receive = db.transaction(() => {
      for (const it of items) {
        const poItem = db.prepare('SELECT * FROM purchase_order_items WHERE id = ? AND po_id = ?')
                         .get(it.id, req.params.id);
        if (!poItem) continue;
        const requested = it.quantity_received || 0;
        if (requested > poItem.quantity_ordered) {
          warnings.push(`Item "${poItem.product_name}": requested ${requested} but only ${poItem.quantity_ordered} were ordered. Capping at ordered quantity.`);
        }
        const received = Math.min(requested, poItem.quantity_ordered);
        db.prepare('UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?')
          .run(received, it.id);
        if (poItem.product_id && received > 0) {
          db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?')
            .run(received, now, poItem.product_id);
        }
      }
      db.prepare('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?')
        .run('received', now, req.params.id);
    });
    receive();

    const updated  = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(req.params.id);
    updated.items  = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(req.params.id);
    if (warnings.length > 0) updated.warnings = warnings;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - cancel PO
router.delete('/:id', (req, res) => {
  try {
    const po = db.prepare('SELECT id, status FROM purchase_orders WHERE id = ?').get(req.params.id);
    if (!po)                       return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'received')  return res.status(400).json({ error: 'Cannot cancel a received PO' });
    db.prepare('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?')
      .run('cancelled', new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
