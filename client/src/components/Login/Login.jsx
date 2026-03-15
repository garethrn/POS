import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, isLoggedIn } from '../../web-api.js';

/**
 * Login screen for the web (browser) deployment.
 * Only rendered when the app is accessed through a browser
 * (not inside the Electron desktop app, which uses preload.js auth).
 */
export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Already logged in → redirect to POS
  useEffect(() => {
    if (isLoggedIn()) navigate('/', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginUser(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo / brand */}
        <div className="login-logo">⚡ POS</div>
        <div className="login-subtitle">Point of Sale System</div>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="form-group">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="form-control"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="admin"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Signing in…' : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Default credentials: <strong>admin</strong> / set via <code>ADMIN_PASSWORD</code> env var
        </div>
      </div>
    </div>
  );
}
