import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Numeric Keypad ────────────────────────────────────────────────────────────
function NumPad({ value, onChange }) {
  const press = (key) => {
    if (key === '⌫') {
      onChange(value.length > 1 ? value.slice(0, -1) : '0');
    } else if (key === '.') {
      if (!value.includes('.')) onChange(value + '.');
    } else {
      onChange(value === '0' ? key : value + key);
    }
  };
  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
  return (
    <div>
      <div className="numpad-display">{value}</div>
      <div className="numpad">
        {keys.map((k) => (
          <button
            key={k}
            className={`numpad-btn${k === '⌫' ? ' numpad-del' : ''}`}
            onClick={() => press(k)}
          >{k}</button>
        ))}
      </div>
    </div>
  );
}

// ── Receipt Modal ─────────────────────────────────────────────────────────────
function ReceiptModal({ transaction, items, settings, onClose }) {
  const storeName = settings?.store_name || 'My Store';
  const footer = settings?.receipt_footer || 'Thank you for your business!';
  const header = settings?.receipt_header || '';
  const fmt = (v) => `$${Number(v).toFixed(2)}`;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🧾 Receipt</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="receipt">
            <div className="receipt-header">
              <div className="receipt-store">{storeName}</div>
              {header && <div style={{fontSize:11,marginTop:4}}>{header}</div>}
              <div style={{fontSize:11,marginTop:6}}>Receipt #: {transaction.receipt_number}</div>
              <div style={{fontSize:11}}>{new Date().toLocaleString()}</div>
            </div>
            <div className="receipt-items">
              {items.map((item, i) => (
                <div key={i} className="receipt-item">
                  <span>{item.product_name} x{item.quantity}</span>
                  <span>{fmt(item.total)}</span>
                </div>
              ))}
            </div>
            <hr className="receipt-divider" />
            <div className="receipt-item"><span>Subtotal</span><span>{fmt(transaction.subtotal)}</span></div>
            {transaction.discount > 0 && <div className="receipt-item"><span>Discount</span><span>-{fmt(transaction.discount)}</span></div>}
            {transaction.tax > 0 && <div className="receipt-item"><span>Tax</span><span>{fmt(transaction.tax)}</span></div>}
            <hr className="receipt-divider" />
            <div className="receipt-total"><span>TOTAL</span><span>{fmt(transaction.total)}</span></div>
            <div className="receipt-item">
              <span>Payment ({(transaction.payment_method||'cash').toUpperCase()})</span>
              <span>{fmt(transaction.amount_tendered || transaction.total)}</span>
            </div>
            {transaction.change_due > 0 && (
              <div className="receipt-item" style={{color:'#2e7d32',fontWeight:700}}>
                <span>Change</span><span>{fmt(transaction.change_due)}</span>
              </div>
            )}
            <div className="receipt-footer">{footer}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Print</button>
          <button className="btn btn-success" onClick={onClose}>✅ New Sale</button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ cart, subtotal, discount, tax, total, paymentMethod, customer, settings, onConfirm, onClose }) {
  const [tendered, setTendered] = useState(String(Math.ceil(total * 100) / 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fmt = (v) => `$${Number(v).toFixed(2)}`;
  const tenderedNum = parseFloat(tendered) || 0;
  const change = Math.max(0, tenderedNum - total);

  const handleConfirm = async () => {
    if (paymentMethod === 'cash' && tenderedNum < total) {
      setError('Amount tendered is less than total');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm({ tendered: tenderedNum, change });
    } catch (e) {
      setError(e.message || 'Payment failed');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">💳 Checkout — {paymentMethod.toUpperCase()}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <div style={{fontWeight:700,marginBottom:10,fontSize:15}}>Order Summary</div>
              <div style={{background:'#f7f9fc',borderRadius:8,padding:14,marginBottom:12}}>
                {cart.map((item, i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',fontSize:13}}>
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>${Number(item.total).toFixed(2)}</span>
                  </div>
                ))}
                <hr style={{margin:'8px 0',borderColor:'#cfd8dc'}} />
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discount > 0 && <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#2e7d32'}}><span>Discount</span><span>-{fmt(discount)}</span></div>}
                {tax > 0 && <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span>Tax</span><span>{fmt(tax)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:17,fontWeight:800,marginTop:6,paddingTop:6,borderTop:'2px solid #cfd8dc'}}>
                  <span>TOTAL</span><span style={{color:'#1565c0'}}>{fmt(total)}</span>
                </div>
              </div>
              {customer && (
                <div className="alert alert-info" style={{marginBottom:0}}>
                  👤 Customer: <strong>{customer.name}</strong>
                  {paymentMethod === 'account' && customer.credit_limit > 0 && (
                    <div style={{marginTop:4}}>Credit Limit: {fmt(customer.credit_limit)} | Balance: {fmt(customer.balance || 0)}</div>
                  )}
                </div>
              )}
            </div>
            <div>
              {paymentMethod === 'cash' && (
                <>
                  <div style={{fontWeight:700,marginBottom:8,fontSize:15}}>Amount Tendered</div>
                  <NumPad value={tendered} onChange={setTendered} />
                  {tenderedNum >= total && (
                    <div style={{marginTop:12,padding:'10px 14px',background:'#e8f5e9',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontWeight:700,color:'#2e7d32'}}>Change Due</span>
                      <span style={{fontSize:22,fontWeight:800,color:'#2e7d32'}}>{fmt(change)}</span>
                    </div>
                  )}
                </>
              )}
              {paymentMethod === 'card' && (
                <div style={{textAlign:'center',padding:'30px 0'}}>
                  <div style={{fontSize:48,marginBottom:12}}>💳</div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Process Card Payment</div>
                  <div style={{fontSize:24,fontWeight:800,color:'#1565c0'}}>{fmt(total)}</div>
                  <div style={{fontSize:13,color:'#607d8b',marginTop:8}}>Please swipe, tap, or insert card</div>
                </div>
              )}
              {paymentMethod === 'eft' && (
                <div style={{textAlign:'center',padding:'30px 0'}}>
                  <div style={{fontSize:48,marginBottom:12}}>🏦</div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>EFT Payment</div>
                  <div style={{fontSize:24,fontWeight:800,color:'#1565c0'}}>{fmt(total)}</div>
                  <div style={{fontSize:13,color:'#607d8b',marginTop:8}}>Complete EFT transfer</div>
                </div>
              )}
              {paymentMethod === 'account' && (
                <div style={{textAlign:'center',padding:'30px 0'}}>
                  <div style={{fontSize:48,marginBottom:12}}>📋</div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Charge to Account</div>
                  <div style={{fontSize:24,fontWeight:800,color:'#1565c0'}}>{fmt(total)}</div>
                  {customer ? (
                    <div style={{fontSize:13,color:'#607d8b',marginTop:8}}>Charging to: <strong>{customer.name}</strong></div>
                  ) : (
                    <div className="alert alert-warning" style={{marginTop:12}}>Please select a customer for account payment</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-success btn-lg"
            onClick={handleConfirm}
            disabled={saving || (paymentMethod === 'account' && !customer)}
          >
            {saving ? 'Processing…' : `✅ Confirm Payment ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main POS Screen ────────────────────────────────────────────────────────────
export default function POSScreen() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({});
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const [showPayment, setShowPayment] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const barcodeRef = useRef(null);

  const load = useCallback(async () => {
    if (!window.posAPI) { setLoading(false); return; }
    setLoading(true);
    try {
      const [prods, cats, custs, sett] = await Promise.all([
        window.posAPI.products.getAll(),
        window.posAPI.categories.getAll(),
        window.posAPI.customers.getAll(),
        window.posAPI.settings.get(),
      ]);
      setProducts(prods || []);
      setCategories(cats || []);
      setCustomers(custs || []);
      setSettings(sett || {});
      const shift = await window.posAPI?.shifts?.getCurrent?.().catch(() => null);
      setCurrentShift(shift || null);
    } catch (e) {
      console.error('POSScreen load error:', e);
    }
    setLoading(false);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = useCallback((product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price * (1 - i.item_discount / 100) }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || '',
          quantity: 1,
          unit_price: product.price,
          cost: product.cost || 0,
          item_discount: 0,
          total: product.price,
        },
      ];
    });
    barcodeRef.current?.focus();
  }, []);

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product_id === productId
            ? {
                ...i,
                quantity: Math.max(0, i.quantity + delta),
                total: Math.max(0, i.quantity + delta) * i.unit_price * (1 - i.item_discount / 100),
              }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const updateItemDiscount = (productId, val) => {
    const d = Math.min(100, Math.max(0, parseFloat(val) || 0));
    setCart((prev) =>
      prev.map((i) =>
        i.product_id === productId
          ? { ...i, item_discount: d, total: i.quantity * i.unit_price * (1 - d / 100) }
          : i
      )
    );
  };

  const removeItem = (productId) => setCart((prev) => prev.filter((i) => i.product_id !== productId));
  const clearCart = () => { setCart([]); setSelectedCustomer(''); setDiscount('0'); setPaymentMethod('cash'); };

  // ── Barcode scan ──────────────────────────────────────────────────────────────
  const handleBarcode = (e) => {
    if (e.key !== 'Enter') return;
    const val = barcodeInput.trim();
    if (!val) return;
    const product = products.find((p) => p.barcode === val || p.sku === val);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      setBarcodeInput('');
    }
  };

  // ── Totals ────────────────────────────────────────────────────────────────────
  const taxRate = parseFloat(settings.tax_rate || '0') / 100;
  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const discountAmt = subtotal * (parseFloat(discount) || 0) / 100;
  const taxableAmount = subtotal - discountAmt;
  const taxAmt = taxableAmount * taxRate;
  const total = taxableAmount + taxAmt;

  // ── Filtered products ──────────────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomer) || null;
  const fmt = (v) => `$${Number(v).toFixed(2)}`;

  // ── Suspend as layby ──────────────────────────────────────────────────────────
  const handleSuspend = async () => {
    if (cart.length === 0) return;
    try {
      const laybyData = {
        layby: {
          customer_id: selectedCustomer || null,
          customer_name: selectedCustomerObj?.name || 'Walk-in',
          subtotal,
          discount: discountAmt,
          tax: taxAmt,
          total,
          deposit: 0,
          balance_due: total,
          status: 'active',
          notes: '',
        },
        items: cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: i.item_discount,
          total: i.total,
        })),
      };
      await window.posAPI?.laybys?.save?.(laybyData);
      clearCart();
      alert('Sale suspended as layby!');
    } catch (e) {
      alert('Failed to suspend: ' + (e.message || e));
    }
  };

  // ── Checkout ──────────────────────────────────────────────────────────────────
  const handleConfirmPayment = async ({ tendered, change }) => {
    const now = new Date().toISOString();
    const receiptNumber = `R${Date.now()}`;
    const txn = {
      receipt_number: receiptNumber,
      customer_id: selectedCustomer || null,
      subtotal,
      tax: taxAmt,
      discount: discountAmt,
      total,
      payment_method: paymentMethod,
      amount_tendered: tendered,
      change_due: change,
      status: 'completed',
      notes: '',
      created_at: now,
    };
    const txnItems = cart.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      sku: i.sku,
      quantity: i.quantity,
      unit_price: i.unit_price,
      cost: i.cost,
      discount: i.item_discount,
      total: i.total,
    }));
    const result = await window.posAPI.transactions.save({ transaction: txn, items: txnItems });
    setShowPayment(false);
    setReceiptData({ transaction: { ...txn, id: result.id, receipt_number: result.receipt_number || receiptNumber }, items: txnItems });
    clearCart();
    load();
  };

  const handleReceiptClose = () => { setReceiptData(null); barcodeRef.current?.focus(); };

  if (loading) return <div className="loading-state" style={{margin:'auto'}}>Loading POS…</div>;

  return (
    <div className="pos-screen">
      {/* LEFT PANEL */}
      <div className="pos-left">
        {/* Top bar */}
        <div className="pos-topbar">
          <span className="store-name">{settings.store_name || '⚡ POS'}</span>
          {currentShift ? (
            <span className="shift-badge">🕐 Shift Open</span>
          ) : (
            <span className="shift-warning">⚠️ No Active Shift</span>
          )}
          <input
            ref={barcodeRef}
            className="pos-barcode-input"
            placeholder="📷 Scan barcode or SKU…"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcode}
          />
        </div>

        {/* Category tabs */}
        <div className="pos-category-tabs">
          <button
            className={`cat-tab${selectedCategory === 'all' ? ' active' : ''}`}
            style={selectedCategory === 'all' ? { background: '#546e7a', borderColor: '#546e7a' } : {}}
            onClick={() => setSelectedCategory('all')}
          >All</button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`cat-tab${selectedCategory === cat.id ? ' active' : ''}`}
              style={selectedCategory === cat.id ? { background: cat.color, borderColor: cat.color } : { borderColor: cat.color, color: cat.color }}
              onClick={() => setSelectedCategory(cat.id)}
            >{cat.name}</button>
          ))}
        </div>

        {/* Search */}
        <div className="pos-search-bar">
          <input
            placeholder="🔍 Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Product grid */}
        <div className="pos-product-grid">
          {filteredProducts.length === 0 && (
            <div style={{gridColumn:'1/-1',textAlign:'center',color:'var(--text-muted)',padding:'40px 0'}}>No products found</div>
          )}
          {filteredProducts.map((product) => {
            const cat = categories.find((c) => c.id === product.category_id);
            const color = cat?.color || '#607d8b';
            const outOfStock = product.stock <= 0;
            const reorderPoint = product.reorder_point || 5;
            const lowStock = !outOfStock && product.stock <= reorderPoint;
            return (
              <div
                key={product.id}
                className={`product-tile${outOfStock ? ' out-of-stock' : ''}`}
                style={{ borderTopColor: color }}
                onClick={() => !outOfStock && addToCart(product)}
                title={outOfStock ? 'Out of stock' : product.name}
              >
                <div className="product-tile-name">{product.name}</div>
                {product.sku && <div className="product-tile-sku">{product.sku}</div>}
                <div className="product-tile-price">{fmt(product.price)}</div>
                <div className={`product-tile-stock${outOfStock ? ' out' : lowStock ? ' low' : ''}`}>
                  {outOfStock ? '❌ Out of stock' : lowStock ? `⚠️ ${product.stock} left` : `✅ ${product.stock}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL - CART */}
      <div className="pos-right">
        <div className="cart-header">
          <span className="cart-title">🛒 Cart <span className="cart-count">{cart.reduce((s,i)=>s+i.quantity,0)}</span></span>
          {cart.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={clearCart}>🗑 Clear</button>
          )}
        </div>

        {/* Customer selector */}
        <div className="cart-customer">
          <select
            className="form-control"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">👤 Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.account_type === 'account' ? ' (Account)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cart items */}
        <div className="cart-items">
          {cart.length === 0 && (
            <div className="empty-state" style={{padding:'30px 16px'}}>
              <div className="empty-state-icon">🛒</div>
              <div className="empty-state-text">Cart is empty</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>Click a product or scan a barcode</div>
            </div>
          )}
          {cart.map((item) => (
            <div key={item.product_id} className="cart-item">
              <div className="cart-item-info">
                <div className="cart-item-name">{item.product_name}</div>
                <div className="cart-item-price">{fmt(item.unit_price)} each</div>
              </div>
              <div className="cart-item-controls">
                <button className="qty-btn" onClick={() => updateQty(item.product_id, -1)}>−</button>
                <span className="qty-display">{item.quantity}</span>
                <button className="qty-btn" onClick={() => updateQty(item.product_id, 1)}>+</button>
              </div>
              <input
                className="cart-item-discount"
                type="number"
                min={0}
                max={100}
                value={item.item_discount}
                onChange={(e) => updateItemDiscount(item.product_id, e.target.value)}
                title="Item discount %"
                placeholder="%"
              />
              <div className="cart-item-total">{fmt(item.total)}</div>
              <button className="cart-item-remove" onClick={() => removeItem(item.product_id)}>✕</button>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="cart-totals">
          <div className="cart-totals-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="cart-discount-row">
            <span>Discount</span>
            <input
              type="number"
              min={0}
              max={100}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="%"
            />
            <span>%</span>
            {discountAmt > 0 && <span style={{color:'var(--danger)',marginLeft:'auto'}}>-{fmt(discountAmt)}</span>}
          </div>
          {taxAmt > 0 && <div className="cart-totals-row"><span>Tax ({settings.tax_rate || 0}%)</span><span>{fmt(taxAmt)}</span></div>}
          <div className="cart-totals-row total"><span>TOTAL</span><span style={{color:'var(--primary)'}}>{fmt(total)}</span></div>
        </div>

        {/* Payment methods */}
        <div className="payment-methods">
          {[
            { key: 'cash', label: '💵 Cash' },
            { key: 'card', label: '💳 Card' },
            { key: 'account', label: '📋 Account' },
            { key: 'eft', label: '🏦 EFT' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`pay-method-btn${paymentMethod === key ? ' active' : ''}`}
              onClick={() => setPaymentMethod(key)}
            >{label}</button>
          ))}
        </div>

        {/* Actions */}
        <div className="cart-actions">
          <button
            className="btn btn-warning"
            onClick={handleSuspend}
            disabled={cart.length === 0}
            title="Suspend sale as layby"
          >⏸ Layby</button>
          <button
            className="btn btn-success btn-lg"
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
          >✅ Checkout {cart.length > 0 ? fmt(total) : ''}</button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          cart={cart}
          subtotal={subtotal}
          discount={discountAmt}
          tax={taxAmt}
          total={total}
          paymentMethod={paymentMethod}
          customer={selectedCustomerObj}
          settings={settings}
          onConfirm={handleConfirmPayment}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <ReceiptModal
          transaction={receiptData.transaction}
          items={receiptData.items}
          settings={settings}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  );
}
