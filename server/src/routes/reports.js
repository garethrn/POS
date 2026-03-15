'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET /bestsellers?from=&to= - top 20 products by qty sold
router.get('/bestsellers', (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT ti.product_id,
             ti.product_name,
             ti.product_sku                        AS sku,
             SUM(ti.quantity)                      AS total_quantity,
             SUM(ti.total)                         AS total_revenue,
             COUNT(DISTINCT ti.transaction_id)     AS transaction_count
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.status = 'completed'
    `;
    const params = [];
    if (from) { sql += ' AND t.created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND t.created_at <= ?'; params.push(to);   }
    sql += ' GROUP BY ti.product_id, ti.product_name, ti.product_sku ORDER BY total_quantity DESC LIMIT 20';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /low-stock - products where stock <= reorder_point (default 5)
router.get('/low-stock', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1
         AND p.stock <= COALESCE(p.reorder_point, 5)
       ORDER BY p.stock ASC
    `).all();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /profit-margin?from=&to= - revenue vs cost per product
router.get('/profit-margin', (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT ti.product_id,
             ti.product_name,
             ti.product_sku                           AS sku,
             SUM(ti.quantity)                         AS total_quantity,
             SUM(ti.total)                            AS total_revenue,
             SUM(ti.quantity * COALESCE(p.cost, 0))  AS total_cost,
             SUM(ti.total) - SUM(ti.quantity * COALESCE(p.cost, 0)) AS gross_profit,
             CASE WHEN SUM(ti.total) > 0
               THEN ROUND((SUM(ti.total) - SUM(ti.quantity * COALESCE(p.cost, 0))) / SUM(ti.total) * 100, 2)
               ELSE 0
             END AS margin_percent
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        LEFT JOIN products p ON p.id = ti.product_id
       WHERE t.status = 'completed'
    `;
    const params = [];
    if (from) { sql += ' AND t.created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND t.created_at <= ?'; params.push(to);   }
    sql += ' GROUP BY ti.product_id, ti.product_name, ti.product_sku ORDER BY gross_profit DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /payment-methods?from=&to= - sales grouped by payment method
router.get('/payment-methods', (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `
      SELECT payment_method,
             COUNT(*)        AS transaction_count,
             SUM(total)      AS total_amount,
             AVG(total)      AS average_amount
        FROM transactions
       WHERE status = 'completed'
    `;
    const params = [];
    if (from) { sql += ' AND created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND created_at <= ?'; params.push(to);   }
    sql += ' GROUP BY payment_method ORDER BY total_amount DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /cash-up/:shift_id - detailed cash-up report for a shift
router.get('/cash-up/:shift_id', (req, res) => {
  try {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const endTime = shift.closed_at || new Date().toISOString();

    const transactions = db.prepare(`
      SELECT *
        FROM transactions
       WHERE cashier_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'
       ORDER BY created_at ASC
    `).all(shift.cashier_id, shift.opened_at, endTime);

    const byPayment = db.prepare(`
      SELECT payment_method,
             COUNT(*)   AS count,
             SUM(total) AS total
        FROM transactions
       WHERE cashier_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'
       GROUP BY payment_method
    `).all(shift.cashier_id, shift.opened_at, endTime);

    const totalSales       = transactions.reduce((s, t) => s + t.total, 0);
    const transactionCount = transactions.length;
    const expectedCash     = shift.opening_cash + (byPayment.find(p => p.payment_method === 'cash')?.total || 0);

    res.json({
      shift,
      summary: {
        total_sales:       totalSales,
        transaction_count: transactionCount,
        opening_cash:      shift.opening_cash,
        closing_cash:      shift.closing_cash,
        expected_cash:     shift.expected_cash ?? expectedCash,
        cash_difference:   shift.cash_difference,
      },
      by_payment_method: byPayment,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
