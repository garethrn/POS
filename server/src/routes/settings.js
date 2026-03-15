'use strict';

const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
    // Convert to a key-value object for convenience
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', auth, (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Body must be a key-value object' });
    }

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    const upsertAll = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        upsert.run(key, String(value), now);
      }
    });
    upsertAll();

    const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
