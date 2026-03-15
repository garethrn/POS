import React, { useState, useEffect, useCallback } from 'react';

function AddPOModal({ suppliers, products, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((prev) => [...prev, { product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0 }]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'product_id') {
        const p = products.find((pr) => pr.id === val);
        if (p) { next[idx].product_name = p.name; next[idx].unit_cost = p.cost || 0; }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!supplierId) { setError('Please select a supplier'); return; }
    if (items.some((i) => !i.product_name || i.quantity_ordered <= 0)) {
      setError('All line items must have a product and quantity');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await window.posAPI?.purchaseOrders?.save?.({
        po: { supplier_id: supplierId, notes },
        items: items.map((i) => ({
          ...i,
          quantity_ordered: parseInt(i.quantity_ordered, 10) || 1,
          unit_cost: parseFloat(i.unit_cost) || 0,
        })),
      });
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📋 New Purchase Order</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Supplier *</label>
              <select className="form-control" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Select Supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 8 }}>Line Items</div>
          <div className="table-wrapper" style={{ marginBottom: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        className="form-control"
                        value={item.product_id}
                        onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                        style={{ minWidth: 180 }}
                      >
                        <option value="">— Select Product —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control"
                        type="number"
                        min={1}
                        value={item.quantity_ordered}
                        onChange={(e) => updateItem(idx, 'quantity_ordered', e.target.value)}
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>${((parseFloat(item.unit_cost) || 0) * (parseInt(item.quantity_ordered) || 0)).toFixed(2)}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => removeItem(idx)} disabled={items.length === 1}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-outline btn-sm" onClick={addItem}>+ Add Line Item</button>
          <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700, fontSize: 16 }}>
            Total: ${items.reduce((s, i) => s + (parseFloat(i.unit_cost) || 0) * (parseInt(i.quantity_ordered) || 0), 0).toFixed(2)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewPOModal({ po, onReceive, onClose }) {
  const [receiving, setReceiving] = useState(false);

  const handleReceive = async () => {
    setReceiving(true);
    try {
      await window.posAPI?.purchaseOrders?.receive?.(po.id);
      onReceive();
    } catch (e) {
      alert('Failed to receive: ' + (e.message || e));
    } finally {
      setReceiving(false);
    }
  };

  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📋 {po.po_number}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><strong>Supplier:</strong> {po.supplier_name || '—'}</div>
            <div><strong>Status:</strong> <span className={`badge ${po.status === 'received' ? 'badge-success' : 'badge-warning'}`}>{po.status}</span></div>
            <div><strong>Date:</strong> {new Date(po.created_at).toLocaleDateString()}</div>
            <div><strong>Total:</strong> {fmt(po.total)}</div>
          </div>
          {po.notes && <div className="alert alert-info" style={{ marginBottom: 12 }}>{po.notes}</div>}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Ordered</th><th>Received</th><th>Unit Cost</th><th>Total</th></tr>
              </thead>
              <tbody>
                {(po.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity_ordered}</td>
                    <td>{item.quantity_received}</td>
                    <td>{fmt(item.unit_cost)}</td>
                    <td>{fmt(item.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {po.status === 'pending' && (
            <button className="btn btn-success" onClick={handleReceive} disabled={receiving}>
              {receiving ? 'Receiving…' : '✅ Receive Stock'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewPO, setViewPO] = useState(null);

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    try {
      const [pos, supps, prods] = await Promise.all([
        window.posAPI?.purchaseOrders?.getAll?.() || Promise.resolve([]),
        window.posAPI?.suppliers?.getAll?.() || Promise.resolve([]),
        window.posAPI.products.getAll(),
      ]);
      setOrders(pos || []);
      setSuppliers(supps || []);
      setProducts(prods || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleView = async (po) => {
    try {
      const full = await window.posAPI?.purchaseOrders?.get?.(po.id);
      setViewPO(full || po);
    } catch {
      setViewPO(po);
    }
  };

  const statusBadge = (status) => {
    if (status === 'received') return 'badge-success';
    if (status === 'cancelled') return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📋 Purchase Orders</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New PO</button>
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
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No purchase orders yet</td></tr>
                )}
                {orders.map((po) => (
                  <tr key={po.id}>
                    <td><strong>{po.po_number}</strong></td>
                    <td>{po.supplier_name || '—'}</td>
                    <td>{new Date(po.created_at).toLocaleDateString()}</td>
                    <td>${Number(po.total).toFixed(2)}</td>
                    <td><span className={`badge ${statusBadge(po.status)}`}>{po.status}</span></td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => handleView(po)}>👁 View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddPOModal
          suppliers={suppliers}
          products={products}
          onSave={() => { setShowAdd(false); load(); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {viewPO && (
        <ViewPOModal
          po={viewPO}
          onReceive={() => { setViewPO(null); load(); }}
          onClose={() => setViewPO(null)}
        />
      )}
    </div>
  );
}
