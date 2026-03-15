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
});
