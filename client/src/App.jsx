import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Login from './components/Login/Login.jsx';

// ── Auth guard for web mode ────────────────────────────────────────────────
// In Electron, window.__webMode is never set and the Login route is unused.
function ProtectedApp() {
  const [authed, setAuthed] = useState(() => {
    // In Electron posAPI is synchronous — skip the guard entirely.
    if (!window.__webMode) return true;
    // In browser, check for a stored JWT.
    const { isLoggedIn } = window.__webApiModule || {};
    if (isLoggedIn) return isLoggedIn();
    return !!localStorage.getItem('pos_token');
  });

  useEffect(() => {
    if (!window.__webMode) return;

    const handleExpired = () => setAuthed(false);
    const handleLogout  = () => setAuthed(false);
    const handleLogin   = () => setAuthed(true);

    window.addEventListener('pos:sessionExpired', handleExpired);
    window.addEventListener('pos:logout',         handleLogout);
    window.addEventListener('pos:login',          handleLogin);

    // Re-check whenever the hash route changes (handles back-navigation after logout)
    const handleHash = () => setAuthed(!!localStorage.getItem('pos_token'));
    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('pos:sessionExpired', handleExpired);
      window.removeEventListener('pos:logout',         handleLogout);
      window.removeEventListener('pos:login',          handleLogin);
      window.removeEventListener('hashchange',         handleHash);
    };
  }, []);

  if (window.__webMode && !authed) {
    return <Navigate to="/login" replace />;
  }

  return (
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
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Login route is only active in web mode; in Electron it's never reached */}
        <Route path="/login" element={<Login />} />
        {/* All other routes go through the sidebar Layout */}
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </HashRouter>
  );
}

