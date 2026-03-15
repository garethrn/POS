import React, { useState, useEffect, useCallback } from 'react';

const REASONS = [
  { value: 'damage', label: 'Damage' },
  { value: 'theft', label: 'Theft' },
  { value: 'correction', label: 'Correction' },
  { value: 'write_off', label: 'Write Off' },
  { value: 'recount', label: 'Recount' },
  { value: 'other', label: 'Other' },
];

function AdjustmentModal({ products, onSave, onClose }) {
  const [form, setForm] = useState({ product_id: '', quantity: '', reason: 'correction', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.product_id) { setError('Please select a product'); return; }
    if (!form.quantity || form.quantity === '0') { setError('Quantity cannot be zero'); return; }
    if (!form.reason) { setError('Please select a reason'); return; }
    setSaving(true);
    setError('');
    try {
      await window.posAPI?.stockAdjustments?.save?.({
        product_id: form.product_id,
        quantity: parseInt(form.quantity, 10),
        reason: form.reason,
        notes: form.notes || null,
      });
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const qty = parseInt(form.quantity, 10) || 0;
  const selectedProduct = products.find((p) => p.id === form.product_id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🔧 Stock Adjustment</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label>Product *</label>
            <select className="form-control" value={form.product_id} onChange={(e) => set('product_id', e.target.value)}>
              <option value="">— Select Product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Quantity Change *</label>
              <input
                className="form-control"
                type="number"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="e.g. -5 or +10"
              />
              {selectedProduct && qty !== 0 && (
                <div style={{ fontSize: 12, marginTop: 4, color: qty > 0 ? '#2e7d32' : '#c62828' }}>
                  New stock: {Math.max(0, (selectedProduct.stock || 0) + qty)}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Reason *</label>
              <select className="form-control" value={form.reason} onChange={(e) => set('reason', e.target.value)}>
                {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StockAdjustments() {
  const [adjustments, setAdjustments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    try {
      const [adjs, prods] = await Promise.all([
        window.posAPI?.stockAdjustments?.getAll?.({ limit: 200 }) || Promise.resolve([]),
        window.posAPI.products.getAll(),
      ]);
      setAdjustments(adjs || []);
      setProducts(prods || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reasonLabel = (r) => REASONS.find((x) => x.value === r)?.label || r;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🔧 Stock Adjustments</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Adjustment</button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Qty Change</th>
                  <th>Reason</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No adjustments recorded</td></tr>
                )}
                {adjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td>{new Date(adj.created_at).toLocaleDateString()}</td>
                    <td>{adj.product_name || '—'}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: adj.quantity > 0 ? '#2e7d32' : '#c62828',
                      }}>
                        {adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity}
                      </span>
                    </td>
                    <td><span className="badge badge-secondary">{reasonLabel(adj.reason)}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{adj.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AdjustmentModal
          products={products}
          onSave={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
