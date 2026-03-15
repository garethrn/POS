import React, { useState, useEffect, useCallback } from 'react';

function ProductModal({ product, categories, suppliers, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', category_id: '',
    price: '', cost: '', stock: '', description: '', is_active: true,
    supplier_id: '', min_stock: '', max_stock: '', reorder_point: '',
    ...product,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Product name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await window.posAPI.products.save({
        ...form,
        price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0,
        stock: parseInt(form.stock, 10) || 0,
        min_stock: parseInt(form.min_stock, 10) || 0,
        max_stock: parseInt(form.max_stock, 10) || 0,
        reorder_point: parseInt(form.reorder_point, 10) || 5,
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
          <span className="modal-title">{product?.id ? 'Edit Product' : 'Add Product'}</span>
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
              <label>SKU</label>
              <input className="form-control" value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Barcode</label>
              <input className="form-control" value={form.barcode || ''} onChange={(e) => set('barcode', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category_id || ''} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Supplier</label>
            <select className="form-control" value={form.supplier_id || ''} onChange={(e) => set('supplier_id', e.target.value)}>
              <option value="">— None —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price</label>
              <input className="form-control" type="number" min={0} step="0.01" value={form.price || ''} onChange={(e) => set('price', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Cost</label>
              <input className="form-control" type="number" min={0} step="0.01" value={form.cost || ''} onChange={(e) => set('cost', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Stock</label>
              <input className="form-control" type="number" min={0} value={form.stock || ''} onChange={(e) => set('stock', e.target.value)} />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Min Stock</label>
              <input className="form-control" type="number" min={0} value={form.min_stock || ''} onChange={(e) => set('min_stock', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Max Stock</label>
              <input className="form-control" type="number" min={0} value={form.max_stock || ''} onChange={(e) => set('max_stock', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Reorder Point</label>
              <input className="form-control" type="number" min={0} value={form.reorder_point || ''} onChange={(e) => set('reorder_point', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-control" rows={3} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="form-check">
            <input type="checkbox" id="is_active" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="is_active">Active</label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    setLoading(true);
    const [prods, cats, supps] = await Promise.all([
      window.posAPI.products.getAll(),
      window.posAPI.categories.getAll(),
      window.posAPI?.suppliers?.getAll?.() || Promise.resolve([]),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setSuppliers(supps || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditProduct(null); setShowModal(true); };
  const openEdit = (p) => { setEditProduct(p); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    setError('');
    try {
      await window.posAPI.products.delete(id);
      load();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📦 Products</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="toolbar">
          <input
            className="form-control search-input"
            placeholder="🔍 Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} products</span>
        </div>

        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products found</td></tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.sku || '—'}</td>
                    <td>{p.category_name || '—'}</td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td>${Number(p.cost).toFixed(2)}</td>
                    <td>
                      <span style={{ color: p.stock <= 0 ? 'var(--danger)' : 'inherit' }}>
                        {p.stock}
                      </span>
                      {p.stock > 0 && p.stock <= (p.reorder_point || 5) && (
                        <span className="badge badge-warning" style={{ marginLeft: 6 }}>⚠️ Low</span>
                      )}
                      {p.stock <= 0 && (
                        <span className="badge badge-danger" style={{ marginLeft: 6 }}>Out</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)} style={{ marginRight: 6 }}>✏️ Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          suppliers={suppliers}
          onSave={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
