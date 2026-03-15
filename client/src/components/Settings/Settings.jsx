import React, { useState, useEffect, useCallback } from 'react';

export default function Settings() {
  const [form, setForm] = useState({
    store_name: '', store_phone: '', store_address: '',
    receipt_header: '', receipt_footer: '',
    tax_rate: '10', currency: 'USD',
    server_url: '', last_sync_time: '', auth_token: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.posAPI) return;
    const s = await window.posAPI.settings.get();
    if (s) setForm((f) => ({ ...f, ...s }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (field, val) => {
    setForm((f) => ({ ...f, [field]: val }));
    setSaved(false);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await window.posAPI.settings.save(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const online = await window.posAPI.sync.checkOnline();
      setTestResult(online ? { ok: true, msg: 'Connection successful!' } : { ok: false, msg: 'Server unreachable' });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.posAPI.sync.full();
      setSyncResult({ ok: true, msg: `Synced at ${new Date(result.syncedAt).toLocaleTimeString()}` });
      load();
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">⚙️ Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Settings'}
        </button>
      </div>
      <div className="page-content">
        {error && <div className="alert alert-danger">{error}</div>}
        {saved && <div className="alert alert-success">✅ Settings saved successfully</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Store Info */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, boxShadow: 'var(--shadow)' }}>
            <div className="section-heading" style={{ marginTop: 0 }}>🏪 Store Information</div>
            <div className="form-group">
              <label>Store Name</label>
              <input className="form-control" value={form.store_name} onChange={(e) => set('store_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-control" value={form.store_phone} onChange={(e) => set('store_phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea className="form-control" rows={3} value={form.store_address} onChange={(e) => set('store_address', e.target.value)} />
            </div>
          </div>

          {/* Receipt */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, boxShadow: 'var(--shadow)' }}>
            <div className="section-heading" style={{ marginTop: 0 }}>🧾 Receipt</div>
            <div className="form-group">
              <label>Receipt Header</label>
              <textarea className="form-control" rows={3} value={form.receipt_header} onChange={(e) => set('receipt_header', e.target.value)} placeholder="Thank you for your business" />
            </div>
            <div className="form-group">
              <label>Receipt Footer</label>
              <textarea className="form-control" rows={3} value={form.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} placeholder="Please come again!" />
            </div>
          </div>

          {/* Tax & Currency */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, boxShadow: 'var(--shadow)' }}>
            <div className="section-heading" style={{ marginTop: 0 }}>💰 Tax &amp; Currency</div>
            <div className="form-row">
              <div className="form-group">
                <label>Tax Rate (%)</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.tax_rate}
                  onChange={(e) => set('tax_rate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select className="form-control" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="MXN">MXN ($)</option>
                  <option value="BRL">BRL (R$)</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sync */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 20, boxShadow: 'var(--shadow)' }}>
            <div className="section-heading" style={{ marginTop: 0 }}>🔄 Server Sync</div>
            <div className="form-group">
              <label>Server URL</label>
              <input
                className="form-control"
                type="url"
                value={form.server_url}
                onChange={(e) => set('server_url', e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>
            <div className="form-group">
              <label>API Token (Bearer)</label>
              <input
                className="form-control"
                type="password"
                value={form.auth_token}
                onChange={(e) => set('auth_token', e.target.value)}
                placeholder="JWT or API token for server sync"
                autoComplete="new-password"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleTestConnection}
                disabled={testing || !form.server_url}
              >
                {testing ? 'Testing…' : '🔌 Test Connection'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSyncNow}
                disabled={syncing || !form.server_url}
              >
                {syncing ? 'Syncing…' : '🔄 Sync Now'}
              </button>
            </div>

            {testResult && (
              <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-danger'}`}>
                {testResult.msg}
              </div>
            )}
            {syncResult && (
              <div className={`alert ${syncResult.ok ? 'alert-success' : 'alert-danger'}`}>
                {syncResult.msg}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Last sync: {form.last_sync_time ? new Date(form.last_sync_time).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
