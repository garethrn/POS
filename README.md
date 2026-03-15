# POS - Point of Sale System

A full-featured Point of Sale system inspired by [Aronium POS](https://www.aronium.com/), featuring:

- **Web-hosted server** — deploy to any Node.js hosting platform (Heroku, Railway, Render, VPS, etc.)
- **Offline-first desktop client** — Windows and macOS app built with Electron
- **Automatic sync** — client syncs data with the server whenever an internet connection is available

---

## Architecture

```
┌─────────────────────────┐       ┌──────────────────────────────┐
│   Electron Desktop App  │       │     Express REST API Server   │
│  (Windows / macOS)      │◄─────►│  (Web Hosting / VPS / Cloud)  │
│                         │ Sync  │                              │
│  • React UI             │       │  • Node.js + Express          │
│  • Local SQLite DB      │       │  • SQLite Database            │
│  • Works offline        │       │  • JWT Authentication         │
└─────────────────────────┘       └──────────────────────────────┘
```

---

## Features

### POS Screen
- Product grid with category filtering and search
- Add products to cart with quantity controls
- Customer selection
- Discount and tax calculation
- Cash / Card / Other payment methods
- Change calculation for cash payments
- Receipt summary

### Product Management
- Add, edit, delete products
- SKU and barcode support
- Category assignment
- Cost and selling price
- Inventory stock tracking

### Category Management
- Colour-coded categories
- Used to filter products on POS screen

### Customer Management
- Customer profiles (name, email, phone, address)
- Loyalty points tracking

### Transaction History
- Full sales history with filters
- Per-transaction item breakdown
- Sync status indicator

### Reports
- Daily / weekly / monthly date ranges
- Summary cards: total sales, transaction count, average sale
- Daily breakdown table with CSS bar chart

### Settings
- Store name, phone, address
- Receipt header and footer text
- Tax rate and currency symbol
- Server URL for sync + connection test
- Manual sync button + last sync time

### Sync
- Automatically syncs when online
- Push local changes (new transactions, product/customer edits) to server
- Pull server changes down to local database
- Conflict resolution: higher `updated_at` timestamp wins
- Transactions are immutable once synced

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

---

### Server Setup

```bash
cd server
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env: set a strong JWT_SECRET

# Start the server (development)
npm run dev

# Start the server (production)
npm start
```

The server starts on port **3001** by default (set `PORT` in `.env` to change).

**Default admin credentials:**
- Username: `admin`
- Password: `admin123`

> ⚠️ Change the default password immediately after first login via the Settings screen.

#### Deploying to Web Hosting

The server is a standard Node.js/Express app. Deploy it to any platform that supports Node.js:

| Platform | Notes |
|----------|-------|
| **cPanel** | See full guide → **[CPANEL_DEPLOYMENT.md](CPANEL_DEPLOYMENT.md)** |
| [Railway](https://railway.app/) | Free tier available, auto-detects Node.js |
| [Render](https://render.com/) | Free tier available |
| [Heroku](https://heroku.com/) | Set `JWT_SECRET` as a config var |
| [Fly.io](https://fly.io/) | Good for persistent SQLite |
| VPS (Ubuntu) | Run with `pm2 start src/app.js` |

Required environment variables:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Long random secret (32+ chars). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | Set to `production` on live servers |
| `ADMIN_PASSWORD` | Initial admin password (auto-generated and logged if not set) |
| `DB_PATH` | Path to SQLite database file (default: `server/pos.db`) |
| `CORS_ORIGINS` | Comma-separated allowed origins (optional; allow-all if not set) |

---

### Client Setup

#### Option A — Electron Desktop App (Windows / macOS)

```bash
cd client
npm install

# Development (opens Electron window with live-reload)
npm run dev

# Build installer for distribution
npm run dist
```

Built installers will be in `client/dist-electron/`:
- **Windows**: `.exe` NSIS installer
- **macOS**: `.dmg` disk image

After installing, open the app, go to **Settings → Server Sync**, enter your server URL and API token, and click **Sync Now**.

#### Option B — Web App (browser, any device)

The React UI can be built as a standalone web app that runs in any browser — ideal for tablets, PCs, and phones without installing Electron.

```bash
cd client
npm install

# Build for web (replace with your API server URL)
VITE_API_URL=https://api.yourstore.com npm run build:web
```

The built files will be in `client/dist-web/`. Upload these to your web host's public directory.

**Development mode** (requires the server running on localhost:3001):
```bash
cd client
npm run dev:web   # Opens browser at http://localhost:5174
```

For detailed cPanel deployment instructions, see **[CPANEL_DEPLOYMENT.md](CPANEL_DEPLOYMENT.md)**.

#### Configuring the Server URL (Electron app)

1. Open the client app
2. Go to **Settings**
3. Enter your server URL in the **Server Sync** section (e.g. `https://my-pos-server.railway.app`)
4. Enter your **API Token** (JWT token from logging in)
5. Click **Test Connection** to verify
6. Click **Sync Now** to perform the first sync

---

## API Reference

All API endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, returns JWT token |
| POST | `/api/auth/register` | Register new user (admin only) |
| GET | `/api/auth/me` | Get current user info |

All other endpoints require `Authorization: Bearer <token>` header.

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (supports `?search=&category_id=`) |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Soft-delete product |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| GET | `/api/categories/:id` | Get category |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Soft-delete category |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (supports `?search=`) |
| GET | `/api/customers/:id` | Get customer |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Soft-delete customer |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (supports `?from=&to=&customer_id=&limit=`) |
| GET | `/api/transactions/:id` | Get transaction with items |
| POST | `/api/transactions` | Create transaction |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/push` | Push local changes to server |
| GET | `/api/sync/pull?since=<ISO>` | Pull server changes since timestamp |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings` | Update settings |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check (no auth required) |

---

## Project Structure

```
POS/
├── CPANEL_DEPLOYMENT.md     # ← cPanel hosting guide
├── server/                  # Express REST API
│   ├── src/
│   │   ├── app.js           # Express app entry point
│   │   ├── db.js            # SQLite setup, schema, and migrations
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── products.js
│   │       ├── categories.js
│   │       ├── customers.js
│   │       ├── transactions.js
│   │       ├── settings.js
│   │       ├── suppliers.js
│   │       ├── purchase_orders.js
│   │       ├── stock_adjustments.js
│   │       ├── shifts.js
│   │       ├── laybys.js
│   │       ├── reports.js
│   │       └── sync.js
│   ├── package.json
│   └── .env.example
│
└── client/                  # Electron desktop app + web app
    ├── electron/
    │   ├── main.js          # Electron main process + IPC handlers
    │   ├── preload.js       # Context bridge (window.posAPI)
    │   └── db.js            # Local SQLite database
    ├── src/
    │   ├── index.jsx        # React entry point (injects web-api in browser mode)
    │   ├── App.jsx          # Router, routes, login guard
    │   ├── App.css          # Global styles
    │   ├── web-api.js       # ← HTTP posAPI for browser/cPanel deployment
    │   └── components/
    │       ├── Layout.jsx
    │       ├── Sidebar.jsx
    │       ├── Login/Login.jsx       # ← Web login screen
    │       ├── POS/POSScreen.jsx
    │       ├── Products/Products.jsx
    │       ├── Categories/Categories.jsx
    │       ├── Customers/Customers.jsx
    │       ├── Suppliers/Suppliers.jsx
    │       ├── PurchaseOrders/PurchaseOrders.jsx
    │       ├── StockAdjustments/StockAdjustments.jsx
    │       ├── Laybys/Laybys.jsx
    │       ├── CashManagement/CashManagement.jsx
    │       ├── Transactions/Transactions.jsx
    │       ├── Reports/Reports.jsx
    │       └── Settings/Settings.jsx
    ├── index.html
    ├── vite.config.js       # Electron build config
    ├── vite.web.config.js   # ← Web / cPanel build config
    └── package.json
```

---

## License

MIT
