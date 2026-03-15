import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import POSScreen from './components/POS/POSScreen.jsx';
import Products from './components/Products/Products.jsx';
import Categories from './components/Categories/Categories.jsx';
import Customers from './components/Customers/Customers.jsx';
import Transactions from './components/Transactions/Transactions.jsx';
import Reports from './components/Reports/Reports.jsx';
import Settings from './components/Settings/Settings.jsx';
import Suppliers from './components/Suppliers/Suppliers.jsx';
import PurchaseOrders from './components/PurchaseOrders/PurchaseOrders.jsx';
import StockAdjustments from './components/StockAdjustments/StockAdjustments.jsx';
import Laybys from './components/Laybys/Laybys.jsx';
import CashManagement from './components/CashManagement/CashManagement.jsx';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<POSScreen />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/stock-adjustments" element={<StockAdjustments />} />
          <Route path="/laybys" element={<Laybys />} />
          <Route path="/cash-management" element={<CashManagement />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
