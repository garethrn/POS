import React, { useState, useEffect, useCallback } from 'react';

function CustomerModal({ customer, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', loyalty_points: 0, is_active: true,
    ...customer,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Customer name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await window.posAPI.customers.save({
        ...form,
        loyalty_points: parseInt(form.loyalty_points, 10) || 0,
        is_active: form.is_active ? 1 : 0,
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{customer?.id ? 'Edit Customer' : 'Add Customer'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-control" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea className="form-control" rows={2} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Loyalty Points</label>
            <input className="form-control" type="number" min={0} value={form.loyalty_points || 0} onChange={(e) => set('loyalty_points', e.target.value)} />
          </div>
          <div className="form-check">
            <input type="checkbox" id="cust_active" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="cust_active">Active</label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [editCustomer, setEditCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    const custs = await window.posAPI.customers.getAll();
    setCustomers(custs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditCustomer(null); setShowModal(true); };
  const openEdit = (c) => { setEditCustomer(c); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    setError('');
    try {
      await window.posAPI.customers.delete(id);
      load();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👥 Customers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="toolbar">
          <input
            className="form-control search-input"
            placeholder="🔍 Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} customers</span>
        </div>
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Loyalty Pts</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No customers found</td></tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</td>
                    <td>{c.loyalty_points || 0}</td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} style={{ marginRight: 6 }}>✏️ Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CustomerModal
          customer={editCustomer}
          onSave={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
