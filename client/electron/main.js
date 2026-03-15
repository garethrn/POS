'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');

const isDev = process.env.ELECTRON_DEV === 'true';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  db.initialize();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Products ────────────────────────────────────────────────────────────────
ipcMain.handle('db:getProducts', () => db.getProducts());
ipcMain.handle('db:saveProduct', (_e, product) => db.saveProduct(product));
ipcMain.handle('db:deleteProduct', (_e, id) => db.deleteProduct(id));

// ── Categories ───────────────────────────────────────────────────────────────
ipcMain.handle('db:getCategories', () => db.getCategories());
ipcMain.handle('db:saveCategory', (_e, category) => db.saveCategory(category));
ipcMain.handle('db:deleteCategory', (_e, id) => db.deleteCategory(id));

// ── Customers ────────────────────────────────────────────────────────────────
ipcMain.handle('db:getCustomers', () => db.getCustomers());
ipcMain.handle('db:saveCustomer', (_e, customer) => db.saveCustomer(customer));
ipcMain.handle('db:deleteCustomer', (_e, id) => db.deleteCustomer(id));

// ── Transactions ─────────────────────────────────────────────────────────────
ipcMain.handle('db:getTransactions', (_e, filters) => db.getTransactions(filters));
ipcMain.handle('db:getTransaction', (_e, id) => db.getTransaction(id));
ipcMain.handle('db:saveTransaction', (_e, data) => db.saveTransaction(data));

// ── Settings ─────────────────────────────────────────────────────────────────
ipcMain.handle('db:getSettings', () => db.getSettings());
ipcMain.handle('db:saveSettings', (_e, settings) => db.saveSettings(settings));

// ── Sync helpers ─────────────────────────────────────────────────────────────
ipcMain.handle('db:getSyncData', (_e, since) => db.getSyncData(since));
ipcMain.handle('db:applySyncData', (_e, data) => db.applySyncData(data));
ipcMain.handle('db:markSynced', (_e, ids) => db.markSynced(ids));

// ── Sync network operations ──────────────────────────────────────────────────
ipcMain.handle('sync:checkOnline', async () => {
  const axios = require('axios');
  const settings = db.getSettings();
  const serverUrl = settings.server_url;
  if (!serverUrl) return false;
  try {
    await axios.get(`${serverUrl}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
});

function buildAuthHeaders(settings) {
  const headers = {};
  if (settings.auth_token) {
    headers['Authorization'] = `Bearer ${settings.auth_token}`;
  }
  return headers;
}

ipcMain.handle('sync:push', async () => {
  const axios = require('axios');
  const settings = db.getSettings();
  const serverUrl = settings.server_url;
  if (!serverUrl) throw new Error('Server URL not configured');

  const since = settings.last_sync_time || '1970-01-01T00:00:00.000Z';
  const syncData = db.getSyncData(since);
  const headers = buildAuthHeaders(settings);

  const response = await axios.post(`${serverUrl}/sync/push`, syncData, { timeout: 30000, headers });
  return response.data;
});

ipcMain.handle('sync:pull', async () => {
  const axios = require('axios');
  const settings = db.getSettings();
  const serverUrl = settings.server_url;
  if (!serverUrl) throw new Error('Server URL not configured');

  const since = settings.last_sync_time || '1970-01-01T00:00:00.000Z';
  const headers = buildAuthHeaders(settings);

  const response = await axios.get(`${serverUrl}/sync/pull?since=${encodeURIComponent(since)}`, {
    timeout: 30000,
    headers,
  });
  db.applySyncData(response.data);

  const now = new Date().toISOString();
  db.saveSettings({ last_sync_time: now });
  return { success: true, syncedAt: now };
});

ipcMain.handle('sync:full', async () => {
  const axios = require('axios');
  const settings = db.getSettings();
  const serverUrl = settings.server_url;
  if (!serverUrl) throw new Error('Server URL not configured');

  const since = settings.last_sync_time || '1970-01-01T00:00:00.000Z';
  const syncData = db.getSyncData(since);
  const headers = buildAuthHeaders(settings);

  await axios.post(`${serverUrl}/sync/push`, syncData, { timeout: 30000, headers });

  const response = await axios.get(`${serverUrl}/sync/pull?since=${encodeURIComponent(since)}`, {
    timeout: 30000,
    headers,
  });
  db.applySyncData(response.data);

  const now = new Date().toISOString();
  db.saveSettings({ last_sync_time: now });
  return { success: true, syncedAt: now };
});

// ── Suppliers ─────────────────────────────────────────────────────────────────
ipcMain.handle('db:getSuppliers', () => db.getSuppliers());
ipcMain.handle('db:saveSupplier', (_e, s) => db.saveSupplier(s));
ipcMain.handle('db:deleteSupplier', (_e, id) => db.deleteSupplier(id));

// ── Purchase Orders ───────────────────────────────────────────────────────────
ipcMain.handle('db:getPurchaseOrders', () => db.getPurchaseOrders());
ipcMain.handle('db:getPurchaseOrder', (_e, id) => db.getPurchaseOrder(id));
ipcMain.handle('db:savePurchaseOrder', (_e, data) => db.savePurchaseOrder(data));
ipcMain.handle('db:receivePurchaseOrder', (_e, id) => db.receivePurchaseOrder(id));

// ── Stock Adjustments ─────────────────────────────────────────────────────────
ipcMain.handle('db:getStockAdjustments', (_e, f) => db.getStockAdjustments(f));
ipcMain.handle('db:saveStockAdjustment', (_e, adj) => db.saveStockAdjustment(adj));

// ── Shifts ────────────────────────────────────────────────────────────────────
ipcMain.handle('db:getCurrentShift', () => db.getCurrentShift());
ipcMain.handle('db:getShifts', () => db.getShifts());
ipcMain.handle('db:openShift', (_e, data) => db.openShift(data));
ipcMain.handle('db:closeShift', (_e, data) => db.closeShift(data));

// ── Laybys ────────────────────────────────────────────────────────────────────
ipcMain.handle('db:getLaybys', (_e, f) => db.getLaybys(f));
ipcMain.handle('db:getLayby', (_e, id) => db.getLayby(id));
ipcMain.handle('db:saveLayby', (_e, data) => db.saveLayby(data));
ipcMain.handle('db:addLaybyDeposit', (_e, data) => db.addLaybyDeposit(data));
ipcMain.handle('db:completeLayby', (_e, data) => db.completeLayby(data));
ipcMain.handle('db:cancelLayby', (_e, id) => db.cancelLayby(id));

// ── App info ─────────────────────────────────────────────────────────────────
ipcMain.handle('app:getVersion', () => app.getVersion());
