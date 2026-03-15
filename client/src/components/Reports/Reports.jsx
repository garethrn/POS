import React, { useState, useEffect, useCallback } from 'react';

function getDateRange(period) {
  const now = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];

  if (period === 'today') {
    const s = fmt(now);
    return { startDate: s, endDate: s };
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return { startDate: fmt(d), endDate: fmt(now) };
  }
  if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: fmt(d), endDate: fmt(now) };
  }
  return { startDate: '', endDate: '' };
}

export default function Reports() {
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    const range = period === 'custom' ? { startDate, endDate } : getDateRange(period);
    const filters = {};
    if (range.startDate) filters.startDate = `${range.startDate}T00:00:00.000Z`;
    if (range.endDate) filters.endDate = `${range.endDate}T23:59:59.999Z`;
    const txns = await window.posAPI.transactions.getAll(filters);
    setTransactions(txns || []);
    setLoading(false);
  }, [period, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const totalSales = transactions.reduce((s, t) => s + (t.total || 0), 0);
  const numTransactions = transactions.length;
  const avgSale = numTransactions > 0 ? totalSales / numTransactions : 0;

  // Daily breakdown
  const dailyMap = {};
  for (const t of transactions) {
    const day = t.created_at ? t.created_at.split('T')[0] : 'Unknown';
    if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, count: 0 };
    dailyMap[day].sales += t.total || 0;
    dailyMap[day].count += 1;
  }
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const maxSales = daily.reduce((m, d) => Math.max(m, d.sales), 0);

  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 Reports</h1>
      </div>
      <div className="page-content">
        {/* Period selector */}
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
              <input
                className="form-control"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: 160 }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                className="form-control"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: 160 }}
              />
            </>
          )}
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="summary-cards">
              <div className="summary-card">
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

            {/* Bar chart */}
            {daily.length > 0 && (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, marginBottom: 20, boxShadow: 'var(--shadow)' }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Daily Sales</div>
                <div className="bar-chart">
                  {daily.map((d) => (
                    <div key={d.date} className="bar-row">
                      <div className="bar-label">{d.date.slice(5)}</div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: maxSales > 0 ? `${(d.sales / maxSales) * 100}%` : '0%' }}
                        />
                      </div>
                      <div className="bar-value">{fmt(d.sales)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily table */}
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transactions</th>
                    <th>Total Sales</th>
                    <th>Avg per Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data for this period</td></tr>
                  )}
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
                      <td>Total</td>
                      <td>{numTransactions}</td>
                      <td>{fmt(totalSales)}</td>
                      <td>{fmt(avgSale)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
