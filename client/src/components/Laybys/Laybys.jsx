import React, { useState, useEffect, useCallback } from 'react';

function ViewLaybyModal({ layby, onDeposit, onComplete, onCancel, onClose }) {
  const fmt = (v) => `$${Number(v).toFixed(2)}`;
  const statusBadge = { active: 'badge-primary', completed: 'badge-success', cancelled: 'badge-secondary' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">⏸ {layby.layby_number}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><strong>Customer:</strong> {layby.customer_name || 'Walk-in'}</div>
            <div><strong>Status:</strong> <span className={`badge ${statusBadge[layby.status] || 'badge-secondary'}`}>{layby.status}</span></div>
            <div><strong>Total:</strong> {fmt(layby.total)}</div>
            <div><strong>Deposit Paid:</strong> {fmt(layby.deposit)}</div>
            <div><strong>Balance Due:</strong> <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt(layby.balance_due)}</span></div>
            <div><strong>Created:</strong> {new Date(layby.created_at).toLocaleDateString()}</div>
          </div>

          <div style={{ fontWeight: 700, marginBottom: 8 }}>Items</div>
          <div className="table-wrapper" style={{ marginBottom: 12 }}>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                {(layby.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{fmt(item.unit_price)}</td>
                    <td>{fmt(item.total)}</td>
                  </tr>
                ))}
                {(!layby.items || layby.items.length === 0) && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No items</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          {layby.status === 'active' && (
            <>
              <button className="btn btn-danger btn-sm" onClick={onCancel}>✕ Cancel Layby</button>
              <button className="btn btn-outline" onClick={onDeposit}>💰 Add Deposit</button>
              <button className="btn btn-success" onClick={onComplete}>✅ Complete</button>
            </>
          )}
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DepositModal({ layby, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (amt > layby.balance_due) { setError('Amount exceeds balance due'); return; }
    setSaving(true);
    setError('');
    try {
      await window.posAPI?.laybys?.deposit?.({ id: layby.id, amount: amt, payment_method: paymentMethod });
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to add deposit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">💰 Add Deposit</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            Balance Due: <strong>{fmt(layby.balance_due)}</strong>
          </div>
          <div className="form-group">
            <label>Deposit Amount *</label>
            <input
              className="form-control"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card</option>
              <option value="eft">🏦 EFT</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Add Deposit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ layby, onSave, onClose }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  const handleComplete = async () => {
    setSaving(true);
    setError('');
    try {
      await window.posAPI?.laybys?.complete?.({ id: layby.id, payment_method: paymentMethod });
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to complete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">✅ Complete Layby</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            Balance Due: <strong>{fmt(layby.balance_due)}</strong>
          </div>
          <div className="form-group">
            <label>Payment Method for Remaining Balance</label>
            <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">💵 Cash</option>
              <option value="card">💳 Card</option>
              <option value="eft">🏦 EFT</option>
              <option value="account">📋 Account</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" onClick={handleComplete} disabled={saving}>
            {saving ? 'Completing…' : `✅ Complete & Charge ${fmt(layby.balance_due)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Laybys() {
  const [laybys, setLaybys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewLayby, setViewLayby] = useState(null);
  const [depositLayby, setDepositLayby] = useState(null);
  const [completeLayby, setCompleteLayby] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await window.posAPI?.laybys?.getAll?.(filters) || [];
      setLaybys(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleView = async (layby) => {
    try {
      const full = await window.posAPI?.laybys?.get?.(layby.id);
      setViewLayby(full || layby);
    } catch {
      setViewLayby(layby);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this layby?')) return;
    try {
      await window.posAPI?.laybys?.cancel?.(id);
      setViewLayby(null);
      load();
    } catch (e) {
      alert('Failed to cancel: ' + (e.message || e));
    }
  };

  const fmt = (v) => `$${Number(v).toFixed(2)}`;
  const statusBadge = { active: 'badge-primary', completed: 'badge-success', cancelled: 'badge-secondary' };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⏸ Laybys</h1>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          {['active', 'completed', 'cancelled', 'all'].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setStatusFilter(s)}
              style={{ textTransform: 'capitalize' }}
            >{s === 'all' ? 'All' : s}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Layby #</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Deposit</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {laybys.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No laybys found</td></tr>
                )}
                {laybys.map((lb) => (
                  <tr key={lb.id}>
                    <td><strong>{lb.layby_number}</strong></td>
                    <td>{lb.customer_name || 'Walk-in'}</td>
                    <td>{fmt(lb.total)}</td>
                    <td>{fmt(lb.deposit)}</td>
                    <td style={{ color: lb.balance_due > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{fmt(lb.balance_due)}</td>
                    <td><span className={`badge ${statusBadge[lb.status] || 'badge-secondary'}`}>{lb.status}</span></td>
                    <td>{new Date(lb.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => handleView(lb)}>👁 View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewLayby && (
        <ViewLaybyModal
          layby={viewLayby}
          onDeposit={() => { setDepositLayby(viewLayby); setViewLayby(null); }}
          onComplete={() => { setCompleteLayby(viewLayby); setViewLayby(null); }}
          onCancel={() => handleCancel(viewLayby.id)}
          onClose={() => setViewLayby(null)}
        />
      )}

      {depositLayby && (
        <DepositModal
          layby={depositLayby}
          onSave={() => { setDepositLayby(null); load(); }}
          onClose={() => setDepositLayby(null)}
        />
      )}

      {completeLayby && (
        <CompleteModal
          layby={completeLayby}
          onSave={() => { setCompleteLayby(null); load(); }}
          onClose={() => setCompleteLayby(null)}
        />
      )}
    </div>
  );
}
