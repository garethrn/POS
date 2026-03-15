import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar.jsx';

export default function Layout({ children }) {
  const [storeName, setStoreName] = useState('POS');
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (window.posAPI) {
      window.posAPI.settings.get().then((s) => {
        if (s && s.store_name) setStoreName(s.store_name);
      });
    }

    const checkStatus = () => {
      if (window.posAPI) {
        window.posAPI.sync.checkOnline().then(setOnline).catch(() => setOnline(false));
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar storeName={storeName} online={online} />
      <div className="content">{children}</div>
    </div>
  );
}
