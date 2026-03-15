import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV_SECTIONS = [
  {
    label: 'Sales',
    items: [
      { to: '/', label: 'POS', icon: '🛒', end: true },
      { to: '/laybys', label: 'Laybys', icon: '⏸' },
      { to: '/transactions', label: 'Transactions', icon: '🧾' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: '📦' },
      { to: '/categories', label: 'Categories', icon: '🏷️' },
      { to: '/suppliers', label: 'Suppliers', icon: '🚚' },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: '📋' },
      { to: '/stock-adjustments', label: 'Stock Adjustments', icon: '🔧' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/cash-management', label: 'Cash Management', icon: '💰' },
      { to: '/customers', label: 'Customers', icon: '👥' },
      { to: '/reports', label: 'Reports', icon: '📊' },
      { to: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar({ storeName, online }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Only active in web mode; logoutUser clears the token and dispatches pos:logout
    import('../web-api.js').then(({ logoutUser }) => {
      logoutUser();
      navigate('/login', { replace: true });
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">⚡ POS</div>
        <div className="sidebar-store">{storeName}</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className={`status-indicator ${online ? 'online' : 'offline'}`} />
        <span className="status-text" style={{ flex: 1 }}>{online ? 'Online' : 'Offline'}</span>
        {/* Show logout button in web mode only */}
        {window.__webMode && (
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Sign out">
            ↩
          </button>
        )}
      </div>
    </aside>
  );
}

