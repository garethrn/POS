import React, { useState, useEffect, useCallback } from 'react';

function SupplierModal({ supplier, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', contact: '', phone: '', email: '', address: '', account_no: '', is_active: true,
    ...supplier,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await window.posAPI?.suppliers?.save?.({ ...form, is_active: form.is_active ? 1 : 0 });
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{supplier?.id ? 'Edit Supplier' : 'Add Supplier'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label>Name *</label>
            <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contact Person</label>
              <input className="form-control" value={form.contact || ''} onChange={(e) => set('contact', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-control" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Account No.</label>
              <input className="form-control" value={form.account_no || ''} onChange={(e) => set('account_no', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea className="form-control" rows={2} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="form-check">
            <input type="checkbox" id="supp_active" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="supp_active">Active</label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [editSupplier, setEditSupplier] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    try {
      const data = await window.posAPI?.suppliers?.getAll?.();
      setSuppliers(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load suppliers');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditSupplier(null); setShowModal(true); };
  const openEdit = (s) => { setEditSupplier(s); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    setError('');
    try {
      await window.posAPI?.suppliers?.delete?.(id);
      load();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const filtered = suppliers.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact && s.contact.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🚚 Suppliers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="toolbar">
          <input
            className="form-control search-input"
            placeholder="🔍 Search suppliers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} suppliers</span>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Account No.</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No suppliers found</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contact || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.account_no || '—'}</td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)} style={{ marginRight: 6 }}>✏️ Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <SupplierModal
          supplier={editSupplier}
          onSave={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
