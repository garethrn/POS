'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('posAPI', {
  products: {
    getAll: () => ipcRenderer.invoke('db:getProducts'),
    save: (product) => ipcRenderer.invoke('db:saveProduct', product),
    delete: (id) => ipcRenderer.invoke('db:deleteProduct', id),
  },
  categories: {
    getAll: () => ipcRenderer.invoke('db:getCategories'),
    save: (category) => ipcRenderer.invoke('db:saveCategory', category),
    delete: (id) => ipcRenderer.invoke('db:deleteCategory', id),
  },
  customers: {
    getAll: () => ipcRenderer.invoke('db:getCustomers'),
    save: (customer) => ipcRenderer.invoke('db:saveCustomer', customer),
    delete: (id) => ipcRenderer.invoke('db:deleteCustomer', id),
  },
  transactions: {
    getAll: (filters) => ipcRenderer.invoke('db:getTransactions', filters),
    get: (id) => ipcRenderer.invoke('db:getTransaction', id),
    save: (data) => ipcRenderer.invoke('db:saveTransaction', data),
  },
  settings: {
    get: () => ipcRenderer.invoke('db:getSettings'),
    save: (settings) => ipcRenderer.invoke('db:saveSettings', settings),
  },
  sync: {
    checkOnline: () => ipcRenderer.invoke('sync:checkOnline'),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    full: () => ipcRenderer.invoke('sync:full'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  suppliers: {
    getAll: () => ipcRenderer.invoke('db:getSuppliers'),
    save: (s) => ipcRenderer.invoke('db:saveSupplier', s),
    delete: (id) => ipcRenderer.invoke('db:deleteSupplier', id),
  },
  purchaseOrders: {
    getAll: () => ipcRenderer.invoke('db:getPurchaseOrders'),
    get: (id) => ipcRenderer.invoke('db:getPurchaseOrder', id),
    save: (data) => ipcRenderer.invoke('db:savePurchaseOrder', data),
    receive: (id) => ipcRenderer.invoke('db:receivePurchaseOrder', id),
  },
  stockAdjustments: {
    getAll: (f) => ipcRenderer.invoke('db:getStockAdjustments', f),
    save: (adj) => ipcRenderer.invoke('db:saveStockAdjustment', adj),
  },
  shifts: {
    getCurrent: () => ipcRenderer.invoke('db:getCurrentShift'),
    getAll: () => ipcRenderer.invoke('db:getShifts'),
    open: (data) => ipcRenderer.invoke('db:openShift', data),
    close: (data) => ipcRenderer.invoke('db:closeShift', data),
  },
  laybys: {
    getAll: (f) => ipcRenderer.invoke('db:getLaybys', f),
    get: (id) => ipcRenderer.invoke('db:getLayby', id),
    save: (data) => ipcRenderer.invoke('db:saveLayby', data),
    deposit: (data) => ipcRenderer.invoke('db:addLaybyDeposit', data),
    complete: (data) => ipcRenderer.invoke('db:completeLayby', data),
    cancel: (id) => ipcRenderer.invoke('db:cancelLayby', id),
  },
});
