'use strict';

require('dotenv').config();

// Fail fast if critical environment variables are not set in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable must be set in production.');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Set it before deploying to production.');
}

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Rate limiters ────────────────────────────────────────────────────────────

// Strict limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// ── Middleware ───────────────────────────────────────────────────────────────

// CORS: allow specific origins when CORS_ORIGINS env var is set,
// otherwise allow all origins (needed for the Electron desktop client).
const corsOptions = process.env.CORS_ORIGINS
  ? {
      origin: process.env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    }
  : {};  // default: allow all origins

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth',         authLimiter, require('./routes/auth'));
app.use('/api/products',     apiLimiter,  require('./routes/products'));
app.use('/api/categories',   apiLimiter,  require('./routes/categories'));
app.use('/api/customers',    apiLimiter,  require('./routes/customers'));
app.use('/api/transactions', apiLimiter,  require('./routes/transactions'));
app.use('/api/settings',     apiLimiter,  require('./routes/settings'));
app.use('/api/sync',             apiLimiter,  require('./routes/sync'));
app.use('/api/suppliers',        apiLimiter,  require('./routes/suppliers'));
app.use('/api/purchase-orders',  apiLimiter,  require('./routes/purchase_orders'));
app.use('/api/stock-adjustments',apiLimiter,  require('./routes/stock_adjustments'));
app.use('/api/shifts',           apiLimiter,  require('./routes/shifts'));
app.use('/api/laybys',           apiLimiter,  require('./routes/laybys'));
app.use('/api/reports',          apiLimiter,  require('./routes/reports'));

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
