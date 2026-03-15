'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET / - list all shifts with cashier name
router.get('/', (req, res) => {
  try {
    const shifts = db.prepare(`
      SELECT s.*, u.username AS cashier_username
        FROM shifts s
        LEFT JOIN users u ON u.id = s.cashier_id
       ORDER BY s.created_at DESC
    `).all();
    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /current - get open shift for current user
router.get('/current', (req, res) => {
  try {
    const shift = db.prepare(`
      SELECT * FROM shifts WHERE cashier_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1
    `).get(req.user.id);
    if (!shift) return res.status(404).json({ error: 'No open shift found' });
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - shift details with transactions
router.get('/:id', (req, res) => {
  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    shift.transactions = db.prepare(`
      SELECT id, receipt_number, total, payment_method, created_at
        FROM transactions
       WHERE cashier_id = ? AND created_at >= ? AND created_at <= COALESCE(?, datetime('now'))
         AND status = 'completed'
       ORDER BY created_at DESC
    `).all(shift.cashier_id, shift.opened_at, shift.closed_at || null);
    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /open - open a new shift
router.post('/open', (req, res) => {
  try {
    const existing = db.prepare(
      "SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open'"
    ).get(req.user.id);
    if (existing) return res.status(400).json({ error: 'A shift is already open for this cashier' });

    const { opening_cash = 0, notes, cashier_name } = req.body;
    const now  = new Date().toISOString();
    const id   = uuidv4();
    db.prepare(`
      INSERT INTO shifts (id, cashier_id, cashier_name, opening_cash, total_sales, transaction_count, status, notes, opened_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, 'open', ?, ?, ?, ?)
    `).run(id, req.user.id, cashier_name || req.user.username, opening_cash, notes || null, now, now, now);
    res.status(201).json(db.prepare('SELECT * FROM shifts WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/close - close a shift
router.post('/:id/close', (req, res) => {
  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
    if (!shift)                return res.status(404).json({ error: 'Shift not found' });
    if (shift.status !== 'open') return res.status(400).json({ error: 'Shift is not open' });

    const { closing_cash = 0, notes } = req.body;

    // Calculate total sales during this shift
    const salesRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total_sales,
             COUNT(*) AS transaction_count
        FROM transactions
       WHERE cashier_id = ? AND created_at >= ? AND status = 'completed'
    `).get(shift.cashier_id, shift.opened_at);

    const total_sales       = salesRow.total_sales;
    const transaction_count = salesRow.transaction_count;
    const expected_cash     = shift.opening_cash + total_sales;
    const cash_difference   = closing_cash - expected_cash;
    const now               = new Date().toISOString();

    db.prepare(`
      UPDATE shifts
         SET closing_cash = ?, expected_cash = ?, cash_difference = ?,
             total_sales = ?, transaction_count = ?,
             status = 'closed', notes = ?, closed_at = ?, updated_at = ?
       WHERE id = ?
    `).run(closing_cash, expected_cash, cash_difference, total_sales, transaction_count,
           notes || shift.notes, now, now, req.params.id);

    res.json(db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
