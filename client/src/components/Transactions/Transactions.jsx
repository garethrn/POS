import React, { useState, useEffect, useCallback } from 'react';

function TransactionDetailModal({ id, onClose }) {
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.posAPI) return;
    window.posAPI.transactions.get(id).then((t) => {
      setTxn(t);
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body"><div className="loading-state">Loading…</div></div>
      </div>
    </div>
  );

  if (!txn) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🧾 Receipt #{txn.receipt_number}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date</div>
              <div>{new Date(txn.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Customer</div>
              <div>{txn.customer_name || 'Walk-in'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Payment</div>
              <div style={{ textTransform: 'capitalize' }}>{txn.payment_method}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</div>
              <span className="badge badge-success">{txn.status}</span>
            </div>
          </div>

          <div className="section-heading" style={{ marginTop: 16 }}>Items</div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(txn.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.product_sku || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>${Number(item.unit_price).toFixed(2)}</td>
                    <td>${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div className="cart-total-row" style={{ width: 240, display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span><span>${Number(txn.subtotal).toFixed(2)}</span>
            </div>
            {txn.discount > 0 && (
              <div className="cart-total-row" style={{ width: 240, display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount</span><span>- ${Number(txn.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="cart-total-row" style={{ width: 240, display: 'flex', justifyContent: 'space-between' }}>
              <span>Tax</span><span>${Number(txn.tax).toFixed(2)}</span>
            </div>
            <div className="cart-total-row grand-total" style={{ width: 240, display: 'flex', justifyContent: 'space-between' }}>
              <span>Total</span><span>${Number(txn.total).toFixed(2)}</span>
            </div>
            {txn.change_due > 0 && (
              <div style={{ width: 240, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                <span>Change</span><span>${Number(txn.change_due).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    const filters = {};
    if (startDate) filters.startDate = `${startDate}T00:00:00.000Z`;
    if (endDate) filters.endDate = `${endDate}T23:59:59.999Z`;
    const txns = await window.posAPI.transactions.getAll(filters);
    setTransactions(txns || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🧾 Transactions</h1>
      </div>
      <div className="page-content">
        <div className="filter-bar">
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, marginBottom: 2, display: 'block' }}>From</label>
            <input
              className="form-control"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, marginBottom: 2, display: 'block' }}>To</label>
            <input
              className="form-control"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setStartDate(''); setEndDate(''); }}>
            Clear
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setStartDate(todayISO()); setEndDate(todayISO()); }}>
            Today
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{transactions.length} transactions</span>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Synced</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found</td></tr>
                )}
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="clickable"
                    onClick={() => setSelectedId(t.id)}
                  >
                    <td><strong>{t.receipt_number}</strong></td>
                    <td>{new Date(t.created_at).toLocaleString()}</td>
                    <td>{t.customer_name || 'Walk-in'}</td>
                    <td>${Number(t.total).toFixed(2)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.payment_method}</td>
                    <td><span className="badge badge-success">{t.status}</span></td>
                    <td>
                      <span
                        className={`sync-dot ${t.synced ? 'synced' : t.sync_error ? 'error' : 'unsynced'}`}
                        title={t.synced ? 'Synced' : t.sync_error || 'Not synced'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <TransactionDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
