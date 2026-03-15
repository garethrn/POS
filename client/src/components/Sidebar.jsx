import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'POS', icon: '🛒', end: true },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/categories', label: 'Categories', icon: '🏷️' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/transactions', label: 'Transactions', icon: '🧾' },
  { to: '/reports', label: 'Reports', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ storeName, online }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">⚡ POS</div>
        <div className="sidebar-store">{storeName}</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
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
      </nav>

      <div className="sidebar-footer">
        <span className={`status-indicator ${online ? 'online' : 'offline'}`} />
        <span className="status-text">{online ? 'Online' : 'Offline'}</span>
      </div>
    </aside>
  );
}
