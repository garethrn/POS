import React, { useState, useEffect, useCallback } from 'react';

function getDateRange(period) {
  const now = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  if (period === 'today') { const s = fmt(now); return { startDate: s, endDate: s }; }
  if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return { startDate: fmt(d), endDate: fmt(now) }; }
  if (period === 'month') { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { startDate: fmt(d), endDate: fmt(now) }; }
  return { startDate: '', endDate: '' };
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bestsellersData, setBestsellersData] = useState(null);
  const [bestsellersLoading, setBestsellersLoading] = useState(false);

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    const range = period === 'custom' ? { startDate, endDate } : getDateRange(period);
    const filters = {};
    if (range.startDate) filters.startDate = `${range.startDate}T00:00:00.000Z`;
    if (range.endDate) filters.endDate = `${range.endDate}T23:59:59.999Z`;
    const [txns, prods] = await Promise.all([
      window.posAPI.transactions.getAll(filters),
      window.posAPI.products.getAll(),
    ]);
    setTransactions(txns || []);
    setProducts(prods || []);
    setLoading(false);
  }, [period, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const loadBestsellers = async () => {
    if (!window.posAPI) return;
    setBestsellersLoading(true);
    try {
      const txns = await window.posAPI.transactions.getAll({ limit: 100 });
      const productMap = {};
      for (const txn of txns || []) {
        try {
          const full = await window.posAPI.transactions.get(txn.id);
          for (const item of full?.items || []) {
            const key = item.product_id || item.product_name;
            if (!productMap[key]) {
              productMap[key] = { name: item.product_name, qty: 0, revenue: 0, cost: 0 };
            }
            productMap[key].qty += item.quantity || 0;
            productMap[key].revenue += item.total || 0;
            productMap[key].cost += (item.cost || 0) * (item.quantity || 0);
          }
        } catch { /* skip */ }
      }
      setBestsellersData(Object.values(productMap).sort((a, b) => b.qty - a.qty));
    } catch (e) {
      console.error(e);
    }
    setBestsellersLoading(false);
  };

  const totalSales = transactions.reduce((s, t) => s + (t.total || 0), 0);
  const numTransactions = transactions.length;
  const avgSale = numTransactions > 0 ? totalSales / numTransactions : 0;

  const dailyMap = {};
  for (const t of transactions) {
    const day = t.created_at ? t.created_at.split('T')[0] : 'Unknown';
    if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, count: 0 };
    dailyMap[day].sales += t.total || 0;
    dailyMap[day].count += 1;
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const maxSales = daily.reduce((m, d) => Math.max(m, d.sales), 0);

  const lowStockProducts = products.filter((p) => p.stock <= (p.reorder_point || 5));
  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  const TABS = [
    { key: 'sales', label: '📊 Sales' },
    { key: 'bestsellers', label: '🏆 Bestsellers' },
    { key: 'lowstock', label: '📦 Low Stock' },
    { key: 'profitability', label: '💰 Profitability' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 Reports</h1>
      </div>
      <div className="page-content">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >{t.label}</button>
          ))}
        </div>

        {/* ── Sales Tab ── */}
        {activeTab === 'sales' && (
          <>
            <div className="filter-bar" style={{ marginBottom: 20 }}>
              {['today', 'week', 'month', 'custom'].map((p) => (
                <button
                  key={p}
                  className={`btn ${period === p ? 'btn-primary' : 'btn-outline'} btn-sm`}
                  onClick={() => setPeriod(p)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
                </button>
              ))}
              {period === 'custom' && (
                <>
                  <input className="form-control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: 160 }} />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input className="form-control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: 160 }} />
                </>
              )}
            </div>

            {loading ? <div className="loading-state">Loading…</div> : (
              <>
                <div className="summary-cards">
                  <div className="summary-card card-primary">
                    <div className="summary-card-label">Total Sales</div>
                    <div className="summary-card-value">{fmt(totalSales)}</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-card-label">Transactions</div>
                    <div className="summary-card-value">{numTransactions}</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-card-label">Average Sale</div>
                    <div className="summary-card-value">{fmt(avgSale)}</div>
                  </div>
                  <div className="summary-card">
                    <div className="summary-card-label">Days Active</div>
                    <div className="summary-card-value">{daily.length}</div>
                  </div>
                </div>

                {daily.length > 0 && (
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, marginBottom: 20, boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 12 }}>Daily Sales</div>
                    <div className="bar-chart">
                      {daily.map((d) => (
                        <div key={d.date} className="bar-row">
                          <div className="bar-label">{d.date.slice(5)}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: maxSales > 0 ? `${(d.sales / maxSales) * 100}%` : '0%' }} />
                          </div>
                          <div className="bar-value">{fmt(d.sales)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr><th>Date</th><th>Transactions</th><th>Total Sales</th><th>Avg per Transaction</th></tr>
                    </thead>
                    <tbody>
                      {daily.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data for this period</td></tr>}
                      {daily.map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td>{d.count}</td>
                          <td>{fmt(d.sales)}</td>
                          <td>{fmt(d.count > 0 ? d.sales / d.count : 0)}</td>
                        </tr>
                      ))}
                      {daily.length > 0 && (
                        <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                          <td>Total</td><td>{numTransactions}</td><td>{fmt(totalSales)}</td><td>{fmt(avgSale)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Bestsellers Tab ── */}
        {activeTab === 'bestsellers' && (
          <>
            {!bestsellersData ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 20 }}>
                  Load transaction data to see your top-selling products
                </div>
                <button
                  className="btn btn-primary"
                  onClick={loadBestsellers}
                  disabled={bestsellersLoading}
                >
                  {bestsellersLoading ? 'Loading…' : '📊 Load Bestsellers Data'}
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Based on last 100 transactions</span>
                  <button className="btn btn-outline btn-sm" onClick={loadBestsellers} disabled={bestsellersLoading}>🔄 Refresh</button>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr><th>Rank</th><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Avg Price</th></tr>
                    </thead>
                    <tbody>
                      {bestsellersData.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data</td></tr>}
                      {bestsellersData.slice(0, 20).map((p, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{ fontWeight: 700, color: i === 0 ? '#f57f17' : i === 1 ? '#607d8b' : i === 2 ? '#8d6e63' : 'inherit' }}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                            </span>
                          </td>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.qty}</td>
                          <td>{fmt(p.revenue)}</td>
                          <td>{p.qty > 0 ? fmt(p.revenue / p.qty) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Low Stock Tab ── */}
        {activeTab === 'lowstock' && (
          <>
            <div className="summary-cards" style={{ marginBottom: 20 }}>
              <div className="summary-card card-warning">
                <div className="summary-card-label">Low Stock Items</div>
                <div className="summary-card-value">{lowStockProducts.filter((p) => p.stock > 0).length}</div>
              </div>
              <div className="summary-card" style={{ background: '#ffebee', border: '1px solid #ef9a9a' }}>
                <div className="summary-card-label" style={{ color: '#c62828' }}>Out of Stock</div>
                <div className="summary-card-value" style={{ color: '#c62828' }}>{products.filter((p) => p.stock <= 0).length}</div>
              </div>
              <div className="summary-card">
                <div className="summary-card-label">Total Products</div>
                <div className="summary-card-value">{products.length}</div>
              </div>
            </div>

            {loading ? <div className="loading-state">Loading…</div> : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th><th>Reorder At</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--success)' }}>✅ All products are well stocked!</td></tr>}
                    {lowStockProducts.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.sku || '—'}</td>
                        <td>{p.category_name || '—'}</td>
                        <td style={{ fontWeight: 700, color: p.stock <= 0 ? 'var(--danger)' : 'var(--warning)' }}>{p.stock}</td>
                        <td>{p.reorder_point || 5}</td>
                        <td>
                          {p.stock <= 0
                            ? <span className="badge badge-danger">❌ Out of Stock</span>
                            : <span className="badge badge-warning">⚠️ Low Stock</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Profitability Tab ── */}
        {activeTab === 'profitability' && (
          <>
            {loading ? <div className="loading-state">Loading…</div> : (
              <>
                <div className="summary-cards" style={{ marginBottom: 20 }}>
                  <div className="summary-card">
                    <div className="summary-card-label">Products Tracked</div>
                    <div className="summary-card-value">{products.length}</div>
                  </div>
                  <div className="summary-card card-success">
                    <div className="summary-card-label">Avg Margin</div>
                    <div className="summary-card-value">
                      {products.length > 0
                        ? `${(products.reduce((s, p) => s + (p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0), 0) / products.length).toFixed(1)}%`
                        : '—'
                      }
                    </div>
                  </div>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr><th>Product</th><th>Category</th><th>Sell Price</th><th>Cost</th><th>Gross Profit</th><th>Margin %</th></tr>
                    </thead>
                    <tbody>
                      {products.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products</td></tr>}
                      {products
                        .slice()
                        .sort((a, b) => {
                          const marginA = a.price > 0 ? ((a.price - a.cost) / a.price) * 100 : 0;
                          const marginB = b.price > 0 ? ((b.price - b.cost) / b.price) * 100 : 0;
                          return marginB - marginA;
                        })
                        .map((p) => {
                          const profit = (p.price || 0) - (p.cost || 0);
                          const margin = p.price > 0 ? (profit / p.price) * 100 : 0;
                          return (
                            <tr key={p.id}>
                              <td><strong>{p.name}</strong></td>
                              <td>{p.category_name || '—'}</td>
                              <td>{fmt(p.price)}</td>
                              <td>{fmt(p.cost)}</td>
                              <td style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{fmt(profit)}</td>
                              <td>
                                <span className={`badge ${margin >= 30 ? 'badge-success' : margin >= 10 ? 'badge-warning' : 'badge-danger'}`}>
                                  {margin.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
