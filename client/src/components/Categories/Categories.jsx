import React, { useState, useEffect, useCallback } from 'react';

const PRESET_COLORS = [
  '#0d6efd', '#198754', '#dc3545', '#ffc107', '#0dcaf0',
  '#6f42c1', '#fd7e14', '#20c997', '#6c757d', '#343a40',
];

function CategoryModal({ category, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', color: '#6c757d', is_active: true,
    ...category,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Category name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await window.posAPI.categories.save({ ...form, is_active: form.is_active ? 1 : 0 });
      onSave();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{category?.id ? 'Edit Category' : 'Add Category'}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label>Name *</label>
            <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  style={{
                    width: 28, height: 28, borderRadius: 4, background: c, cursor: 'pointer',
                    border: form.color === c ? '3px solid #000' : '1px solid transparent',
                  }}
                />
              ))}
            </div>
            <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </div>
          <div className="form-check">
            <input type="checkbox" id="cat_active" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="cat_active">Active</label>
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

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [editCat, setEditCat] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    const cats = await window.posAPI.categories.getAll();
    setCategories(cats || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditCat(null); setShowModal(true); };
  const openEdit = (c) => { setEditCat(c); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    setError('');
    try {
      await window.posAPI.categories.delete(id);
      load();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">🏷️ Categories</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Category</button>
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
                  <th>Color</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No categories yet</td></tr>
                )}
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="color-swatch" style={{ background: c.color }} />
                      {c.color}
                    </td>
                    <td><strong>{c.name}</strong></td>
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
        <CategoryModal
          category={editCat}
          onSave={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
