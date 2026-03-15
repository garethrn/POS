/**
 * web-api.js
 *
 * Browser-based replacement for the Electron IPC posAPI.
 * When the POS is deployed as a web app (cPanel / VPS / any web host),
 * this module provides exactly the same interface as window.posAPI
 * but calls the Express REST API over HTTP instead of Electron IPC.
 *
 * Injected into window.posAPI by index.jsx when NOT running inside Electron.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

// VITE_API_URL: set this to your server URL when building the web client.
// e.g.  VITE_API_URL=https://api.yourstore.com  npm run build:web
// When empty, requests go to the same origin (server and UI on same domain).
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// ── Token helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'pos_token';
const USER_KEY  = 'pos_user';
const LOCAL_SETTINGS_KEY = 'pos_local_settings';

export function getToken()            { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t)           { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken()          { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
export function isLoggedIn()          { return !!getToken(); }
export function getStoredUser()       { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
export function setStoredUser(u)      { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Token expired or invalid → force re-login
  if (response.status === 401) {
    clearToken();
    // Dispatch a custom event so App.jsx can redirect to login
    window.dispatchEvent(new CustomEvent('pos:sessionExpired'));
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return data;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function loginUser(username, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export function logoutUser() {
  clearToken();
  window.dispatchEvent(new CustomEvent('pos:logout'));
}

// ── The posAPI object (mirrors preload.js exactly) ────────────────────────────

export const webPosAPI = {

  // ── Products ────────────────────────────────────────────────────────────────
  products: {
    getAll: () => apiFetch('/api/products'),

    save: async (product) => {
      if (product.id) {
        return apiFetch(`/api/products/${product.id}`, { method: 'PUT', body: product });
      }
      return apiFetch('/api/products', { method: 'POST', body: product });
    },

    delete: (id) => apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
  },

  // ── Categories ──────────────────────────────────────────────────────────────
  categories: {
    getAll: () => apiFetch('/api/categories'),

    save: async (category) => {
      if (category.id) {
        return apiFetch(`/api/categories/${category.id}`, { method: 'PUT', body: category });
      }
      return apiFetch('/api/categories', { method: 'POST', body: category });
    },

    delete: (id) => apiFetch(`/api/categories/${id}`, { method: 'DELETE' }),
  },

  // ── Customers ───────────────────────────────────────────────────────────────
  customers: {
    getAll: () => apiFetch('/api/customers'),

    save: async (customer) => {
      if (customer.id) {
        return apiFetch(`/api/customers/${customer.id}`, { method: 'PUT', body: customer });
      }
      return apiFetch('/api/customers', { method: 'POST', body: customer });
    },

    delete: (id) => apiFetch(`/api/customers/${id}`, { method: 'DELETE' }),
  },

  // ── Transactions ─────────────────────────────────────────────────────────────
  transactions: {
    getAll: async (filters = {}) => {
      const p = new URLSearchParams();
      // Map Electron client filter keys → server query params
      if (filters.startDate)   p.set('since',       filters.startDate);
      if (filters.endDate)     p.set('until',        filters.endDate);
      if (filters.customer_id) p.set('customer_id',  filters.customer_id);
      if (filters.limit)       p.set('limit',        filters.limit);
      const qs = p.toString();
      return apiFetch(`/api/transactions${qs ? `?${qs}` : ''}`);
    },

    get: (id) => apiFetch(`/api/transactions/${id}`),

    save: async ({ transaction, items }) => {
      // The Electron client uses `amount_tendered` / `change_due`;
      // the server expects `amount_paid` / `change_amount`.
      const body = {
        ...transaction,
        amount_paid:   transaction.amount_tendered ?? transaction.amount_paid   ?? 0,
        change_amount: transaction.change_due       ?? transaction.change_amount ?? 0,
        items: (items || []).map((item) => ({
          ...item,
          // The Electron client stores `sku`; the server expects `product_sku`.
          product_sku: item.sku ?? item.product_sku ?? null,
        })),
      };
      return apiFetch('/api/transactions', { method: 'POST', body });
    },
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    get: async () => {
      // Merge server settings with local-only settings stored in localStorage
      // (server_url, auth_token are Electron-only concepts; in web mode the URL
      // is baked in at build time via VITE_API_URL and auth uses the JWT token)
      try {
        const serverSettings = await apiFetch('/api/settings');
        const localSettings  = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}');
        return { ...serverSettings, ...localSettings };
      } catch {
        // If not logged in yet, just return local settings
        return JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}');
      }
    },

    save: async (settings) => {
      // Separate local-only keys from server keys
      const { server_url, auth_token, last_sync_time, ...serverSettings } = settings;
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({ server_url, auth_token, last_sync_time }));
      return apiFetch('/api/settings', { method: 'PUT', body: serverSettings });
    },
  },

  // ── Sync ─────────────────────────────────────────────────────────────────────
  // In web mode, data is always live from the server — no local SQLite to sync.
  sync: {
    checkOnline: async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        return res.ok;
      } catch {
        return false;
      }
    },
    push: () => Promise.resolve({ success: true }),
    pull: () => Promise.resolve({ success: true }),
    full: () => Promise.resolve({ syncedAt: new Date().toISOString() }),
  },

  // ── App ──────────────────────────────────────────────────────────────────────
  app: {
    getVersion: () => Promise.resolve('web'),
  },

  // ── Suppliers ────────────────────────────────────────────────────────────────
  suppliers: {
    getAll: () => apiFetch('/api/suppliers'),

    save: async (s) => {
      if (s.id) return apiFetch(`/api/suppliers/${s.id}`, { method: 'PUT', body: s });
      return apiFetch('/api/suppliers', { method: 'POST', body: s });
    },

    delete: (id) => apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' }),
  },

  // ── Purchase Orders ───────────────────────────────────────────────────────────
  purchaseOrders: {
    getAll: () => apiFetch('/api/purchase-orders'),
    get:    (id) => apiFetch(`/api/purchase-orders/${id}`),

    save: ({ po, items }) =>
      apiFetch('/api/purchase-orders', {
        method: 'POST',
        body: { ...(po || {}), items: items || [] },
      }),

    receive: async (id) => {
      // Fetch the PO first so we know each item's ID, then receive all at ordered qty
      const po = await apiFetch(`/api/purchase-orders/${id}`);
      const itemsToReceive = (po.items || []).map((item) => ({
        id:                item.id,
        quantity_received: item.quantity_ordered,
      }));
      return apiFetch(`/api/purchase-orders/${id}/receive`, {
        method: 'PUT',
        body:   { items: itemsToReceive },
      });
    },
  },

  // ── Stock Adjustments ─────────────────────────────────────────────────────────
  stockAdjustments: {
    getAll: (f = {}) => {
      const p = new URLSearchParams();
      if (f?.startDate) p.set('from', f.startDate);
      if (f?.endDate)   p.set('to',   f.endDate);
      const qs = p.toString();
      return apiFetch(`/api/stock-adjustments${qs ? `?${qs}` : ''}`);
    },

    save: (adj) => apiFetch('/api/stock-adjustments', { method: 'POST', body: adj }),
  },

  // ── Shifts ────────────────────────────────────────────────────────────────────
  shifts: {
    getCurrent: async () => {
      try {
        return await apiFetch('/api/shifts/current');
      } catch (e) {
        // 404 means no open shift — that's a normal state, not an error
        if (e.message.includes('404') || e.message.toLowerCase().includes('no open shift')) {
          return null;
        }
        throw e;
      }
    },

    getAll: () => apiFetch('/api/shifts'),

    open: (data) => apiFetch('/api/shifts/open', { method: 'POST', body: data }),

    close: (data) =>
      apiFetch(`/api/shifts/${data.id}/close`, {
        method: 'POST',
        body: { closing_cash: data.closing_cash, notes: data.notes },
      }),
  },

  // ── Laybys ────────────────────────────────────────────────────────────────────
  laybys: {
    getAll: (f = {}) => {
      const p = new URLSearchParams();
      if (f?.status) p.set('status', f.status);
      const qs = p.toString();
      return apiFetch(`/api/laybys${qs ? `?${qs}` : ''}`);
    },

    get: (id) => apiFetch(`/api/laybys/${id}`),

    // Client sends { layby, items }; server expects a flat object with items array
    save: ({ layby, items }) =>
      apiFetch('/api/laybys', {
        method: 'POST',
        body: { ...(layby || {}), items: items || [] },
      }),

    deposit: (data) =>
      apiFetch(`/api/laybys/${data.id}/deposit`, {
        method: 'POST',
        body: { amount: data.amount },
      }),

    complete: (data) =>
      apiFetch(`/api/laybys/${data.id}/complete`, {
        method: 'POST',
        body: { payment_method: data.payment_method },
      }),

    cancel: (id) => apiFetch(`/api/laybys/${id}/cancel`, { method: 'POST' }),
  },
};
