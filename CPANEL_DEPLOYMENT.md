# Deploying POS to cPanel Web Hosting

This guide walks you through installing the POS system on a cPanel-based web hosting account. It covers two deployment modes:

| Mode | What you deploy | Access |
|------|----------------|--------|
| **Server only** | Express API on cPanel, Electron desktop app on each POS terminal | Desktop app only |
| **Full web app** | Express API + React web UI both on cPanel | Any browser (tablet, PC, phone) |

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Part A — Deploy the API Server](#part-a--deploy-the-api-server)
   - [A1. Upload server files](#a1-upload-server-files)
   - [A2. Create the Node.js application in cPanel](#a2-create-the-nodejs-application-in-cpanel)
   - [A3. Set environment variables](#a3-set-environment-variables)
   - [A4. Install dependencies and start](#a4-install-dependencies-and-start)
   - [A5. Test the API](#a5-test-the-api)
3. [Part B — Deploy the Web UI (browser access)](#part-b--deploy-the-web-ui-browser-access)
   - [B1. Build the web client](#b1-build-the-web-client)
   - [B2. Upload the built files to cPanel](#b2-upload-the-built-files-to-cpanel)
   - [B3. (Optional) Subdomain setup](#b3-optional-subdomain-setup)
4. [Part C — First Login & Initial Setup](#part-c--first-login--initial-setup)
5. [Part D — Connecting the Electron Desktop App](#part-d--connecting-the-electron-desktop-app)
6. [Troubleshooting](#troubleshooting)
7. [Security Checklist](#security-checklist)
8. [Quick Reference — File Paths](#quick-reference--file-paths)

---

## 1. Prerequisites

### On your cPanel hosting account

- **Node.js 18 or later** must be available.  
  In cPanel → **Software → Setup Node.js App** (or "Node.js Selector"), check which versions are offered.  
  If Node.js is not listed, contact your hosting provider — some shared hosts don't support it.  
  Alternatives: [Railway](https://railway.app/), [Render](https://render.com/), or a VPS.
- **SSH access** (recommended) — needed to run `npm install`.  
  Many cPanel hosts provide SSH under **Advanced → SSH Access**.  
  If SSH is unavailable, use cPanel's **Terminal** (Advanced → Terminal) or the built-in package installer.
- Enough disk space for the app + SQLite database (~50 MB minimum).

### On your local computer

- [Node.js 18+](https://nodejs.org/) and npm installed (for building the web client).
- The POS repository cloned or downloaded.

---

## Part A — Deploy the API Server

The API server is an Express + SQLite application in the `server/` folder.

### A1. Upload server files

You need to upload the contents of the `server/` directory to your cPanel account.

**Option 1 — FTP / SFTP (recommended)**

1. Open an FTP client (FileZilla, Cyberduck, etc.).
2. Connect using the FTP credentials from cPanel → **FTP Accounts**.
3. Create a folder in your home directory (NOT inside `public_html`):
   ```
   /home/yourusername/pos_server/
   ```
4. Upload everything inside the local `server/` folder into `pos_server/`:
   ```
   pos_server/
   ├── src/
   │   ├── app.js
   │   ├── db.js
   │   ├── middleware/
   │   └── routes/
   ├── package.json
   └── .env.example
   ```

**Option 2 — cPanel File Manager**

1. cPanel → **Files → File Manager**.
2. Navigate to your home directory (the folder named after your cPanel username).
3. Create a new folder: `pos_server`.
4. Upload a ZIP of the `server/` directory contents, then extract it inside `pos_server/`.

> **Important:** Place the server folder **outside** `public_html` so the SQLite database
> and source code are not publicly accessible.

---

### A2. Create the Node.js application in cPanel

1. Log in to **cPanel**.
2. Go to **Software → Setup Node.js App** (sometimes called "Node.js Selector").
3. Click **Create Application**.
4. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Node.js version** | Select 18.x or 20.x |
   | **Application mode** | Production |
   | **Application root** | `pos_server` (the folder you created above) |
   | **Application URL** | Choose a subdomain, e.g. `api.yourstore.com` |
   | **Application startup file** | `src/app.js` |

5. Click **Create**.

cPanel will create an `.htaccess` proxy and a Passenger configuration automatically. Your API will now be accessible at the URL you chose (e.g., `https://api.yourstore.com`).

---

### A3. Set environment variables

Still on the Node.js App page:

1. Scroll down to the **Environment Variables** section.
2. Add the following variables (click **Add Variable** for each):

   | Name | Value | Notes |
   |------|-------|-------|
   | `NODE_ENV` | `production` | Required |
   | `JWT_SECRET` | *(long random string)* | **Required** — generate with the command below |
   | `ADMIN_PASSWORD` | *(your chosen password)* | Sets the admin account password on first run |
   | `DB_PATH` | `/home/yourusername/pos_data/pos.db` | Where the SQLite database is stored |
   | `CORS_ORIGINS` | `https://pos.yourstore.com` | Only if your web UI is on a different domain |

   **Generate a secure JWT_SECRET** (run this on your local machine):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Example output: `a3f8d2c1b4e6f7890ab12cd34ef56789012345678901234567890abcdef012345`

3. Click **Save** after adding all variables.

> **Tip:** If you don't set `DB_PATH`, the database will be stored as `pos_server/pos.db`.
> This is fine, but setting a path outside `pos_server` keeps the database safe if you redeploy.
> Create the target directory first: `mkdir -p /home/yourusername/pos_data`

---

### A4. Install dependencies and start

**Via SSH (preferred):**

```bash
# Connect to your server
ssh yourusername@yourserver.com

# Navigate to the app folder
cd ~/pos_server

# Install production dependencies only
npm install --omit=dev

# The app is started automatically by cPanel/Passenger.
# To restart it manually after config changes:
# Go to cPanel → Setup Node.js App → click the Restart button
```

**Via cPanel Terminal:**

cPanel → **Advanced → Terminal**, then:
```bash
cd ~/pos_server
npm install --omit=dev
```

**Via cPanel Node.js App manager:**

Some cPanel versions have a **"Run NPM Install"** button directly in the Node.js App interface — click it if available.

After installation, click the **Start Application** button in the Node.js App manager (or it may start automatically).

---

### A5. Test the API

Open a browser or use curl to test the health endpoint:

```bash
curl https://api.yourstore.com/health
```

Expected response:
```json
{"status":"ok","time":"2025-01-15T10:30:00.000Z"}
```

Test authentication:
```bash
curl -X POST https://api.yourstore.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_ADMIN_PASSWORD"}'
```

Expected response (contains a JWT token):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {"id":"...","username":"admin","role":"admin"}
}
```

If you see errors, check the [Troubleshooting](#troubleshooting) section.

---

## Part B — Deploy the Web UI (browser access)

This step gives you a browser-based POS that works on any device — tablet, PC, or phone — without installing the Electron app.

### B1. Build the web client

On your **local machine**:

```bash
# Navigate to the client directory
cd client

# Install dependencies (if you haven't already)
npm install

# Build the web version, pointing to your API server URL
VITE_API_URL=https://api.yourstore.com npm run build:web
```

This creates a `client/dist-web/` folder containing the compiled web app.

**Windows (Command Prompt):**
```cmd
set VITE_API_URL=https://api.yourstore.com
npm run build:web
```

**Windows (PowerShell):**
```powershell
$env:VITE_API_URL="https://api.yourstore.com"
npm run build:web
```

**Same domain (API and UI on the same domain):**

If you plan to serve both the API and the web UI from the same domain (using cPanel's Node.js app), leave `VITE_API_URL` empty:
```bash
npm run build:web
```

---

### B2. Upload the built files to cPanel

The built files are in `client/dist-web/`. Upload them to where visitors will access the UI.

**Scenario 1 — Web UI at the root of your domain (`yourstore.com`)**

Upload the contents of `dist-web/` to `public_html/`:
```
public_html/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── (other files)
```

**Scenario 2 — Web UI in a subdirectory (`yourstore.com/pos`)**

1. Create the folder `public_html/pos/`.
2. Upload `dist-web/` contents into `public_html/pos/`.
3. Rebuild with the correct base path:
   ```bash
   VITE_API_URL=https://api.yourstore.com VITE_BASE_PATH=/pos/ npm run build:web
   ```

**Scenario 3 — Web UI on a subdomain (`pos.yourstore.com`)**

1. In cPanel → **Domains → Subdomains**, create `pos.yourstore.com` and set its document root to `public_html/pos/`.
2. Upload `dist-web/` contents into `public_html/pos/`.
3. Rebuild (same as scenario 1, no base path override needed).

---

### B3. (Optional) Subdomain setup

If your API is at `api.yourstore.com` and the web UI is at `pos.yourstore.com`:

1. Set `CORS_ORIGINS=https://pos.yourstore.com` in your API server environment variables (see [A3](#a3-set-environment-variables)).
2. Restart the API server.

The POS app uses **HashRouter** (`#` URLs), so no special `.htaccess` URL rewriting is needed. A basic `.htaccess` that sends all requests to `index.html` is still good practice:

Create `public_html/.htaccess` (or `public_html/pos/.htaccess`):
```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

---

## Part C — First Login & Initial Setup

1. Open your web browser and navigate to where you uploaded the UI:
   - `https://yourstore.com` (root), or
   - `https://pos.yourstore.com` (subdomain), or
   - `https://yourstore.com/pos` (subdirectory)

2. You will see the **⚡ POS — Sign In** screen.

3. Log in with:
   - **Username:** `admin`
   - **Password:** The value you set as `ADMIN_PASSWORD` (check your Node.js App environment variables)

   > If you didn't set `ADMIN_PASSWORD`, a random password was printed to the application log
   > on first start. In cPanel → Setup Node.js App, look for a "View Log" or check the
   > application's stderr log in `~/logs/`.

4. After logging in, go to **Settings** and configure:
   - Store name, address, phone
   - Tax rate
   - Currency
   - Receipt header/footer

5. Create your product categories, then add your products.

---

## Part D — Connecting the Electron Desktop App

The Windows/macOS Electron app can sync with the server you just deployed.

1. Build or download the Electron installer (see README for build instructions).
2. Install and open the Electron app on your POS terminal.
3. Go to **Settings** in the app.
4. Under **Server Sync**, enter:
   - **Server URL:** `https://api.yourstore.com`
   - **API Token:** Your JWT token (get one by logging in via the API: `POST /api/auth/login`)
5. Click **Test Connection** — it should say "Connection successful!".
6. Click **Sync Now** to pull data from the server.

---

## Troubleshooting

### "Application Error" or blank page on the API URL

1. **Check Node.js version:** cPanel → Setup Node.js App → confirm Node.js 18+ is selected.
2. **Check npm install ran:** SSH in and run `ls ~/pos_server/node_modules/` — it should have many folders.
3. **Check environment variables:** Especially `JWT_SECRET`. In production mode, the server refuses to start without it.
4. **Check the error log:** cPanel → Setup Node.js App → click the app → look for a log viewer, or check `~/logs/` via SSH.
5. **Check the startup file path:** Should be `src/app.js` (not just `app.js`).

### "FATAL: JWT_SECRET environment variable must be set in production"

The `NODE_ENV=production` env var is set but `JWT_SECRET` is missing. Add `JWT_SECRET` in cPanel → Setup Node.js App → Environment Variables.

### "No token provided" on all API calls

Your JWT token has expired (they last 24 hours) or was not sent. Log in again via `POST /api/auth/login`.

### Web UI shows login screen but login fails

1. Confirm the API server is running: `curl https://api.yourstore.com/health`
2. Confirm `VITE_API_URL` was set correctly when you ran `npm run build:web`.
3. Check browser console (F12) for CORS errors. If you see `Access-Control-Allow-Origin` errors:
   - Add `CORS_ORIGINS=https://pos.yourstore.com` to the API server environment variables.
   - Restart the API server.
4. Verify the admin password: re-check the `ADMIN_PASSWORD` environment variable.

### White/blank screen after uploading to cPanel

The `dist-web/` files may be in a sub-folder instead of the document root. In cPanel File Manager, verify `index.html` is directly inside `public_html/` (or whichever document root the subdomain uses), **not** inside a nested `dist-web/` sub-folder.

### SQLite "disk I/O error" or "database is locked"

- Check disk space: cPanel → **Files → Disk Usage**.
- Ensure the directory containing `pos.db` is writable by the Node.js process.
- Try setting `DB_PATH` to a different location.

### "Cannot find module 'better-sqlite3'"

This native module needs to be compiled for your server's Node.js version. Run:
```bash
cd ~/pos_server
npm rebuild better-sqlite3
```

If that fails, your host may not allow native module compilation. Contact support or switch to a VPS.

### The app is slow on first load

On shared hosting, the Node.js process may be in "idle" state and takes a few seconds to wake. This is normal for Passenger on shared hosts. For faster cold-starts, upgrade to a VPS or a platform like Railway/Render.

---

## Security Checklist

Before going live, confirm:

- [ ] `JWT_SECRET` is set to a long (32+ char) random string in the environment variables
- [ ] `ADMIN_PASSWORD` is set to a strong password (not the default)
- [ ] `NODE_ENV` is set to `production`
- [ ] The `pos_server/` folder is **outside** `public_html/` (not web-accessible)
- [ ] The database file path (`DB_PATH`) is outside `public_html/`
- [ ] SSL/TLS (HTTPS) is enabled on both the API domain and the web UI domain
  - cPanel → **Security → SSL/TLS** → use Let's Encrypt (free)
- [ ] `CORS_ORIGINS` is set to your specific UI domain if API and UI are on separate domains
- [ ] You have deleted or renamed `.env.example` (it contains hint comments)

---

## Quick Reference — File Paths

```
cPanel home directory (/home/yourusername/)
│
├── pos_server/                ← API server (upload server/ folder here)
│   ├── src/
│   │   ├── app.js             ← startup file (set in cPanel)
│   │   ├── db.js
│   │   ├── middleware/
│   │   └── routes/
│   ├── node_modules/          ← created by npm install
│   └── package.json
│
├── pos_data/                  ← database storage (create manually)
│   └── pos.db                 ← SQLite database (auto-created on first run)
│
└── public_html/               ← web-accessible files
    ├── index.html             ← web UI entry point (upload dist-web/ here)
    └── assets/                ← compiled JS/CSS
```

---

## Alternative: All-in-One on a Single cPanel Domain

If you want both the API and the web UI served from the same domain:

1. Deploy the API to your cPanel subdomain (e.g., `api.yourstore.com`) following Part A.
2. Build the web UI with `VITE_API_URL=https://api.yourstore.com npm run build:web`.
3. Upload `dist-web/` contents to `public_html/` (main domain) following Part B.
4. Visit `https://yourstore.com` — login page appears immediately.

No cPanel proxy tricks needed — the browser fetches the React app from `yourstore.com` and it calls `api.yourstore.com` directly.

---

## Alternative: VPS / Cloud Hosting

For better performance and no shared-hosting limitations:

```bash
# On your VPS (Ubuntu/Debian)
git clone https://github.com/yourusername/pos.git
cd pos/server

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm install --omit=dev

# Configure
cp .env.example .env
nano .env   # Set JWT_SECRET, ADMIN_PASSWORD, DB_PATH, NODE_ENV=production

# Start with PM2 (keeps the process running after SSH disconnect)
npm install -g pm2
pm2 start src/app.js --name pos-api
pm2 save
pm2 startup
```

For the web UI, build locally and upload to `/var/www/html/` or use Nginx to serve `dist-web/`.
