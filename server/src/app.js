'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/products',     require('./routes/products'));
app.use('/api/categories',   require('./routes/categories'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/sync',         require('./routes/sync'));

// ── 404 handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start server (only when run directly) ────────────────────────────────────

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`POS server running on port ${PORT}`);
  });
}

module.exports = app;
