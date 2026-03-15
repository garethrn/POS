import React, { useState, useEffect, useCallback } from 'react';

function CloseShiftModal({ shift, onClose, onConfirm }) {
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await onConfirm({ closing_cash: parseFloat(closingCash) || 0, notes });
    } catch (e) {
      setError(e.message || 'Failed to close shift');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🔒 Close Shift</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="alert alert-info" style={{ marginBottom: 14 }}>
            Opening Cash: <strong>{fmt(shift.opening_cash || 0)}</strong>
          </div>
          <div className="form-group">
            <label>Closing Cash Count *</label>
            <input
              className="form-control"
              type="number"
              min={0}
              step="0.01"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              autoFocus
              placeholder="Enter cash in drawer"
            />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Closing…' : '🔒 Close Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CashManagement() {
  const [currentShift, setCurrentShift] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    try {
      const [shift, allShifts] = await Promise.all([
        window.posAPI?.shifts?.getCurrent?.() || Promise.resolve(null),
        window.posAPI?.shifts?.getAll?.() || Promise.resolve([]),
      ]);
      setCurrentShift(shift || null);
      setShifts(allShifts || []);
    } catch (e) {
      setError(e.message || 'Failed to load shifts');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpenShift = async () => {
    if (!openingCash && openingCash !== '0') { setError('Enter opening cash amount'); return; }
    setOpening(true);
    setError('');
    try {
      await window.posAPI?.shifts?.open?.({
        opening_cash: parseFloat(openingCash) || 0,
        cashier_name: cashierName || 'Cashier',
      });
      setOpeningCash('');
      setCashierName('');
      load();
    } catch (e) {
      setError(e.message || 'Failed to open shift');
    } finally {
      setOpening(false);
    }
  };

  const handleCloseShift = async ({ closing_cash, notes }) => {
    await window.posAPI?.shifts?.close?.({ id: currentShift.id, closing_cash, notes });
    setShowClose(false);
    load();
  };

  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  const statusBadge = (status) => status === 'open' ? 'badge-success' : 'badge-secondary';

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">💰 Cash Management</h1>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* Open / Active Shift */}
        {!currentShift ? (
          <div className="shift-card" style={{ maxWidth: 480 }}>
            <div className="shift-card-title">🟢 Open New Shift</div>
            <div className="form-group">
              <label>Cashier Name</label>
              <input
                className="form-control"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Enter cashier name"
              />
            </div>
            <div className="form-group">
              <label>Opening Cash Amount *</label>
              <input
                className="form-control"
                type="number"
                min={0}
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button className="btn btn-success btn-lg btn-block" onClick={handleOpenShift} disabled={opening}>
              {opening ? 'Opening…' : '🟢 Open Shift'}
            </button>
          </div>
        ) : (
          <div className="shift-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div className="shift-card-title" style={{ marginBottom: 0 }}>
                🟢 Current Shift
                <span className="badge badge-success" style={{ marginLeft: 10 }}>Open</span>
              </div>
              <button className="btn btn-danger" onClick={() => setShowClose(true)}>🔒 Close Shift</button>
            </div>
            <div className="shift-stat">
              <span className="shift-stat-label">Cashier</span>
              <span className="shift-stat-value">{currentShift.cashier_name || 'Cashier'}</span>
            </div>
            <div className="shift-stat">
              <span className="shift-stat-label">Opened At</span>
              <span className="shift-stat-value">{new Date(currentShift.opened_at).toLocaleString()}</span>
            </div>
            <div className="shift-stat">
              <span className="shift-stat-label">Opening Cash</span>
              <span className="shift-stat-value">{fmt(currentShift.opening_cash || 0)}</span>
            </div>
            <div className="shift-stat">
              <span className="shift-stat-label">Total Sales</span>
              <span className="shift-stat-value">{fmt(currentShift.total_sales || 0)}</span>
            </div>
            <div className="shift-stat">
              <span className="shift-stat-label">Transactions</span>
              <span className="shift-stat-value">{currentShift.transaction_count || 0}</span>
            </div>
          </div>
        )}

        {/* Shift History */}
        {shifts.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, marginTop: 8 }}>Shift History</h2>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cashier</th>
                    <th>Opened</th>
                    <th>Closed</th>
                    <th>Opening Cash</th>
                    <th>Closing Cash</th>
                    <th>Expected Cash</th>
                    <th>Difference</th>
                    <th>Total Sales</th>
                    <th>Txns</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id}>
                      <td>{s.cashier_name || '—'}</td>
                      <td>{new Date(s.opened_at).toLocaleString()}</td>
                      <td>{s.closed_at ? new Date(s.closed_at).toLocaleString() : '—'}</td>
                      <td>{fmt(s.opening_cash || 0)}</td>
                      <td>{s.closing_cash != null ? fmt(s.closing_cash) : '—'}</td>
                      <td>{s.expected_cash != null ? fmt(s.expected_cash) : '—'}</td>
                      <td style={{ color: (s.cash_difference || 0) < 0 ? 'var(--danger)' : (s.cash_difference || 0) > 0 ? 'var(--success)' : 'inherit', fontWeight: 700 }}>
                        {s.cash_difference != null ? fmt(s.cash_difference) : '—'}
                      </td>
                      <td>{fmt(s.total_sales || 0)}</td>
                      <td>{s.transaction_count || 0}</td>
                      <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showClose && currentShift && (
        <CloseShiftModal
          shift={currentShift}
          onClose={() => setShowClose(false)}
          onConfirm={handleCloseShift}
        />
      )}
    </div>
  );
}
